import { useMemo } from 'react';
import { useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { ARENA, RENDER } from '../shared/Constants';
import { graphicsStore } from './graphicsStore';

const span = RENDER.shadowCameraSpan;
/** Sun directly above arena center */
const SUN_POSITION: [number, number, number] = [0, 86, 0];
const SUN_TARGET_Y = ARENA.platformTopHeight + 0.5;

function SunLight({
  shadows,
  intensity,
}: {
  shadows: boolean;
  intensity: number;
}) {
  if (!shadows) {
    return (
      <directionalLight
        position={SUN_POSITION}
        intensity={intensity}
        color="#fff0d4"
      >
        <object3D attach="target" position={[0, SUN_TARGET_Y, 0]} />
      </directionalLight>
    );
  }
  return (
    <directionalLight
      position={SUN_POSITION}
      intensity={intensity}
      color="#fff0d4"
      castShadow
      shadow-mapSize={[RENDER.shadowMapSize, RENDER.shadowMapSize]}
      shadow-camera-left={-span}
      shadow-camera-right={span}
      shadow-camera-top={span}
      shadow-camera-bottom={-span}
      shadow-camera-near={4}
      shadow-camera-far={RENDER.shadowCameraFar}
      shadow-bias={-0.00022}
      shadow-normalBias={0.012}
      shadow-radius={RENDER.shadowRadius}
    >
      <object3D attach="target" position={[0, SUN_TARGET_Y, 0]} />
    </directionalLight>
  );
}

type CourtLightSpec = {
  pos: [number, number, number];
  color: string;
  intensity: number;
  distance: number;
};

/** Soft fill around the court — kept low so sun shadows read clearly */
function ArenaCourtFillLights({ brightness }: { brightness: number }) {
  const lights = useMemo((): CourtLightSpec[] => {
    const cornerR = ARENA.hexRadius * 0.5;
    const courtY = ARENA.platformTopHeight + 8.5;
    const midY = ARENA.platformTopHeight + 14;
    return [
      { pos: [cornerR, courtY, cornerR], color: '#c8d8f0', intensity: 38, distance: 88 },
      { pos: [-cornerR, courtY, cornerR], color: '#c8d8f0', intensity: 38, distance: 88 },
      { pos: [cornerR, courtY, -cornerR], color: '#c8d8f0', intensity: 38, distance: 88 },
      { pos: [-cornerR, courtY, -cornerR], color: '#c8d8f0', intensity: 38, distance: 88 },
      { pos: [0, midY, 34], color: '#a8c0e0', intensity: 28, distance: 72 },
      { pos: [0, midY, -34], color: '#a8c0e0', intensity: 28, distance: 72 },
      { pos: [44, midY, 0], color: '#b8cce8', intensity: 26, distance: 70 },
      { pos: [-44, midY, 0], color: '#b8cce8', intensity: 26, distance: 70 },
    ];
  }, []);

  return (
    <>
      {lights.map((l, i) => (
        <pointLight
          key={`court-fill-${i}`}
          position={l.pos}
          color={l.color}
          intensity={l.intensity * brightness}
          distance={l.distance}
          decay={2}
        />
      ))}
    </>
  );
}

export function ArenaLighting() {
  const gfx = useSyncExternalStore(
    graphicsStore.subscribe,
    graphicsStore.getState,
  );
  const b = gfx.arenaBrightness ?? 1.35;

  return (
    <>
      <hemisphereLight
        args={['#fff6e8', '#4a5c72', 0.92 * b]}
        position={[0, 40, 0]}
      />
      <ambientLight intensity={0.34 * b} color="#b8c8dc" />
      <SunLight shadows={gfx.shadows} intensity={2.05 * b} />
      <directionalLight
        position={[18, 28, -22]}
        intensity={0.22 * b}
        color="#88a8c8"
      />
      <directionalLight
        position={[-24, 20, 30]}
        intensity={0.18 * b}
        color="#7a9ab8"
      />
      <ArenaCourtFillLights brightness={b} />
    </>
  );
}

/** World position of the main sun (lens flare / debug) */
export const ARENA_SUN_POSITION = new THREE.Vector3(...SUN_POSITION);
