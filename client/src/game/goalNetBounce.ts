import type { RapierRigidBody } from '@react-three/rapier';
import { GOAL_RINGS } from '../shared/Constants';
import { tickGoalRimCharacterBounce } from './goalRingBounce';
import type { Team } from '../shared/Types';
import {
  ARENA_GOALS,
  ballToGoalRingLocal,
  goalEndFaceX,
  goalScoreHoleRadius,
  goalScoringCenter,
} from './goals';

export type GoalNetContact = {
  outwardX: number;
  towardCenterZ: number;
};

const GOAL_TEAMS: Team[] = ['red', 'blue'];

/** Inside a goal mouth (any ring hole, behind rings toward wall) — launch to midfield */
export function findGoalNetContact(
  x: number,
  y: number,
  z: number,
  entityRadius: number,
): GoalNetContact | null {
  const face = goalEndFaceX();
  const pad = entityRadius * 0.75;

  for (const team of GOAL_TEAMS) {
    const teamGoals = ARENA_GOALS.filter((g) => g.team === team);
    if (teamGoals.length === 0) continue;

    const outwardX = team === 'red' ? 1 : -1;
    /** Furthest ring plane toward the arena (mouth opening) */
    const mouthArenaX =
      team === 'red'
        ? Math.max(...teamGoals.map((g) => goalScoringCenter(g).x))
        : Math.min(...teamGoals.map((g) => goalScoringCenter(g).x));

    const inMouthX =
      team === 'red'
        ? x < mouthArenaX + pad
        : x > mouthArenaX - pad;
    if (!inMouthX) continue;

    const beforeBackWall =
      team === 'red' ? x > -face + 1.2 : x < face - 1.2;
    if (!beforeBackWall) continue;

    let inAnyHole = false;
    for (const goal of teamGoals) {
      const holeR = goalScoreHoleRadius(goal.ringRadius, goal.size);
      const { holeDist } = ballToGoalRingLocal({ x, y, z }, goal, {
        scoring: true,
      });
      if (holeDist <= holeR + pad) {
        inAnyHole = true;
        break;
      }
    }
    if (!inAnyHole) continue;

    const towardCenterZ =
      Math.abs(z) < 0.35
        ? 0
        : -Math.sign(z) *
          Math.min(GOAL_RINGS.netTowardCenterSpeed, Math.abs(z) * 2.4);

    return { outwardX, towardCenterZ };
  }
  return null;
}

function goalNetCharacterHopSpeed(gravity: number): number {
  const h = GOAL_RINGS.netCharacterHopFt * 0.3048;
  const g = Math.abs(gravity);
  return Math.sqrt(2 * g * h);
}

/** Launch out of the goal mouth into the court (not toward ball drop / center). */
function goalNetLaunchOutward(
  contact: GoalNetContact,
  bodyVx: number,
  bodyVz: number,
): { vx: number; vz: number } {
  const speed = GOAL_RINGS.netOutwardSpeed;
  let vx = contact.outwardX * speed;
  let vz = contact.towardCenterZ;

  const outwardMomentum = bodyVx * contact.outwardX;
  if (outwardMomentum > 1.5) {
    vx = outwardMomentum * 0.55 + vx * 0.65;
  }

  const tangential = bodyVz * 0.45;
  vz = vz * 0.7 + tangential;

  const len = Math.hypot(vx, vz);
  if (len > 0.01) {
    const scale = Math.min(speed * 1.15, len);
    vx = (vx / len) * scale;
    vz = (vz / len) * scale;
  }

  return { vx, vz };
}

export function applyGoalNetLaunchToCharacter(
  body: RapierRigidBody,
  contact: GoalNetContact,
  gravity: number,
): void {
  const v = body.linvel();
  const { vx, vz } = goalNetLaunchOutward(contact, v.x, v.z);
  const hop = goalNetCharacterHopSpeed(gravity);
  const vy = Math.max(v.y * 0.35, 0) + hop;
  body.setLinvel({ x: vx, y: vy, z: vz }, true);
}

export function tickGoalNetCharacterBounce(
  body: RapierRigidBody,
  x: number,
  y: number,
  z: number,
  entityRadius: number,
  gravity: number,
  cooldownSec: { current: number },
  dt: number,
): boolean {
  cooldownSec.current = Math.max(0, cooldownSec.current - dt);
  if (cooldownSec.current > 0) return false;

  const net = findGoalNetContact(x, y, z, entityRadius);
  if (!net) return false;

  applyGoalNetLaunchToCharacter(body, net, gravity);
  cooldownSec.current = GOAL_RINGS.netBounceCooldownSec;
  return true;
}

/** Net mouth first, then rim ring trampoline */
export function tickGoalEntryCharacterBounce(
  body: RapierRigidBody,
  x: number,
  y: number,
  z: number,
  entityRadius: number,
  gravity: number,
  netCooldownSec: { current: number },
  rimCooldownSec: { current: number },
  dt: number,
): boolean {
  if (
    tickGoalNetCharacterBounce(
      body,
      x,
      y,
      z,
      entityRadius,
      gravity,
      netCooldownSec,
      dt,
    )
  ) {
    return true;
  }
  return tickGoalRimCharacterBounce(
    body,
    x,
    y,
    z,
    entityRadius,
    gravity,
    rimCooldownSec,
    dt,
  );
}
