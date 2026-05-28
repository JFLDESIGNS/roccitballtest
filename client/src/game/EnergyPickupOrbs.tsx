import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import {
  getEnergyOrbSnapshot,
  subscribeEnergyOrbs,
  tickEnergyOrbs,
} from './energyOrbStore';

export function EnergyPickupOrbs() {
  const snapshot = useSyncExternalStore(
    subscribeEnergyOrbs,
    getEnergyOrbSnapshot,
  );
  const refs = useRef<Array<THREE.Group | null>>([]);
  const coreMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#baffff',
        transparent: true,
        opacity: 0.92,
        toneMapped: false,
      }),
    [],
  );
  const shellMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#38f7ff',
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  const ringMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#7cff6b',
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  useFrame(({ clock }) => {
    tickEnergyOrbs(performance.now() / 1000);
    const t = clock.elapsedTime;
    for (const [i, group] of refs.current.entries()) {
      if (!group) continue;
      const bob = Math.sin(t * 2.2 + i * 0.8) * 0.22;
      group.position.y = snapshot.orbs[i]?.position.y ?? 0;
      group.position.y += bob;
      group.rotation.y = t * 1.4 + i;
      group.rotation.x = Math.sin(t * 1.1 + i) * 0.18;
    }
  });

  return (
    <group name="EnergyPickupOrbs">
      {snapshot.orbs.map((orb, i) => (
        <group
          key={orb.id}
          ref={(node) => {
            refs.current[i] = node;
          }}
          position={[orb.position.x, orb.position.y, orb.position.z]}
          visible={orb.ready}
        >
          <pointLight color="#44ffee" intensity={1.1} distance={9} decay={2} />
          <mesh>
            <sphereGeometry args={[0.52, 24, 16]} />
            <primitive object={coreMaterial} attach="material" />
          </mesh>
          <mesh scale={1.85}>
            <sphereGeometry args={[0.52, 24, 16]} />
            <primitive object={shellMaterial} attach="material" />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.94, 0.045, 8, 48]} />
            <primitive object={ringMaterial} attach="material" />
          </mesh>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.72, 0.035, 8, 42]} />
            <primitive object={ringMaterial} attach="material" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
