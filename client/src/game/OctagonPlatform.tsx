import { interactionGroups, RigidBody, TrimeshCollider } from '@react-three/rapier';
import { useMemo } from 'react';
import * as THREE from 'three';
import { ARENA } from '../shared/Constants';
import { buildOctagonPlatformBuffers, createOctagonShape } from './arenaOctagon';
import { arenaPlatformMaterial } from './arenaMaterials';

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

  const { geometry, vertices, indices } = useMemo(
    () =>
      buildOctagonPlatformBuffers(topR, slopeR, platformTopHeight, floorY),
    [topR, slopeR],
  );

  const topRingGeo = useMemo(() => {
    const shape = createOctagonShape(topR * 0.88);
    return new THREE.ShapeGeometry(shape);
  }, [topR]);

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
          restitution={0.05}
          collisionGroups={interactionGroups(2, [0, 1, 2])}
        />
        <mesh geometry={geometry} material={arenaPlatformMaterial} />
      </RigidBody>

      <mesh
        position={[0, platformTopHeight + 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        geometry={topRingGeo}
      >
        <meshStandardMaterial
          color="#88aacc"
          emissive="#5577aa"
          emissiveIntensity={0.55}
        />
      </mesh>
    </group>
  );
}
