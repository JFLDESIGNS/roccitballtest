import { useMemo } from 'react';
import * as THREE from 'three';
import { ARENA, BOT } from '../shared/Constants';
import { goalEndFaceX } from './goals';
import type { Team } from '../shared/Types';

function BackWallEscapeBox({ team }: { team: Team }) {
  const face = goalEndFaceX();
  const depth = BOT.backWallEscapeDepthM;
  const zSpan = BOT.backWallEscapeHalfWidthZ * 2;
  const wallY = ARENA.wallHeight * 0.22;

  const centerX =
    team === 'red' ? -face + depth * 0.5 : face - depth * 0.5;

  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: team === 'red' ? '#ff8844' : '#44aaff',
        transparent: true,
        opacity: BOT.backWallEscapeVisualOpacity,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [team],
  );

  return (
    <mesh
      position={[centerX, wallY, 0]}
      material={mat}
      renderOrder={4}
      frustumCulled={false}
    >
      <boxGeometry args={[depth, wallY * 2, zSpan]} />
    </mesh>
  );
}

/** Steer volumes behind each goal (~32 ft deep). */
export function BackWallEscapeZones() {
  return (
    <>
      <BackWallEscapeBox team="red" />
      <BackWallEscapeBox team="blue" />
    </>
  );
}
