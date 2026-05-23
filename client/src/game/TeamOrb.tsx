import { Billboard } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { MOVEMENT } from '../shared/Constants';
import { CHARACTER_INDICATOR_RENDER_ORDER } from './characterVisual';
import type { Team } from '../shared/Types';

const ORB_Y = MOVEMENT.capsuleHeight * 0.92;

const MARKER_COLORS: Record<
  Team,
  { core: string; ring: string }
> = {
  red: { core: '#ff1818', ring: '#ff5555' },
  blue: { core: '#1888ff', ring: '#55ccff' },
};

/** Team-colored 2D marker above bots — always faces the camera */
export function TeamOrb({ team }: { team: Team }) {
  const { core, ring } = MARKER_COLORS[team];

  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: core,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        toneMapped: false,
      }),
    [core],
  );

  const ringMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: ring,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        toneMapped: false,
      }),
    [ring],
  );

  return (
    <Billboard
      position={[0, ORB_Y, 0]}
      follow={true}
      lockX={false}
      lockY={false}
      lockZ={false}
    >
      <group renderOrder={CHARACTER_INDICATOR_RENDER_ORDER}>
        <mesh material={ringMat} renderOrder={CHARACTER_INDICATOR_RENDER_ORDER}>
          <ringGeometry args={[0.22, 0.3, 20]} />
        </mesh>
        <mesh material={mat} renderOrder={CHARACTER_INDICATOR_RENDER_ORDER + 1}>
          <circleGeometry args={[0.22, 16]} />
        </mesh>
      </group>
    </Billboard>
  );
}
