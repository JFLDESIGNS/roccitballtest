import { useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { graphicsStore } from './graphicsStore';
import { StadiumLightsRuntime } from './StadiumLightsRuntime';

/** Neutral indoor bounce — avoid blue/cyan fill */
const INDOOR_HEMI_SKY = '#8a9199';
const INDOOR_HEMI_GROUND = '#1c2229';

export function ArenaLighting() {
  const gfx = useSyncExternalStore(
    graphicsStore.subscribe,
    graphicsStore.getState,
  );
  const b = gfx.arenaBrightness ?? 1;

  const hemiSky = INDOOR_HEMI_SKY;
  const hemiIntensity = (gfx.badPuter ? 1.1 : 0.24) * b;
  const ambIntensity = (gfx.badPuter ? 0.52 : 0.058) * b;

  return (
    <>
      <hemisphereLight
        args={[hemiSky, INDOOR_HEMI_GROUND, hemiIntensity]}
        position={[0, 40, 0]}
      />
      <ambientLight
        intensity={ambIntensity}
        color={new THREE.Color('#7a756c')}
      />
      <StadiumLightsRuntime />
    </>
  );
}
