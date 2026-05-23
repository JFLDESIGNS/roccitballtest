import { useMemo } from 'react';
import { ARENA } from '../shared/Constants';
import { getBallDropLayout } from './arenaLayout';

const DROP_COLOR = '#0a0a0f';
const RING_COLOR = '#55ccff';

/** Black drop cylinder high above center platform with a ring of lights */
export function BallDrop() {
  const { centerY } = useMemo(() => getBallDropLayout(), []);
  const r = ARENA.ballDropCylinderRadius;
  const h = ARENA.ballDropCylinderHeight;
  const lightR = ARENA.ballDropLightRadius;
  const lightCount = ARENA.ballDropLightCount;

  const ringLights = useMemo(
    () =>
      Array.from({ length: lightCount }, (_, i) => {
        const a = (i / lightCount) * Math.PI * 2;
        return {
          x: Math.sin(a) * lightR,
          z: Math.cos(a) * lightR,
          yMid: 0,
          yTop: h * 0.38,
          key: i,
        };
      }),
    [h, lightCount, lightR],
  );

  return (
    <group position={[0, centerY, 0]}>
      <mesh>
        <cylinderGeometry args={[r, r, h, 20, 1, true]} />
        <meshStandardMaterial
          color={DROP_COLOR}
          emissive="#111118"
          emissiveIntensity={0.15}
          metalness={0.72}
          roughness={0.35}
        />
      </mesh>

      <mesh position={[0, h * 0.42, 0]}>
        <torusGeometry args={[lightR, 0.11, 10, 32]} />
        <meshStandardMaterial
          color={RING_COLOR}
          emissive={RING_COLOR}
          emissiveIntensity={2.4}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, -h * 0.3, 0]}>
        <torusGeometry args={[lightR * 0.9, 0.09, 8, 28]} />
        <meshStandardMaterial
          color="#3388ff"
          emissive="#2288ee"
          emissiveIntensity={1.7}
          toneMapped={false}
        />
      </mesh>

      {ringLights.map((slot) => (
        <group key={slot.key}>
          <pointLight
            position={[slot.x, slot.yMid, slot.z]}
            color={RING_COLOR}
            intensity={2.2}
            distance={16}
            decay={2}
          />
          <pointLight
            position={[slot.x, slot.yTop, slot.z]}
            color="#88eeff"
            intensity={1.4}
            distance={12}
            decay={2}
          />
        </group>
      ))}

      <pointLight
        position={[0, 0, 0]}
        color="#aaddff"
        intensity={2}
        distance={18}
        decay={2}
      />
    </group>
  );
}
