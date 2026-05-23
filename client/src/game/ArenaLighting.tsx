import { useSyncExternalStore } from 'react';
import { RENDER } from '../shared/Constants';
import { graphicsStore } from './graphicsStore';

const span = RENDER.shadowCameraSpan;

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
        position={[38, 62, 24]}
        intensity={intensity}
        color="#fff6e8"
      />
    );
  }
  return (
    <directionalLight
      position={[38, 62, 24]}
      intensity={intensity}
      color="#fff6e8"
      castShadow
      shadow-mapSize={[RENDER.shadowMapSize, RENDER.shadowMapSize]}
      shadow-camera-left={-span}
      shadow-camera-right={span}
      shadow-camera-top={span}
      shadow-camera-bottom={-span}
      shadow-camera-near={4}
      shadow-camera-far={RENDER.shadowCameraFar}
      shadow-bias={-0.00018}
      shadow-normalBias={0.018}
      shadow-radius={RENDER.shadowRadius}
    />
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
      <hemisphereLight args={['#d4e4f8', '#6e808e', 1.05 * b]} />
      <ambientLight intensity={0.48 * b} color="#eef2fa" />
      <SunLight shadows={gfx.shadows} intensity={1.75 * b} />
      <directionalLight
        position={[-32, 26, -26]}
        intensity={0.32 * b}
        color="#9eb8d8"
      />
      <pointLight
        position={[0, 18, 0]}
        color="#ffcc88"
        intensity={68 * b}
        distance={105}
        decay={2}
      />
      <pointLight
        position={[40, 12, -30]}
        color="#ffe0a8"
        intensity={42 * b}
        distance={78}
        decay={2}
      />
      <pointLight
        position={[-38, 10, 28]}
        color="#f0b888"
        intensity={36 * b}
        distance={72}
        decay={2}
      />
    </>
  );
}
