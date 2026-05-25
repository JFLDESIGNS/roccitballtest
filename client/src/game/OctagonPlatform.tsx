import { interactionGroups, RigidBody, TrimeshCollider } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ARENA, BALL } from '../shared/Constants';
import { buildOctagonPlatformBuffers, createOctagonShape } from './arenaOctagon';
import { arenaPlatformMaterial, arenaPlatformTopMaterial } from './arenaMaterials';
import { getVisualShake, octagonShakeKey } from './visualShake';

const { octagonTopRadius, octagonSlopeRadius, platformTopHeight, floorY } = ARENA;

export type OctagonPlatformProps = {
  /** World X — default arena center */
  x?: number;
  /** World Z — default arena center */
  z?: number;
  /** Scales top + ramp footprint (center = 2, corners = 1) */
  sizeScale?: number;
};

export function OctagonPlatform({
  x = 0,
  z = 0,
  sizeScale = 1,
}: OctagonPlatformProps) {
  const topR = octagonTopRadius * sizeScale;
  const slopeR = octagonSlopeRadius * sizeScale;

  const { geometry, vertices, indices } = useMemo(() => {
    const built = buildOctagonPlatformBuffers(
      topR,
      slopeR,
      platformTopHeight,
      floorY,
    );
    return built;
  }, [topR, slopeR, x, z]);

  const topRingGeo = useMemo(() => {
    const shape = createOctagonShape(topR * 0.88);
    return new THREE.ShapeGeometry(shape);
  }, [topR]);

  const visualRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const visual = visualRef.current;
    if (!visual) return;
    const { tiltX, tiltY, tiltZ } = getVisualShake(
      octagonShakeKey(x, z),
      x + z,
    );
    visual.rotation.set(tiltX, tiltY, tiltZ);
  });

  return (
    <group position={[x, 0, z]}>
      <RigidBody
        type="fixed"
        colliders={false}
        friction={0.85}
        collisionGroups={interactionGroups(2)}
      >
        <TrimeshCollider
          args={[vertices, indices]}
          friction={0.55}
          restitution={BALL.restitution * 0.85}
          collisionGroups={interactionGroups(2, [0, 1, 2])}
        />
        <group ref={visualRef}>
          <mesh
            geometry={geometry}
            material={arenaPlatformMaterial}
            castShadow
            receiveShadow
          />
          <mesh
            position={[0, platformTopHeight + 0.02, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            geometry={topRingGeo}
            material={arenaPlatformTopMaterial}
          />
        </group>
      </RigidBody>
    </group>
  );
}
