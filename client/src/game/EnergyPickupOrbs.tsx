import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import {
  ENERGY_ORB_LAYOUT,
  isEnergyOrbReady,
  tickEnergyOrbs,
} from './energyOrbStore';

export function EnergyPickupOrbs() {
  const refs = useRef<Array<THREE.Group | null>>([]);

  useFrame(({ clock }) => {
    const now = performance.now() / 1000;
    tickEnergyOrbs(now);
    const t = clock.elapsedTime;
    for (let i = 0; i < ENERGY_ORB_LAYOUT.length; i += 1) {
      const group = refs.current[i];
      if (!group) continue;
      const orb = ENERGY_ORB_LAYOUT[i];
      group.visible = isEnergyOrbReady(orb.id, now);
      const bob = Math.sin(t * 2.2 + i * 0.8) * 0.22;
      group.position.y = orb.position.y + bob;
      group.rotation.y = t * 1.4 + i;
      group.rotation.x = Math.sin(t * 1.1 + i) * 0.18;
    }
  });

  return (
    <group name="EnergyPickupOrbs">
      {ENERGY_ORB_LAYOUT.map((orb, i) => (
        <group
          key={orb.id}
          ref={(node) => {
            refs.current[i] = node;
          }}
          position={[orb.position.x, orb.position.y, orb.position.z]}
        >
          <mesh>
            <sphereGeometry args={[0.52, 24, 16]} />
            <meshBasicMaterial
              color="#baffff"
              transparent
              opacity={0.92}
              toneMapped={false}
            />
          </mesh>
          <mesh scale={1.85}>
            <sphereGeometry args={[0.52, 24, 16]} />
            <meshBasicMaterial
              color="#38f7ff"
              transparent
              opacity={0.34}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.94, 0.045, 8, 48]} />
            <meshBasicMaterial
              color="#7cff6b"
              transparent
              opacity={0.62}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.72, 0.035, 8, 42]} />
            <meshBasicMaterial
              color="#7cff6b"
              transparent
              opacity={0.62}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
