import { OrbitControls, TransformControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { useSyncExternalStore } from 'react';
import { RENDER } from '../shared/Constants';
import { EditorOrbitContext } from './EditorOrbitContext';
import {
  forceUnlockEditorOrbit,
  registerEditorOrbitControls,
  setEditorOrbitDragLock,
} from './editorOrbitLock';
import { MapLightNode, MapObjectMesh } from './MapObjectMesh';
import { stadiumLightStore } from '../game/stadiumLightStore';
import { mapEditorStore } from './mapEditorStore';
import type { MapGroup, MapLight, MapObject, TransformMode } from './mapEditorTypes';
import { getHiddenStadiumPieces } from './stadiumLayout';
import { EditorMoveGrid } from './editorMoveGrid';
import { editorDisabledRaycast, editorPickHandler } from './editorPick';
import { EditorBaseArena, StadiumGroupPickMesh, StadiumGroupVisual } from './StadiumGroupLayer';
import { MapEditorSceneSetup } from './MapEditorSceneSetup';

const EditorBackdrop = memo(function EditorBackdrop({
  hiddenGoalIds,
  hiddenPillarIndices,
  hiddenPlatformIndices,
}: {
  hiddenGoalIds: string[];
  hiddenPillarIndices: number[];
  hiddenPlatformIndices: number[];
}) {
  return (
    <>
      <EditorBaseArena
        hiddenGoalIds={hiddenGoalIds}
        hiddenPillarIndices={hiddenPillarIndices}
        hiddenPlatformIndices={hiddenPlatformIndices}
      />
    </>
  );
});

function vec3FromObject(obj: THREE.Object3D): {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
} {
  return {
    position: [obj.position.x, obj.position.y, obj.position.z],
    rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
    scale: [obj.scale.x, obj.scale.y, obj.scale.z],
  };
}

function useGizmoOrbitLock() {
  return useCallback((dragging: boolean) => {
    setEditorOrbitDragLock(dragging);
  }, []);
}

type DraggingChangedControls = {
  addEventListener(
    type: 'dragging-changed',
    listener: (event: { value: boolean }) => void,
  ): void;
  removeEventListener(
    type: 'dragging-changed',
    listener: (event: { value: boolean }) => void,
  ): void;
};

function bindGizmoDragLock(
  ctrl: React.ComponentRef<typeof TransformControls> | null,
  lockOrbit: (dragging: boolean) => void,
): (() => void) | undefined {
  if (!ctrl) return undefined;
  const node = ctrl as unknown as DraggingChangedControls;
  const handler = (event: { value: boolean }) => {
    lockOrbit(event.value);
    mapEditorStore.setGizmoDragging(event.value);
  };
  node.addEventListener('dragging-changed', handler);
  return () => {
    node.removeEventListener('dragging-changed', handler);
    lockOrbit(false);
    mapEditorStore.setGizmoDragging(false);
  };
}

/** Visual + pick scale for TransformControls (default 1 — larger = easier to grab). */
const EDITOR_GIZMO_SIZE = 2.35;

function TransformGizmo({
  target,
  mode,
  onSync,
}: {
  target: THREE.Object3D;
  mode: TransformMode | 'translate' | 'rotate';
  onSync: () => void;
}) {
  const tcRef = useRef<React.ComponentRef<typeof TransformControls>>(null);
  const lockOrbit = useGizmoOrbitLock();

  useLayoutEffect(() => {
    return bindGizmoDragLock(tcRef.current, lockOrbit);
  }, [lockOrbit, target]);

  return (
    <TransformControls
      ref={tcRef}
      object={target}
      mode={mode}
      size={EDITOR_GIZMO_SIZE}
      onObjectChange={() => {
        mapEditorStore.touchGizmoPointer();
        onSync();
      }}
      onMouseDown={() => {
        mapEditorStore.touchGizmoPointer();
      }}
      onMouseUp={onSync}
    />
  );
}

function EditableGroup({
  group,
  selected,
  mode,
  childObjects,
  selectIndividual,
}: {
  group: MapGroup;
  selected: boolean;
  mode: TransformMode;
  childObjects: MapObject[];
  selectIndividual: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [gizmoTarget, setGizmoTarget] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.position.set(...group.position);
    g.rotation.set(...group.rotation);
    g.scale.set(...group.scale);
  }, [group.id, group.position, group.rotation, group.scale]);

  useLayoutEffect(() => {
    setGizmoTarget(selected && !selectIndividual ? groupRef.current : null);
  }, [selected, selectIndividual, group.id]);

  const sync = () => {
    const g = groupRef.current;
    if (!g) return;
    const t = vec3FromObject(g);
    mapEditorStore.syncGroupTransform(group.id, t.position, t.rotation, t.scale);
    const updated = mapEditorStore
      .getState()
      .document.groups.find((gr) => gr.id === group.id);
    if (updated) g.position.set(...updated.position);
  };

  const isStadium = Boolean(group.stadiumKey);

  return (
    <>
      <group ref={groupRef}>
        {isStadium && group.stadiumKey && (
          <>
            <StadiumGroupVisual stadiumKey={group.stadiumKey} />
            <StadiumGroupPickMesh
              stadiumKey={group.stadiumKey}
              selected={selected}
              onSelect={(id) => mapEditorStore.select(id)}
              groupId={group.id}
            />
          </>
        )}
        {!isStadium && (
          <mesh
            raycast={selected ? editorDisabledRaycast : undefined}
            onPointerDown={editorPickHandler(group.id)}
            onClick={editorPickHandler(group.id)}
          >
            <boxGeometry args={[2, 2, 2]} />
            <meshBasicMaterial
              color="#44ddff"
              wireframe
              transparent
              opacity={selected ? 0.45 : 0.12}
              depthTest={false}
            />
          </mesh>
        )}
        {childObjects.map((obj) => (
          <EditableGroupMember
            key={obj.id}
            object={obj}
            mode={mode}
          />
        ))}
      </group>
      {gizmoTarget && (
        <TransformGizmo target={gizmoTarget} mode={mode} onSync={sync} />
      )}
    </>
  );
}

function EditableGroupMember({
  object,
  mode,
}: {
  object: MapObject;
  mode: TransformMode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [gizmoTarget, setGizmoTarget] = useState<THREE.Object3D | null>(null);
  const editor = useSyncExternalStore(
    mapEditorStore.subscribe,
    () => mapEditorStore.getState(),
  );
  const isSelected =
    editor.selectIndividual && editor.selectedId === object.id;

  const meshData = useMemo(
    () => ({
      ...object,
      position: [0, 0, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
    }),
    [object.id, object.kind, object.textureId, object.color, object.name],
  );

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.position.set(...object.position);
    g.rotation.set(...object.rotation);
    g.scale.set(...object.scale);
  }, [object.id, object.position, object.rotation, object.scale]);

  useLayoutEffect(() => {
    setGizmoTarget(isSelected ? groupRef.current : null);
  }, [isSelected, object.id]);

  const sync = () => {
    const g = groupRef.current;
    if (!g) return;
    const t = vec3FromObject(g);
    mapEditorStore.syncObjectTransform(object.id, t.position, t.rotation, t.scale);
    const updated = mapEditorStore
      .getState()
      .document.objects.find((o) => o.id === object.id);
    if (updated) g.position.set(...updated.position);
  };

  return (
    <>
      <group ref={groupRef}>
        <MapObjectMesh
          object={meshData}
          selected={isSelected}
          pickEnabled={!isSelected}
          onSelect={() => mapEditorStore.select(object.id)}
        />
      </group>
      {gizmoTarget && (
        <TransformGizmo target={gizmoTarget} mode={mode} onSync={sync} />
      )}
    </>
  );
}

function EditableObject({
  object,
  selected,
  mode,
}: {
  object: MapObject;
  selected: boolean;
  mode: TransformMode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [gizmoTarget, setGizmoTarget] = useState<THREE.Object3D | null>(null);
  const meshData = useMemo(
    () => ({
      ...object,
      position: [0, 0, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
    }),
    [object.id, object.kind, object.textureId, object.color, object.name],
  );

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.position.set(...object.position);
    g.rotation.set(...object.rotation);
    g.scale.set(...object.scale);
  }, [object.id, object.position, object.rotation, object.scale]);

  useLayoutEffect(() => {
    setGizmoTarget(selected ? groupRef.current : null);
  }, [selected, object.id]);

  const sync = () => {
    const g = groupRef.current;
    if (!g) return;
    const t = vec3FromObject(g);
    mapEditorStore.syncObjectTransform(object.id, t.position, t.rotation, t.scale);
    const updated = mapEditorStore
      .getState()
      .document.objects.find((o) => o.id === object.id);
    if (updated) g.position.set(...updated.position);
  };

  return (
    <>
      <group ref={groupRef}>
        <MapObjectMesh
          object={meshData}
          selected={selected}
          pickEnabled={!selected}
          onSelect={() => mapEditorStore.select(object.id)}
        />
      </group>
      {gizmoTarget && (
        <TransformGizmo target={gizmoTarget} mode={mode} onSync={sync} />
      )}
    </>
  );
}

function EditableLight({
  light,
  selected,
  mode,
}: {
  light: MapLight;
  selected: boolean;
  mode: TransformMode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [gizmoTarget, setGizmoTarget] = useState<THREE.Object3D | null>(null);
  const rectBase = useRef({ w: light.rectWidth, h: light.rectHeight });

  useEffect(() => {
    rectBase.current = { w: light.rectWidth, h: light.rectHeight };
  }, [light.id, light.rectWidth, light.rectHeight]);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.position.set(...light.position);
    g.rotation.set(...light.rotation);
    g.scale.set(1, 1, 1);
  }, [light.id, light.position, light.rotation]);

  useLayoutEffect(() => {
    setGizmoTarget(selected ? groupRef.current : null);
  }, [selected, light.id]);

  const gizmoMode =
    light.kind === 'rectArea'
      ? mode
      : mode === 'scale'
        ? 'translate'
        : mode;

  const sync = () => {
    const g = groupRef.current;
    if (!g) return;

    if (light.kind === 'rectArea' && mode === 'scale') {
      const sx = g.scale.x;
      const sz = g.scale.z;
      if (Math.abs(sx - 1) > 0.002 || Math.abs(sz - 1) > 0.002) {
        mapEditorStore.syncLightRectSize(
          light.id,
          rectBase.current.w * sx,
          rectBase.current.h * sz,
        );
        g.scale.set(1, 1, 1);
        const updated = mapEditorStore
          .getState()
          .document.lights.find((l) => l.id === light.id);
        if (updated) {
          rectBase.current = { w: updated.rectWidth, h: updated.rectHeight };
        }
      }
    }

    mapEditorStore.syncLightTransform(
      light.id,
      [g.position.x, g.position.y, g.position.z],
      [g.rotation.x, g.rotation.y, g.rotation.z],
    );
    const updated = mapEditorStore
      .getState()
      .document.lights.find((l) => l.id === light.id);
    if (updated) g.position.set(...updated.position);
  };

  return (
    <>
      <group ref={groupRef}>
        <MapLightNode
          light={light}
          embedded
          castShadow={light.castShadow}
          selected={selected}
          pickEnabled={!selected}
          showGlow
          editorGlowPreview
          onSelect={() => mapEditorStore.select(light.id)}
        />
      </group>
      {gizmoTarget && (
        <TransformGizmo target={gizmoTarget} mode={gizmoMode} onSync={sync} />
      )}
    </>
  );
}

function EditorPlacedContent() {
  const editor = useSyncExternalStore(
    mapEditorStore.subscribe,
    () => mapEditorStore.getState(),
  );

  const rootObjects = editor.document.objects.filter((o) => !o.groupId);
  const objectsByGroup = useMemo(() => {
    const map = new Map<string, MapObject[]>();
    for (const obj of editor.document.objects) {
      if (!obj.groupId) continue;
      const list = map.get(obj.groupId) ?? [];
      list.push(obj);
      map.set(obj.groupId, list);
    }
    return map;
  }, [editor.document.objects]);

  return (
    <>
      {editor.document.groups.map((group) => (
        <EditableGroup
          key={group.id}
          group={group}
          selected={editor.selectedId === group.id}
          mode={editor.transformMode}
          childObjects={objectsByGroup.get(group.id) ?? []}
          selectIndividual={editor.selectIndividual}
        />
      ))}
      {rootObjects.map((obj) => (
        <EditableObject
          key={obj.id}
          object={obj}
          selected={editor.selectedId === obj.id}
          mode={editor.transformMode}
        />
      ))}
      {editor.document.lights.map((light) => (
        <EditableLight
          key={light.id}
          light={light}
          selected={editor.selectedId === light.id}
          mode={editor.transformMode}
        />
      ))}
    </>
  );
}

function EditorControls({
  orbitRef,
}: {
  orbitRef: React.RefObject<React.ComponentRef<typeof OrbitControls> | null>;
}) {
  useEffect(() => {
    registerEditorOrbitControls(orbitRef);
    return () => registerEditorOrbitControls(
      { current: null } as React.RefObject<React.ComponentRef<typeof OrbitControls> | null>,
    );
  }, [orbitRef]);

  useEffect(() => {
    const unlock = () => forceUnlockEditorOrbit();
    window.addEventListener('pointerup', unlock);
    window.addEventListener('pointercancel', unlock);
    window.addEventListener('blur', unlock);
    return () => {
      window.removeEventListener('pointerup', unlock);
      window.removeEventListener('pointercancel', unlock);
      window.removeEventListener('blur', unlock);
    };
  }, []);

  return (
    <OrbitControls
      ref={orbitRef}
      makeDefault
      enableDamping
      dampingFactor={0.06}
      rotateSpeed={0.85}
      panSpeed={1.4}
      zoomSpeed={1.2}
      minDistance={6}
      maxDistance={170}
      maxPolarAngle={Math.PI * 0.495}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
    />
  );
}

function EditorSceneContent() {
  const orbitRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const editor = useSyncExternalStore(
    mapEditorStore.subscribe,
    () => mapEditorStore.getState(),
  );
  const { hiddenGoalIds, hiddenPillarIndices, hiddenPlatformIndices } = useMemo(
    () => getHiddenStadiumPieces(editor.document.groups),
    [editor.document.groups],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      const stadiumId = stadiumLightStore.getState().selectedId;
      if (stadiumId) {
        if (e.key === 'g' || e.key === 'G') stadiumLightStore.setGizmoMode('translate');
        if (e.key === 'r' || e.key === 'R') stadiumLightStore.setGizmoMode('rotate');
        if (e.key === 's' || e.key === 'S') stadiumLightStore.setGizmoMode('scale');
        if (e.key === 'Delete' || e.key === 'Backspace') {
          stadiumLightStore.deleteSelected();
        }
        return;
      }
      if (e.key === 'g' || e.key === 'G') mapEditorStore.setTransformMode('translate');
      if (e.key === 'r' || e.key === 'R') mapEditorStore.setTransformMode('rotate');
      if (e.key === 's' || e.key === 'S') mapEditorStore.setTransformMode('scale');
      if (e.key === 'Delete' || e.key === 'Backspace') mapEditorStore.deleteSelected();
      if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        mapEditorStore.duplicateSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <EditorOrbitContext.Provider value={orbitRef}>
      <EditorBackdrop
        hiddenGoalIds={hiddenGoalIds}
        hiddenPillarIndices={hiddenPillarIndices}
        hiddenPlatformIndices={hiddenPlatformIndices}
      />
      <EditorMoveGrid visible={editor.showMoveGrid} />
      <EditorPlacedContent />
      <EditorControls orbitRef={orbitRef} />
    </EditorOrbitContext.Provider>
  );
}

export function MapEditorCanvas() {
  return (
    <div className="map-editor-canvas-host">
      <Canvas
        className="map-editor-canvas"
        shadows={false}
        dpr={[1, 1.25]}
        frameloop="always"
        camera={{ position: [0, 24, 44], fov: 58, near: 0.5, far: 320 }}
        gl={{ antialias: RENDER.antialias, alpha: false, powerPreference: 'high-performance' }}
        onPointerMissed={() => {
          if (mapEditorStore.shouldSuppressPointerMiss()) return;
          mapEditorStore.select(null);
          stadiumLightStore.deselect();
        }}
      >
        <color attach="background" args={['#3a4a62']} />
        <fog attach="fog" args={['#3a4a62', 90, 240]} />
        <MapEditorSceneSetup />
        <Physics gravity={[0, -9.81, 0]} timeStep={1 / 60}>
          <EditorSceneContent />
        </Physics>
      </Canvas>
    </div>
  );
}
