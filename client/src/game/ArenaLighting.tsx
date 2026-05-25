import { useMemo } from 'react';
import { useSyncExternalStore } from 'react';
import { ARENA, RENDER } from '../shared/Constants';
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
      shadow-bias={-0.00022}
      shadow-normalBias={0.012}
      shadow-radius={RENDER.shadowRadius}
    />
  );
}

type CourtLightSpec = {
  pos: [number, number, number];
  color: string;
  intensity: number;
  distance: number;
};

/** Real point lights over the court — no shadow maps */
function ArenaCourtFillLights({ brightness }: { brightness: number }) {
  const lights = useMemo((): CourtLightSpec[] => {
    const cornerR = ARENA.hexRadius * 0.5;
    const courtY = ARENA.platformTopHeight + 8.5;
    const midY = ARENA.platformTopHeight + 14;
    const highY = ARENA.platformTopHeight + 20;
    return [
      { pos: [cornerR, courtY, cornerR], color: '#dce8ff', intensity: 52, distance: 92 },
      { pos: [-cornerR, courtY, cornerR], color: '#dce8ff', intensity: 52, distance: 92 },
      { pos: [cornerR, courtY, -cornerR], color: '#dce8ff', intensity: 52, distance: 92 },
      { pos: [-cornerR, courtY, -cornerR], color: '#dce8ff', intensity: 52, distance: 92 },
      { pos: [0, highY, 0], color: '#fff0d8', intensity: 78, distance: 118 },
      { pos: [0, midY, 34], color: '#c8ddff', intensity: 44, distance: 78 },
      { pos: [0, midY, -34], color: '#c8ddff', intensity: 44, distance: 78 },
      { pos: [44, midY, 0], color: '#f0dcc8', intensity: 40, distance: 74 },
      { pos: [-44, midY, 0], color: '#f0dcc8', intensity: 40, distance: 74 },
      { pos: [0, courtY + 2, 52], color: '#ffe8c8', intensity: 36, distance: 68 },
      { pos: [0, courtY + 2, -52], color: '#ffe8c8', intensity: 36, distance: 68 },
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
      <hemisphereLight args={['#d4e4f8', '#6e808e', 1.12 * b]} />
      <ambientLight intensity={0.52 * b} color="#eef2fa" />
      <SunLight shadows={gfx.shadows} intensity={1.75 * b} />
      <directionalLight
        position={[-32, 26, -26]}
        intensity={0.38 * b}
        color="#9eb8d8"
      />
      <directionalLight
        position={[14, 30, 46]}
        intensity={0.52 * b}
        color="#e4eeff"
      />
      <directionalLight
        position={[-22, 18, -44]}
        intensity={0.34 * b}
        color="#ffd4a8"
      />
      <pointLight
        position={[0, 18, 0]}
        color="#ffcc88"
        intensity={76 * b}
        distance={112}
        decay={2}
      />
      <pointLight
        position={[40, 12, -30]}
        color="#ffe0a8"
        intensity={48 * b}
        distance={86}
        decay={2}
      />
      <pointLight
        position={[-38, 10, 28]}
        color="#f0b888"
        intensity={42 * b}
        distance={80}
        decay={2}
      />
      <ArenaCourtFillLights brightness={b} />
    </>
  );
}
