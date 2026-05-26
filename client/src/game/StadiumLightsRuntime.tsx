import { TransformControls } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import { useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { mapEditorSession } from '../mapEditor/mapEditorSession';
import { gameStore } from './gameStore';
import { graphicsStore } from './graphicsStore';
import { arenaRoofStore } from './arenaRoofStore';
import { initStadiumRectAreaLights } from './stadiumRectAreaLightInit';
import { stadiumLightPickRegistry } from './stadiumLightPickRegistry';
import { StadiumLightPicking } from './StadiumLightPicking';
import { stadiumLightStore } from './stadiumLightStore';
import type { StadiumLightDef, StadiumLightKind } from './stadiumLightTypes';
import {
  keyLightPointIntensityFromMenu,
  keyLightRectIntensityFromMenu,
} from './ArenaStadiumKeyLights';

const POINT_SHADOW = {
  'shadow-mapSize': [1024, 1024] as [number, number],
  'shadow-bias': -0.0003,
  'shadow-normalBias': 0.018,
} as const;

const DIR_SHADOW = {
  'shadow-mapSize': [1024, 1024] as [number, number],
  'shadow-camera-far': 130,
  'shadow-camera-left': -68,
  'shadow-camera-right': 68,
  'shadow-camera-top': 68,
  'shadow-camera-bottom': -68,
  'shadow-bias': -0.00035,
  'shadow-normalBias': 0.025,
} as const;

const WIRE_COLORS: Record<StadiumLightKind, string> = {
  point: '#88ffcc',
  spot: '#ffcc66',
  directional: '#fff4ea',
  rectArea: '#ffb86a',
};

function computeIntensity(
  light: StadiumLightDef,
  arenaBrightness: number,
  roofOpen: number,
  stripWidthM: number,
  stripIntensity: number,
): number {
  const b = arenaBrightness;
  if (light.brightnessMenuKey === 'keyLight2') {
    const bright = graphicsStore.getState().keyLight2Brightness;
    return light.kind === 'rectArea'
      ? keyLightRectIntensityFromMenu(bright, b)
      : keyLightPointIntensityFromMenu(bright, b);
  }
  if (light.brightnessMenuKey === 'keyLight3') {
    const bright = graphicsStore.getState().keyLight3Brightness;
    return light.kind === 'rectArea'
      ? keyLightRectIntensityFromMenu(bright, b)
      : keyLightPointIntensityFromMenu(bright, b);
  }
  if (light.stripMenu) {
    if (roofOpen < 0.01) return 0;
    return (
      stripIntensity *
      roofOpen *
      0.92 *
      Math.sqrt(stripWidthM / 42) *
      40 *
      light.intensity
    );
  }
  if (light.roofGated) return light.intensity * b * roofOpen;
  return light.intensity * b;
}

function computeCastShadow(
  light: StadiumLightDef,
  shadowsOn: boolean,
): boolean {
  if (!shadowsOn || !light.castShadow) return false;
  if (light.brightnessMenuKey === 'keyLight2') {
    return graphicsStore.getState().keyLight2CastShadow;
  }
  if (light.brightnessMenuKey === 'keyLight3') {
    return graphicsStore.getState().keyLight3CastShadow;
  }
  return true;
}

function readLightColor(light: StadiumLightDef): string {
  if (light.brightnessMenuKey === 'keyLight2') {
    return graphicsStore.getState().keyLight2Color;
  }
  if (light.brightnessMenuKey === 'keyLight3') {
    return graphicsStore.getState().keyLight3Color;
  }
  return light.color;
}

function LightWireframe({
  light,
  selected,
  visible,
}: {
  light: StadiumLightDef;
  selected: boolean;
  visible: boolean;
}) {
  const color = selected ? '#ffff44' : WIRE_COLORS[light.kind];
  const opacity = selected ? 0.95 : 0.55;

  if (!visible) return null;

  if (light.kind === 'rectArea') {
    const w = light.rectWidth ?? 20;
    const h = light.rectHeight ?? 20;
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={200}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial
          color={color}
          wireframe
          transparent
          opacity={opacity}
          depthWrite={false}
        />
      </mesh>
    );
  }

  if (light.kind === 'directional') {
    return (
      <group>
        <mesh renderOrder={201}>
          <boxGeometry args={[1.4, 1.4, 1.4]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={opacity} />
        </mesh>
        <mesh position={[0, -3, 0]} rotation={[0, 0, 0]} renderOrder={201}>
          <coneGeometry args={[1.2, 5, 8, 1, true]} />
          <meshBasicMaterial
            color={color}
            wireframe
            transparent
            opacity={opacity * 0.6}
            depthWrite={false}
          />
        </mesh>
      </group>
    );
  }

  if (light.kind === 'spot') {
    const len = light.distance ?? 40;
    return (
      <group>
        <mesh renderOrder={201}>
          <sphereGeometry args={[0.5, 10, 8]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={opacity} />
        </mesh>
        <mesh position={[0, -len * 0.35, 0]} renderOrder={201}>
          <coneGeometry args={[1.8, len * 0.65, 10, 1, true]} />
          <meshBasicMaterial
            color={color}
            wireframe
            transparent
            opacity={opacity * 0.5}
            depthWrite={false}
          />
        </mesh>
      </group>
    );
  }

  const r = Math.min(8, (light.distance ?? 40) * 0.12);
  return (
    <mesh renderOrder={201}>
      <sphereGeometry args={[r, 12, 10]} />
      <meshBasicMaterial
        color={color}
        wireframe
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </mesh>
  );
}

type DraggingControls = {
  addEventListener(type: 'dragging-changed', listener: (e: { value: boolean }) => void): void;
  removeEventListener(type: 'dragging-changed', listener: (e: { value: boolean }) => void): void;
};

function scalePatchFromGizmo(
  target: THREE.Object3D,
  light: StadiumLightDef,
): Partial<StadiumLightDef> | undefined {
  const sx = target.scale.x;
  const sy = target.scale.y;
  const sz = target.scale.z;
  if (
    Math.abs(sx - 1) < 0.002 &&
    Math.abs(sy - 1) < 0.002 &&
    Math.abs(sz - 1) < 0.002
  ) {
    return undefined;
  }
  target.scale.set(1, 1, 1);
  if (light.kind === 'rectArea') {
    return {
      rectWidth: Math.max(1, (light.rectWidth ?? 20) * sx),
      rectHeight: Math.max(1, (light.rectHeight ?? 20) * sy),
    };
  }
  if (light.kind === 'point' || light.kind === 'spot') {
    const s = (sx + sy + sz) / 3;
    return { distance: Math.max(1, (light.distance ?? 80) * s) };
  }
  const s = (sx + sy + sz) / 3;
  return { intensity: Math.max(0.01, light.intensity * s) };
}

function LightGizmo({
  target,
  light,
}: {
  target: THREE.Object3D;
  light: StadiumLightDef;
}) {
  const tcRef = useRef<ComponentRef<typeof TransformControls>>(null);
  const gizmoMode = useSyncExternalStore(
    stadiumLightStore.subscribe,
    () => stadiumLightStore.getState().gizmoMode,
  );

  useLayoutEffect(() => {
    const ctrl = tcRef.current as unknown as DraggingControls | null;
    if (!ctrl) return;
    const handler = (e: { value: boolean }) => {
      stadiumLightStore.setGizmoDragging(e.value);
    };
    ctrl.addEventListener('dragging-changed', handler);
    return () => ctrl.removeEventListener('dragging-changed', handler);
  }, [target, light.id]);

  const sync = () => {
    const current =
      stadiumLightStore.getState().lights.find((l) => l.id === light.id) ??
      light;
    const position: [number, number, number] = [
      target.position.x,
      target.position.y,
      target.position.z,
    ];
    const rotation: [number, number, number] = [
      target.rotation.x,
      target.rotation.y,
      target.rotation.z,
    ];
    const extra =
      gizmoMode === 'scale' ? scalePatchFromGizmo(target, current) : undefined;
    stadiumLightStore.updateTransform(light.id, position, rotation, extra);
  };

  return (
    <TransformControls
      ref={tcRef}
      object={target}
      mode={gizmoMode}
      onObjectChange={sync}
      onMouseUp={sync}
    />
  );
}

function StadiumLightNode({
  light,
  selected,
  editorMode,
  showWireframes,
}: {
  light: StadiumLightDef;
  selected: boolean;
  editorMode: boolean;
  showWireframes: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const pickRef = useRef<THREE.Mesh>(null);
  const [gizmoTarget, setGizmoTarget] = useState<THREE.Object3D | null>(null);
  const pointRef = useRef<THREE.PointLight>(null);
  const spotRef = useRef<THREE.SpotLight>(null);
  const dirRef = useRef<THREE.DirectionalLight>(null);
  const rectRef = useRef<THREE.RectAreaLight>(null);
  const castShadowRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (stadiumLightStore.getState().gizmoDragging) return;
    const g = groupRef.current;
    if (!g) return;
    g.position.set(...light.position);
    g.rotation.set(...light.rotation);
    g.scale.set(1, 1, 1);
  }, [light.id, light.position, light.rotation, light.rectWidth, light.rectHeight, light.distance]);

  useLayoutEffect(() => {
    setGizmoTarget(selected && editorMode ? groupRef.current : null);
  }, [selected, editorMode, light.id, light.position]);

  useLayoutEffect(() => {
    if (light.kind === 'rectArea') initStadiumRectAreaLights();
  }, [light.kind]);

  useLayoutEffect(() => {
    const mesh = pickRef.current;
    if (!mesh || !editorMode) return;
    mesh.userData.stadiumLightId = light.id;
    stadiumLightPickRegistry.register(mesh);
    return () => stadiumLightPickRegistry.unregister(mesh);
  }, [editorMode, light.id]);

  useFrame(() => {
    if (!light.enabled) return;
    const gfx = graphicsStore.getState();
    const roofOpen = arenaRoofStore.getState().open;
    const stripWidthM = (gfx.stadiumStripPlaneWidthFt ?? 150) * 0.3048;
    const intensity = computeIntensity(
      light,
      gfx.arenaBrightness ?? 1,
      roofOpen,
      stripWidthM,
      gfx.stadiumStripLightIntensity ?? 5,
    );
    const col = readLightColor(light);
    const shadow = computeCastShadow(light, gfx.shadows);
    if (castShadowRef.current !== shadow) {
      castShadowRef.current = shadow;
      const point = pointRef.current;
      if (point) point.castShadow = shadow;
      const spot = spotRef.current;
      if (spot) spot.castShadow = shadow;
      const dir = dirRef.current;
      if (dir) dir.castShadow = shadow;
    }

    const point = pointRef.current;
    if (point) {
      point.intensity = intensity;
      point.color.set(col);
    }
    const spot = spotRef.current;
    if (spot) {
      spot.intensity = intensity;
      spot.color.set(col);
    }
    const dir = dirRef.current;
    if (dir) {
      dir.intensity = intensity;
      dir.color.set(col);
    }
    const rect = rectRef.current;
    if (rect) {
      rect.intensity = intensity;
      rect.color.set(col);
    }
  });

  if (!light.enabled) return null;

  const pickSize =
    light.kind === 'rectArea'
      ? Math.max(light.rectWidth ?? 20, light.rectHeight ?? 20) * 0.55
      : light.kind === 'directional'
        ? 4
        : light.kind === 'spot'
          ? 3.2
          : 2.8;

  return (
    <>
      <group ref={groupRef}>
        {light.kind === 'point' && (
          <pointLight
            ref={pointRef}
            name={light.name}
            color={light.color}
            intensity={0}
            distance={light.distance ?? 80}
            decay={light.decay ?? 1.2}
            castShadow={false}
            {...POINT_SHADOW}
          />
        )}
        {light.kind === 'spot' && (
          <spotLight
            ref={spotRef}
            name={light.name}
            color={light.color}
            intensity={0}
            distance={light.distance ?? 80}
            angle={light.angle ?? 0.6}
            penumbra={light.penumbra ?? 0.4}
            castShadow={false}
            {...POINT_SHADOW}
          />
        )}
        {light.kind === 'directional' && (
          <directionalLight
            ref={dirRef}
            name={light.name}
            color={light.color}
            intensity={0}
            castShadow={light.castShadow}
            {...DIR_SHADOW}
          />
        )}
        {light.kind === 'rectArea' && (
          <rectAreaLight
            ref={rectRef}
            name={light.name}
            width={light.rectWidth ?? 20}
            height={light.rectHeight ?? 20}
            color={light.color}
            intensity={0}
          />
        )}

        {editorMode && showWireframes && (
          <LightWireframe light={light} selected={selected} visible />
        )}

        {editorMode && (
          <mesh ref={pickRef}>
            <sphereGeometry args={[pickSize, 10, 8]} />
            <meshBasicMaterial
              visible={false}
              color={selected ? '#ffff44' : '#ffffff'}
              transparent
              opacity={0}
              depthWrite={false}
            />
          </mesh>
        )}
      </group>
      {gizmoTarget && editorMode && selected && (
        <LightGizmo target={gizmoTarget} light={light} />
      )}
    </>
  );
}

/** All editable stadium lights — runtime + fly-mode editor */
export function StadiumLightsRuntime() {
  const debugFly = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().debugFreelook,
  );
  const mapEditorActive = useSyncExternalStore(
    mapEditorSession.subscribe,
    mapEditorSession.isActive,
  );
  const lightState = useSyncExternalStore(
    stadiumLightStore.subscribe,
    stadiumLightStore.getState,
  );
  const [wireframesReady, setWireframesReady] = useState(false);

  const stadiumEditMode = debugFly || mapEditorActive;

  useEffect(() => {
    if (!stadiumEditMode) {
      setWireframesReady(false);
      return;
    }
    const id = requestAnimationFrame(() => setWireframesReady(true));
    return () => cancelAnimationFrame(id);
  }, [stadiumEditMode]);

  const { lights, selectedId, showWireframes } = lightState;
  const editorMode = stadiumEditMode;
  const wireVisible =
    editorMode &&
    (mapEditorActive || (wireframesReady && showWireframes));

  return (
    <>
      {debugFly && <StadiumLightPicking />}
      {lights.map((light) => (
        <StadiumLightNode
          key={light.id}
          light={light}
          selected={selectedId === light.id}
          editorMode={editorMode}
          showWireframes={wireVisible}
        />
      ))}
    </>
  );
}
