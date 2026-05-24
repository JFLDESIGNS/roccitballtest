import { BALL, GOAL_RINGS } from '../shared/Constants';
import {
  ARENA_GOALS,
  ballToGoalScoringLocal,
  goalScoringCylinderParams,
  goalScoringSlack,
} from './goals';
import type { GoalDef, Team } from '../shared/Types';

type Vec3 = { x: number; y: number; z: number };

type GoalHit = {
  points: number;
  scoringTeam: Team;
  goalTeam: Team;
  goalId: string;
  goalPos: { x: number; y: number; z: number };
  planeDist: number;
};

type ScoringLocal = { lx: number; lyRing: number; lzRing: number };

export function checkGoalScore(ballPos: Vec3): {
  points: number;
  scoringTeam: Team;
  goalTeam: Team;
  goalId: string;
  goalPos: { x: number; y: number; z: number };
} | null {
  const best = pickBestGoalHit(ballPos, 0);
  if (!best) return null;
  const { planeDist: _p, ...hit } = best;
  return hit;
}

/** Swept check along the ball path so fast shots cannot tunnel through the goal volume. */
export function checkGoalScoreSegment(
  from: Vec3,
  to: Vec3,
  speed = 0,
): {
  points: number;
  scoringTeam: Team;
  goalTeam: Team;
  goalId: string;
  goalPos: { x: number; y: number; z: number };
} | null {
  let best: GoalHit | null = null;

  for (const goal of ARENA_GOALS) {
    const hit = segmentHitsGoalVolume(from, to, goal, speed);
    if (hit && (!best || hit.planeDist < best.planeDist)) {
      best = hit;
    }
  }

  if (!best) return null;
  const { planeDist: _p, ...out } = best;
  return out;
}

function pickBestGoalHit(ballPos: Vec3, speed: number): GoalHit | null {
  let best: GoalHit | null = null;

  for (const goal of ARENA_GOALS) {
    const local = ballToGoalScoringLocal(ballPos, goal);
    const hit = pointInGoalVolume(local, goal, speed);
    if (hit && (!best || hit.planeDist < best.planeDist)) {
      best = hit;
    }
  }

  return best;
}

function segmentHitsGoalVolume(
  from: Vec3,
  to: Vec3,
  goal: GoalDef,
  speed: number,
): GoalHit | null {
  const a = ballToGoalScoringLocal(from, goal);
  const b = ballToGoalScoringLocal(to, goal);
  const { radius, halfDepth } = volumeBounds(goal, speed);

  if (segmentIntersectsCappedCylinder(a, b, radius, halfDepth)) {
    return goalHitFromLocal(goal, sampleSegmentMid(a, b));
  }

  const dist = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  const steps = Math.min(
    48,
    Math.max(
      6,
      Math.ceil(dist / Math.max(BALL.radius * 0.22, 0.06)) +
        Math.ceil(speed * 0.018),
    ),
  );
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const local: ScoringLocal = {
      lx: a.lx + (b.lx - a.lx) * t,
      lyRing: a.lyRing + (b.lyRing - a.lyRing) * t,
      lzRing: a.lzRing + (b.lzRing - a.lzRing) * t,
    };
    const hit = pointInGoalVolume(local, goal, speed);
    if (hit) return hit;
  }

  return null;
}

function volumeBounds(
  goal: Pick<GoalDef, 'ringRadius' | 'size'>,
  speed: number,
): { radius: number; halfDepth: number } {
  const slack = goalScoringSlack(goal.size, speed);
  const { radius, halfHeight } = goalScoringCylinderParams(goal);
  const rScale = GOAL_RINGS.scoringVolumeRadiusScale;
  return {
    radius: radius + (slack.hole + BALL.radius * 0.42) * rScale,
    halfDepth: halfHeight + slack.plane + BALL.radius * 0.35,
  };
}

function pointInGoalVolume(
  local: ScoringLocal,
  goal: GoalDef,
  speed: number,
): GoalHit | null {
  const { radius, halfDepth } = volumeBounds(goal, speed);
  const holeDist = Math.hypot(local.lx, local.lyRing);
  if (holeDist > radius) return null;
  const planeDist = Math.abs(local.lzRing);
  if (planeDist > halfDepth) return null;
  return goalHitFromLocal(goal, local);
}

function goalHitFromLocal(goal: GoalDef, local: ScoringLocal): GoalHit {
  const scoringTeam: Team = goal.team === 'red' ? 'blue' : 'red';
  return {
    points: goal.points,
    scoringTeam,
    goalTeam: goal.team,
    goalId: goal.id,
    goalPos: { ...goal.center },
    planeDist: Math.abs(local.lzRing),
  };
}

function sampleSegmentMid(a: ScoringLocal, b: ScoringLocal): ScoringLocal {
  return {
    lx: (a.lx + b.lx) * 0.5,
    lyRing: (a.lyRing + b.lyRing) * 0.5,
    lzRing: (a.lzRing + b.lzRing) * 0.5,
  };
}

/** Segment vs capped cylinder (axis = lzRing, hole plane = lx × lyRing). */
function segmentIntersectsCappedCylinder(
  a: ScoringLocal,
  b: ScoringLocal,
  radius: number,
  halfDepth: number,
): boolean {
  if (pointInsideCylinder(a, radius, halfDepth)) return true;
  if (pointInsideCylinder(b, radius, halfDepth)) return true;

  const dlx = b.lx - a.lx;
  const dly = b.lyRing - a.lyRing;
  const dlz = b.lzRing - a.lzRing;

  for (const lzPlane of [-halfDepth, halfDepth]) {
    if (Math.abs(dlz) < 1e-8) {
      if (
        Math.abs(a.lzRing) <= halfDepth &&
        Math.abs(a.lzRing - lzPlane) < 1e-5
      ) {
        if (Math.hypot(a.lx, a.lyRing) <= radius) return true;
      }
      continue;
    }
    const s = (lzPlane - a.lzRing) / dlz;
    if (s < 0 || s > 1) continue;
    const lx = a.lx + dlx * s;
    const ly = a.lyRing + dly * s;
    if (Math.hypot(lx, ly) <= radius) return true;
  }

  const dd = dlx * dlx + dly * dly;
  let s = 0;
  if (dd > 1e-8) {
    s = -(a.lx * dlx + a.lyRing * dly) / dd;
    s = Math.max(0, Math.min(1, s));
  }
  const cx = a.lx + dlx * s;
  const cy = a.lyRing + dly * s;
  const cz = a.lzRing + dlz * s;
  return Math.hypot(cx, cy) <= radius && Math.abs(cz) <= halfDepth;
}

function pointInsideCylinder(
  p: ScoringLocal,
  radius: number,
  halfDepth: number,
): boolean {
  return Math.hypot(p.lx, p.lyRing) <= radius && Math.abs(p.lzRing) <= halfDepth;
}
