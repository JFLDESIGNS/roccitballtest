import { CuboidCollider, interactionGroups, RigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ARENA } from '../shared/Constants';
import { createArenaHexFloorGeometry } from './arenaHex';
import { getCeilingWallHitPulse, getCeilingWallWobble } from './visualShake';

const CEILING_COLLISION = interactionGroups(2, [0, 1, 2]);

export function ArenaCeilingImpactWall() {
  const y = ARENA.wallHeight - 0.22;
  const geo = useMemo(() => createArenaHexFloorGeometry(ARENA.hexRadius * 0.99), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#3dff65',
        wireframe: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  const meshRef = useRef<THREE.Mesh | null>(null);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const pulse = getCeilingWallHitPulse();
    mat.opacity = pulse > 0 ? Math.min(0.9, pulse * 0.95) : 0;
    const wobble = getCeilingWallWobble(13.7);
    mesh.rotation.x = -Math.PI / 2 + wobble.tiltX;
    mesh.rotation.z = wobble.tiltZ;
  });

  return (
    <group>
      <RigidBody type="fixed" colliders={false} position={[0, 0, 0]}>
        <CuboidCollider
          args={[ARENA.hexRadius * 0.9, 0.22, ARENA.hexRadius * 0.9]}
          position={[0, y, 0]}
          restitution={0.85}
          friction={0.2}
          collisionGroups={CEILING_COLLISION}
        />
      </RigidBody>

      <mesh
        ref={meshRef}
        geometry={geo}
        material={mat}
        position={[0, y - 0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={20}
        frustumCulled={false}
      />
    </group>
  );
}

