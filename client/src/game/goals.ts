import { ARENA, GOAL_POINTS, GOAL_RINGS } from '../shared/Constants';
import type { GoalDef, GoalSize, Team } from '../shared/Types';

function ringRadiusForTier(tier: 0 | 1 | 2): number {
  return GOAL_RINGS.baseRadius * GOAL_RINGS.tierScale ** tier;
}

/** Stack ring centers so outer edges never overlap */
export function stackedRingCenters(): {
  bottomY: number;
  midY: number;
  topY: number;
} {
  const r0 = ringRadiusForTier(0);
  const r1 = ringRadiusForTier(1);
  const r2 = ringRadiusForTier(2);
  const gap = GOAL_RINGS.ringGap;

  const bottomY = r0 + GOAL_RINGS.floorClearance;
  const midY = bottomY + r0 + r1 + gap;
  const topY = midY + r1 + r2 + gap;
  return { bottomY, midY, topY };
}

function buildWallRings(team: Team, wallX: number): GoalDef[] {
  const { bottomY, midY, topY } = stackedRingCenters();
  const tiers: { size: GoalSize; tier: 0 | 1 | 2; y: number; points: number }[] = [
    { size: 'large', tier: 0, y: bottomY, points: GOAL_POINTS.large },
    { size: 'medium', tier: 1, y: midY, points: GOAL_POINTS.medium },
    { size: 'small', tier: 2, y: topY, points: GOAL_POINTS.small },
  ];

  return tiers.map((t) => ({
    id: `${team}-ring-${t.size}`,
    team,
    size: t.size,
    points: t.points,
    center: { x: wallX, y: t.y, z: 0 },
    ringRadius: ringRadiusForTier(t.tier),
  }));
}

/** Flat-top hex end-wall X (±) — not full hexRadius, which sits past the angled sides */
export function goalEndFaceX(): number {
  return (ARENA.hexRadius * Math.sqrt(3)) / 2;
}

export type GoalWallPositions = { red: number; blue: number };

/** Ring centers on each end wall (red = −X, blue = +X) */
export function goalWallPositions(): GoalWallPositions {
  const face = goalEndFaceX();
  const inset = GOAL_RINGS.faceInsetFromWall;
  return {
    red: -face + inset,
    blue: face - inset,
  };
}

/** Three stacked rings per end wall (bottom largest, −30% per tier) */
export function buildGoals(): GoalDef[] {
  const { red: redX, blue: blueX } = goalWallPositions();
  return [...buildWallRings('red', redX), ...buildWallRings('blue', blueX)];
}

export const ARENA_GOALS = buildGoals();

const SPAWN_BACK_FROM_WALL = 14;

/** Spawn on your defensive end — attack the opposite wall */
export function getTeamSpawn(team: Team): { x: number; y: number; z: number } {
  const { red: redX, blue: blueX } = goalWallPositions();
  return {
    x: team === 'red' ? redX + SPAWN_BACK_FROM_WALL : blueX - SPAWN_BACK_FROM_WALL,
    y: 2,
    z: 0,
  };
}

/** Ring colors match the defending team (score by shooting the other side) */
export function teamGoalColor(team: Team, size: GoalSize): string {
  if (team === 'red') {
    if (size === 'large') return '#ff3311';
    if (size === 'medium') return '#ff5522';
    return '#ff8844';
  }
  if (size === 'large') return '#1155ff';
  if (size === 'medium') return '#3388ff';
  return '#66bbff';
}

/** @deprecated use teamGoalColor */
export function goalColor(size: GoalSize): string {
  return teamGoalColor('blue', size);
}

export function ringTube(radius: number): number {
  return Math.max(GOAL_RINGS.tubeMin, radius * GOAL_RINGS.tubeScale);
}

/** Hole-axis tilt (radians) after Y=π/2 — bottom CCW (+) toward ceiling, top CW (−). */
export function ringTiltX(team: Team, size: GoalSize): number {
  const deg =
    size === 'large'
      ? GOAL_RINGS.ringTiltBottomDeg
      : size === 'medium'
        ? GOAL_RINGS.ringTiltMidDeg
        : GOAL_RINGS.ringTiltTopDeg;
  const rad = (deg * Math.PI) / 180;
  return team === 'red' ? rad : -rad;
}

/** Scoring bullseye radius — center of ring only, not the full hoop. */
export function goalScoreHoleRadius(ringRadius: number): number {
  return ringRadius * GOAL_RINGS.centerScoreRadiusScale;
}
