import { CuboidCollider, interactionGroups, RigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ARENA } from '../shared/Constants';
import { createArenaHexFloorGeometry } from './arenaHex';
import { getCeilingWallHitPulse, getCeilingWallWobble } from './visualShake';

const CEILING_COLLISION = interactionGroups(2, [0, 1, 2]);

export function ArenaCeilingImpactWall() {
  const ceilingY = ARENA.wallHeight + ARENA.ceilingOverlapM;
  const colliderY = ARENA.wallHeight - 0.08;
  const geo = useMemo(() => createArenaHexFloorGeometry(ARENA.hexRadius * 0.99), []);
  const matA = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#46ff6f',
        wireframe: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const matB = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#9dffb0',
        wireframe: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  const meshRef = useRef<THREE.Mesh | null>(null);
  const meshRefB = useRef<THREE.Mesh | null>(null);

  useFrame(() => {
    const mesh = meshRef.current;
    const meshB = meshRefB.current;
    if (!mesh || !meshB) return;
    const pulse = getCeilingWallHitPulse();
    const a = pulse > 0 ? Math.min(1, pulse * 1.15) : 0;
    matA.opacity = a * 0.95;
    matB.opacity = a * 0.65;
    const wobble = getCeilingWallWobble(13.7);
    const rx = -Math.PI / 2 + wobble.tiltX;
    const rz = wobble.tiltZ;
    mesh.rotation.x = rx;
    mesh.rotation.z = rz;
    meshB.rotation.x = rx;
    meshB.rotation.z = rz;
  });

  return (
    <group>
      <RigidBody type="fixed" colliders={false} position={[0, 0, 0]}>
        <CuboidCollider
          args={[ARENA.hexRadius * 0.9, 0.22, ARENA.hexRadius * 0.9]}
          position={[0, colliderY, 0]}
          restitution={0.85}
          friction={0.2}
          collisionGroups={CEILING_COLLISION}
        />
      </RigidBody>

      <mesh
        ref={meshRef}
        geometry={geo}
        material={matA}
        position={[0, ceilingY - 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={20}
        frustumCulled={false}
      />
      <mesh
        ref={meshRefB}
        geometry={geo}
        material={matB}
        position={[0, ceilingY - 0.018, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={21}
        frustumCulled={false}
        scale={[1.004, 1, 1.004]}
      />
    </group>
  );
}

