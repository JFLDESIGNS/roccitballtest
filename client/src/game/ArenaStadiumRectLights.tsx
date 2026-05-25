import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { ARENA } from '../shared/Constants';
import { arenaRoofStore } from './arenaRoofStore';
import { graphicsStore } from './graphicsStore';

const FT = 0.3048;
/** Height above platform deck */
const STRIP_HEIGHT_FT = 132;
/** Neutral ceiling fill — avoids blue wash on the concrete floor */
const STRIP_COLOR = '#f0f2f4';
const BRIGHTNESS_MUL = 0.92;
/** Long edge goal-to-goal (world X) */
const stripLengthM = ARENA.hexRadius * 2.45;
const stripYM = ARENA.platformTopHeight + STRIP_HEIGHT_FT * FT;

/** Point lights along each strip — avoids RectAreaLight shader cost on every mesh */
function CeilingStrip({
  z,
  stripWidthM,
}: {
  z: number;
  stripWidthM: number;
}) {
  const lightsRef = useRef<(THREE.PointLight | null)[]>([]);
  const xs = useMemo(
    () => [-stripLengthM * 0.32, 0, stripLengthM * 0.32],
    [],
  );

  useFrame(() => {
    const open = arenaRoofStore.getState().open;
    const base = graphicsStore.getState().stadiumStripLightIntensity ?? 5;
    const k =
      open < 0.01
        ? 0
        : base * open * BRIGHTNESS_MUL * Math.sqrt(stripWidthM / 42) * 95;
    for (const light of lightsRef.current) {
      if (light) light.intensity = k;
    }
  });

  return (
    <group>
      {xs.map((x, i) => (
        <pointLight
          key={`strip-light-${z}-${i}`}
          ref={(el) => {
            lightsRef.current[i] = el;
          }}
          position={[x, stripYM, z]}
          color={STRIP_COLOR}
          intensity={0}
          distance={stripYM * 2.6}
          decay={1.6}
          castShadow={false}
        />
      ))}
    </group>
  );
}

export function ArenaStadiumRectLights() {
  const gfx = useSyncExternalStore(
    graphicsStore.subscribe,
    graphicsStore.getState,
  );

  const stripGapM = (gfx.stadiumStripGapFt ?? 34) * FT;
  const stripWidthM = (gfx.stadiumStripPlaneWidthFt ?? 150) * FT;
  const centerOffsetZ = stripGapM * 0.5 + stripWidthM * 0.5;
  const strips = useMemo(
    () => [{ z: -centerOffsetZ }, { z: centerOffsetZ }],
    [centerOffsetZ],
  );

  return (
    <group>
      {strips.map((s, i) => (
        <CeilingStrip
          key={`strip-${i}-${centerOffsetZ.toFixed(2)}-${stripWidthM.toFixed(2)}`}
          z={s.z}
          stripWidthM={stripWidthM}
        />
      ))}
    </group>
  );
}
