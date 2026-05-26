import { CuboidCollider, interactionGroups, RigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ARENA } from '../shared/Constants';
import { createCeilingGridShaderMaterial } from './ceilingGridShader';
import { getCeilingWallHitPulse, getCeilingWallWobble } from './visualShake';

const CEILING_COLLISION = interactionGroups(2, [0, 1, 2]);
/** Single ceiling sheet — slightly larger than the hex court */
const CEILING_PLANE_SIZE = ARENA.hexRadius * 2.35;

export function ArenaCeilingImpactWall() {
  const ceilingY = ARENA.wallHeight + ARENA.ceilingOverlapM;
  const colliderY = ARENA.wallHeight - 0.08;
  const mat = useMemo(() => createCeilingGridShaderMaterial(), []);
  const meshRef = useRef<THREE.Mesh | null>(null);
  /** Flush with arena ceiling underside (same Y as ceiling strip). */
  const meshY = ceilingY;

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const pulse = getCeilingWallHitPulse();
    mat.uniforms.uPulse.value = pulse > 0 ? Math.min(1, pulse * 1.12) : 0;
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    const wobble = getCeilingWallWobble(13.7);
    mesh.rotation.set(-Math.PI / 2, 0, 0);
    mesh.position.set(
      wobble.tiltZ * 0.025,
      meshY + wobble.tiltZ * 0.006,
      wobble.tiltX * 0.025,
    );
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
        position={[0, meshY, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={22}
        frustumCulled={false}
      >
        <planeGeometry args={[CEILING_PLANE_SIZE, CEILING_PLANE_SIZE]} />
        <primitive object={mat} attach="material" />
      </mesh>
    </group>
  );
}
