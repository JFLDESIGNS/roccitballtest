import { useMemo } from 'react';
import { ARENA } from '../shared/Constants';
import type { Team } from '../shared/Types';
import {
  GROUND_BLOB_SHADOW_LIFT,
  GROUND_BLOB_SHADOW_RENDER_ORDER,
  createBlobShadowPlaneGeometry,
  createGroundBlobShadowMaterial,
  getGoalFloorShadowTexture,
} from './arenaGroundBlobShadow';
import { ARENA_GOALS, ringRadiusForTier } from './goals';

/** Spread onto the court (world X) — mesh scale X */
const COURT_SPREAD = 20;
/** Spread along the wall (world Z) — mesh scale Z */
const WALL_SPREAD = ringRadiusForTier(0) * 3.1;

function goalEndShadowPlacement(team: Team): {
  position: [number, number, number];
  scale: [number, number, number];
} {
  const anchor = ARENA_GOALS.find((g) => g.team === team && g.size === 'large')!;
  const towardCourt = team === 'red' ? 1 : -1;
  return {
    position: [
      // Pull the blob back toward the end wall (closer to the net).
      anchor.center.x + towardCourt * 2.45,
      ARENA.floorY + GROUND_BLOB_SHADOW_LIFT,
      anchor.center.z,
    ],
    scale: [COURT_SPREAD, 1, WALL_SPREAD],
  };
}

/** One dark elliptical blob per end wall (not per ring). */
export function ArenaGoalGroundShadows() {
  const geometry = useMemo(() => createBlobShadowPlaneGeometry(), []);

  const material = useMemo(
    () => createGroundBlobShadowMaterial(getGoalFloorShadowTexture()),
    [],
  );

  const ends = useMemo(
    () =>
      (['red', 'blue'] as const).map((team) => ({
        team,
        ...goalEndShadowPlacement(team),
      })),
    [],
  );

  return (
    <group renderOrder={GROUND_BLOB_SHADOW_RENDER_ORDER}>
      {ends.map(({ team, position, scale }) => (
        <mesh
          key={`goal-floor-shadow-${team}`}
          geometry={geometry}
          material={material}
          position={position}
          scale={scale}
          frustumCulled={false}
        />
      ))}
    </group>
  );
}
