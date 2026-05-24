import * as THREE from 'three';
import { ARENA, BALL, GOAL_POINTS, GOAL_RINGS } from '../shared/Constants';
import type { GoalDef, GoalSize, Team } from '../shared/Types';

export function ringRadiusForTier(tier: 0 | 1 | 2): number {
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
  const midLift = GOAL_RINGS.midRingExtraHeightFt * FT;
  const midY = bottomY + r0 + r1 + gap + midLift;
  /** Top ring Y unchanged when mid lifts — extra gap opens between mid and top */
  const topY =
    bottomY +
    r0 +
    r1 +
    gap +
    r1 +
    r2 +
    gap +
    GOAL_RINGS.topRingExtraHeightFt * FT;
  return { bottomY, midY, topY };
}

const FT = 0.3048;

/** Push ring center off the end wall toward midfield (tier 0 = bottom, 2 = top). */
export function goalRingWallStandoffM(tier: 0 | 1 | 2): number {
  if (tier === 2) return GOAL_RINGS.topRingWallStandoffFt * FT;
  if (tier === 1) return GOAL_RINGS.midRingWallStandoffFt * FT;
  if (tier === 0) return GOAL_RINGS.bottomRingWallStandoffFt * FT;
  return 0;
}

export function goalRingCenterX(
  team: Team,
  wallX: number,
  tier: 0 | 1 | 2,
): number {
  const standoff = goalRingWallStandoffM(tier);
  return team === 'red' ? wallX + standoff : wallX - standoff;
}

/** Lit ring mesh X — top ring uses full wall standoff toward the court */
export function goalRingDisplayX(
  centerX: number,
  team: Team,
  size: GoalSize,
): number {
  if (size === 'small') {
    const pullBack = GOAL_RINGS.topRingLitWallPullBackFt * FT;
    return team === 'red' ? centerX - pullBack : centerX + pullBack;
  }
  return centerX;
}

function goalScoringStickOutM(size: GoalSize): number {
  if (size === 'medium') return GOAL_RINGS.scoringVolumeStickOutMidM;
  if (size === 'small') return GOAL_RINGS.scoringVolumeStickOutTopM;
  return GOAL_RINGS.scoringVolumeStickOutM;
}

function goalScoringArenaForwardM(size: GoalSize): number {
  if (size === 'medium') return GOAL_RINGS.scoringVolumeArenaForwardMidM;
  if (size === 'small') return GOAL_RINGS.scoringVolumeArenaForwardTopM;
  return 0;
}

/** Push scoring cylinder into the ring — stick-out pulls center toward the court */
export function goalScoringWallInsetM(size: GoalSize): number {
  const half = goalScoringSensorDepth(size) / 2;
  return Math.max(0, half - goalScoringStickOutM(size));
}

function goalScoringWallPullbackM(size: GoalSize): number {
  const bottomExtra =
    size === 'large' ? GOAL_RINGS.scoringVolumeWallPullbackBottomExtraFt : 0;
  const midTopExtra =
    size === 'large' ? 0 : GOAL_RINGS.scoringVolumeWallPullbackMidTopExtraFt;
  const midOnlyExtra =
    size === 'medium' ? GOAL_RINGS.scoringVolumeWallPullbackMidExtraFt : 0;
  return (
    (GOAL_RINGS.scoringVolumeWallPullbackFt +
      bottomExtra +
      midTopExtra +
      midOnlyExtra) *
    FT
  );
}

export function goalBallScoreRetreatPos(
  goal: Pick<GoalDef, 'center' | 'team' | 'size'>,
): { x: number; y: number; z: number } {
  const backX = goalBackRingCenterX(goal);
  const pastWall = GOAL_RINGS.goalBallRetreatPastBackRingFt * FT;
  const towardWall = goal.team === 'red' ? -1 : 1;
  return {
    x: backX + towardWall * pastWall,
    y: goal.center.y,
    z: goal.center.z,
  };
}

/** Goal suck pause/lerp — pull toward court so the ball does not sit deep in the net */
export function goalBallSuckLerpPos(
  goal: Pick<GoalDef, 'center' | 'team' | 'size'>,
): { x: number; y: number; z: number } {
  const stickOut = GOAL_RINGS.goalBallSuckStickOutFt * FT;
  const towardCourt = goal.team === 'red' ? 1 : -1;
  return {
    x: goal.center.x + towardCourt * stickOut,
    y: goal.center.y,
    z: goal.center.z,
  };
}

export function goalScoringCenter(
  goal: Pick<GoalDef, 'center' | 'team' | 'size'>,
): { x: number; y: number; z: number } {
  const inset = goalScoringWallInsetM(goal.size);
  const forward = goalScoringArenaForwardM(goal.size);
  const pullBack = goalScoringWallPullbackM(goal.size);
  const towardCourt = goal.team === 'red' ? 1 : -1;
  return {
    x:
      goal.center.x +
      (goal.team === 'red' ? -inset : inset) +
      towardCourt * (forward - pullBack),
    y: goal.center.y,
    z: goal.center.z,
  };
}

export function goalScoringSensorDepth(size: GoalSize): number {
  if (size === 'medium') return GOAL_RINGS.midScoringSensorDepth;
  return GOAL_RINGS.sensorDepth;
}

export function goalScoringCylinderParams(
  goal: Pick<GoalDef, 'ringRadius' | 'size'>,
): { radius: number; halfHeight: number } {
  const holeR = goalScoreHoleRadius(goal.ringRadius, goal.size);
  const pad =
    goal.size === 'small'
      ? BALL.radius * 0.52
      : goal.size === 'medium'
        ? BALL.radius * 0.58
        : BALL.radius * 0.45;
  const baseRadius = holeR + pad;
  const radiusScale =
    goal.size === 'large'
      ? GOAL_RINGS.scoringVolumeRadiusScale *
        GOAL_RINGS.scoringVolumeRadiusScaleBottomMult
      : goal.size === 'medium'
        ? GOAL_RINGS.scoringVolumeRadiusScale *
          GOAL_RINGS.scoringVolumeRadiusScaleMidMult *
          GOAL_RINGS.scoringVolumeMidTopRadiusMult
        : GOAL_RINGS.scoringVolumeRadiusScale *
          GOAL_RINGS.scoringVolumeRadiusScaleTopMult *
          GOAL_RINGS.scoringVolumeMidTopRadiusMult;
  return {
    radius: baseRadius * radiusScale,
    halfHeight: goalScoringSensorDepth(goal.size) / 2,
  };
}

/** Rotate Y-up cylinder so its axis matches ring hole depth (local +Z after ring stack). */
export const GOAL_SCORING_CYLINDER_ROTATION: [number, number, number] = [
  Math.PI / 2,
  0,
  0,
];

/** @deprecated use goalScoringCylinderParams */
export function goalScoringVolumeHalfExtents(
  goal: Pick<GoalDef, 'ringRadius' | 'size'>,
): { halfDepth: number; halfY: number; halfZ: number } {
  const { radius, halfHeight } = goalScoringCylinderParams(goal);
  return { halfDepth: halfHeight, halfY: radius, halfZ: radius };
}

export function goalBackRingWallOffsetM(size: GoalSize): number {
  const base =
    size === 'medium'
      ? GOAL_RINGS.midRingBackWallOffsetM
      : size === 'small'
        ? GOAL_RINGS.topRingBackWallOffsetM
        : GOAL_RINGS.backRingWallOffsetM;
  const extraWallFt =
    size === 'large' ? 0 : GOAL_RINGS.midTopBackRingWallExtraFt;
  return base + extraWallFt * FT;
}

export function goalBackRingCenterX(
  goal: Pick<GoalDef, 'center' | 'team' | 'size'>,
): number {
  const backOffset = goalBackRingWallOffsetM(goal.size);
  const towardCourt = goal.team === 'red' ? 1 : -1;
  const courtForward =
    goal.size === 'small' ? GOAL_RINGS.topBackRingCourtForwardFt * FT : 0;
  return (
    goal.center.x +
    (goal.team === 'red' ? -backOffset : backOffset) +
    towardCourt * courtForward
  );
}

function buildWallRings(team: Team, wallX: number): GoalDef[] {
  const { bottomY, midY, topY } = stackedRingCenters();
  const tiers: { size: GoalSize; tier: 0 | 1 | 2; y: number; points: number }[] = [
    { size: 'large', tier: 0, y: bottomY, points: GOAL_POINTS.large },
    { size: 'medium', tier: 1, y: midY, points: GOAL_POINTS.medium },
    { size: 'small', tier: 2, y: topY, points: GOAL_POINTS.small },
  ];

  return tiers.map((t) => {
    const x = goalRingCenterX(team, wallX, t.tier);
    return {
      id: `${team}-ring-${t.size}`,
      team,
      size: t.size,
      points: t.points,
      center: {
        x: goalRingDisplayX(x, team, t.size),
        y: t.y,
        z: 0,
      },
      ringRadius: ringRadiusForTier(t.tier),
    };
  });
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

/** Rapier trimesh buffers for a Y-up torus (matches THREE.TorusGeometry default). */
export function buildTorusTrimesh(
  majorRadius: number,
  tubeRadius: number,
  radialSegments: number,
  tubularSegments: number,
): { vertices: Float32Array; indices: Uint32Array } {
  const geo = new THREE.TorusGeometry(
    majorRadius,
    tubeRadius,
    radialSegments,
    tubularSegments,
  );
  const pos = geo.attributes.position;
  const vertices = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    vertices[i * 3] = pos.getX(i);
    vertices[i * 3 + 1] = pos.getY(i);
    vertices[i * 3 + 2] = pos.getZ(i);
  }
  const index = geo.index;
  if (!index) {
    geo.dispose();
    throw new Error('TorusGeometry missing index buffer');
  }
  const indices = new Uint32Array(index.count);
  for (let i = 0; i < index.count; i++) indices[i] = index.getX(i);
  geo.dispose();
  return { vertices, indices };
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

/** Scoring bullseye radius — larger on mid/top rings (smaller physical hoops). */
export function goalScoreHoleRadius(
  ringRadius: number,
  size: GoalSize = 'large',
): number {
  const scale =
    size === 'small'
      ? GOAL_RINGS.centerScoreRadiusScaleTop
      : size === 'medium'
        ? GOAL_RINGS.centerScoreRadiusScaleMid
        : GOAL_RINGS.centerScoreRadiusScale;
  return ringRadius * scale;
}

export function goalScoringSlack(
  size: GoalSize,
  speed = 0,
): {
  plane: number;
  hole: number;
} {
  const speedPad = Math.min(BALL.radius * 3.2, speed * 0.032);
  if (size === 'small') {
    return {
      plane: BALL.radius * 0.85 + speedPad,
      hole: BALL.radius * 0.95 + speedPad * 0.5,
    };
  }
  if (size === 'medium') {
    return {
      plane: BALL.radius * 1.05 + speedPad,
      hole: BALL.radius * 1.1 + speedPad * 0.65,
    };
  }
  return {
    plane: BALL.radius * 0.75 + speedPad,
    hole: BALL.radius * 0.85 + speedPad * 0.55,
  };
}

/** Ball position in ring-local space (matches Arena GoalRing rotation stack). */
export function ballToGoalScoringLocal(
  ballPos: { x: number; y: number; z: number },
  goal: Pick<GoalDef, 'center' | 'team' | 'size'>,
  options?: { scoring?: boolean },
): { lx: number; lyRing: number; lzRing: number } {
  const c = options?.scoring !== false ? goalScoringCenter(goal) : goal.center;
  const px = ballPos.x - c.x;
  const py = ballPos.y - c.y;
  const pz = ballPos.z - c.z;
  const tilt = ringTiltX(goal.team, goal.size);
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);
  const lx = pz;
  const ly = py;
  const lz = -px;
  const lyRing = ly * cosT + lz * sinT;
  const lzRing = -ly * sinT + lz * cosT;
  return { lx, lyRing, lzRing };
}

/** Ball offset in ring-local space (matches Arena GoalRing rotation stack). */
export function ballToGoalRingLocal(
  ballPos: { x: number; y: number; z: number },
  goal: Pick<GoalDef, 'center' | 'team' | 'size'>,
  options?: { scoring?: boolean },
): { planeDist: number; holeDist: number } {
  const { lx, lyRing, lzRing } = ballToGoalScoringLocal(ballPos, goal, options);
  return {
    planeDist: Math.abs(lzRing),
    holeDist: Math.hypot(lx, lyRing),
  };
}
