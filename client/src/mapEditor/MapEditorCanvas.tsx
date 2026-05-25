import { OrbitControls, TransformControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
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
import { EditorOrbitContext, useEditorOrbit } from './EditorOrbitContext';
import { MapLightNode, MapObjectMesh } from './MapObjectMesh';
import { mapEditorStore } from './mapEditorStore';
import type { MapGroup, MapLight, MapObject, TransformMode } from './mapEditorTypes';
import { getHiddenStadiumPieces } from './stadiumLayout';
import { EditorMoveGrid } from './editorMoveGrid';
import { EditorBaseArena, StadiumGroupPickMesh, StadiumGroupVisual } from './StadiumGroupLayer';

const EditorBackdrop = memo(function EditorBackdrop({
  hiddenGoalIds,
  hiddenPillarIndices,
}: {
  hiddenGoalIds: string[];
  hiddenPillarIndices: number[];
}) {
  return (
    <>
      <color attach="background" args={['#3a4a62']} />
      <fog attach="fog" args={['#3a4a62', 90, 240]} />
      <EditorBaseArena
        hiddenGoalIds={hiddenGoalIds}
        hiddenPillarIndices={hiddenPillarIndices}
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
  const orbitRef = useEditorOrbit();
  return useCallback(
    (dragging: boolean) => {
      if (orbitRef?.current) orbitRef.current.enabled = !dragging;
    },
    [orbitRef],
  );
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
  const handler = (event: { value: boolean }) => lockOrbit(event.value);
  node.addEventListener('dragging-changed', handler);
  return () => node.removeEventListener('dragging-changed', handler);
}

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
      onObjectChange={onSync}
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
            onPointerDown={(e) => {
              e.stopPropagation();
              mapEditorStore.select(group.id);
            }}
            onClick={(e) => {
              e.stopPropagation();
              mapEditorStore.select(group.id);
            }}
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

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.position.set(...light.position);
    g.rotation.set(...light.rotation);
  }, [light.id, light.position, light.rotation]);

  useLayoutEffect(() => {
    setGizmoTarget(selected ? groupRef.current : null);
  }, [selected, light.id]);

  const sync = () => {
    const g = groupRef.current;
    if (!g) return;
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
          castShadow={false}
          selected={selected}
          onSelect={() => mapEditorStore.select(light.id)}
        />
      </group>
      {gizmoTarget && (
        <TransformGizmo
          target={gizmoTarget}
          mode={mode === 'scale' ? 'translate' : mode}
          onSync={sync}
        />
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
  const { hiddenGoalIds, hiddenPillarIndices } = useMemo(
    () => getHiddenStadiumPieces(editor.document.groups),
    [editor.document.groups],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
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
      />
      <EditorMoveGrid visible={editor.showMoveGrid} />
      <EditorPlacedContent />
      <EditorControls orbitRef={orbitRef} />
    </EditorOrbitContext.Provider>
  );
}

export function MapEditorCanvas() {
  return (
    <Canvas
      shadows={false}
      dpr={[1, 1.25]}
      camera={{ position: [0, 24, 44], fov: 58, near: 0.5, far: 320 }}
      gl={{ antialias: RENDER.antialias, powerPreference: 'high-performance' }}
      onPointerMissed={() => {
        if (mapEditorStore.shouldSuppressPointerMiss()) return;
        mapEditorStore.select(null);
      }}
    >
      <EditorSceneContent />
    </Canvas>
  );
}
