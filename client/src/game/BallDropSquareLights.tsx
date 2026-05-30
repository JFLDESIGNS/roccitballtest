import { CuboidCollider, interactionGroups } from '@react-three/rapier';
import { useMemo } from 'react';
import * as THREE from 'three';
const DROP_COLLISION = interactionGroups(4, [0, 1]);

type BallDropSquareLightsProps = {
  /** Half-extent of the jumbotron cube (local space) */
  cubeHalf: number;
  /** Add cuboid physics colliders (parent must be a RigidBody) */
  withColliders?: boolean;
};

const COOL_EMISSIVE = '#66c8ff';

/** Square emissive fixtures on the jumbotron cube faces. */
export function BallDropSquareLights({
  cubeHalf,
  withColliders = false,
}: BallDropSquareLightsProps) {
  const fixtureMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1a2838',
        emissive: COOL_EMISSIVE,
        emissiveIntensity: 3.2,
        toneMapped: false,
        metalness: 0.4,
        roughness: 0.38,
      }),
    [],
  );

  const faceInset = 0.14;
  const size = 1.35;
  const depth = 0.22;
  const ySlots = [-cubeHalf * 0.35, cubeHalf * 0.35];

  const fixtures: { pos: [number, number, number]; rotY: number }[] = [];
  for (const y of ySlots) {
    fixtures.push(
      { pos: [cubeHalf + faceInset, y, 0], rotY: Math.PI / 2 },
      { pos: [-(cubeHalf + faceInset), y, 0], rotY: -Math.PI / 2 },
      { pos: [0, y, cubeHalf + faceInset], rotY: 0 },
      { pos: [0, y, -(cubeHalf + faceInset)], rotY: Math.PI },
    );
  }

  return (
    <group>
      {fixtures.map((f, i) => (
        <group key={`cube-light-${i}`} position={f.pos} rotation={[0, f.rotY, 0]}>
          {withColliders ? (
            <CuboidCollider
              args={[depth * 0.5, size * 0.5, size * 0.5]}
              position={[depth * 0.55, 0, 0]}
              friction={0.35}
              collisionGroups={DROP_COLLISION}
            />
          ) : null}
          <mesh material={fixtureMat} castShadow={false}>
            <boxGeometry args={[depth, size, size]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
