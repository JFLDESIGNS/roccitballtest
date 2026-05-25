import type { RapierRigidBody } from '@react-three/rapier';
import { GOAL_RINGS } from '../shared/Constants';
import type { BotCombatState } from './botCombat';
import { applyGoalEjectKnockback } from './goalCharacterEject';
import { tickGoalRimCharacterBounce } from './goalRingBounce';
import type { KnockStunKind } from './rocketKnockStun';
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

export function applyGoalNetLaunchToCharacter(
  body: RapierRigidBody,
  contact: GoalNetContact,
  kind: KnockStunKind,
  combat?: BotCombatState,
): void {
  const tr = body.translation();
  applyGoalEjectKnockback(
    body,
    contact.outwardX,
    tr.z,
    contact.towardCenterZ,
    kind,
    combat,
  );
}

export function tickGoalNetCharacterBounce(
  body: RapierRigidBody,
  x: number,
  y: number,
  z: number,
  entityRadius: number,
  cooldownSec: { current: number },
  dt: number,
  kind: KnockStunKind,
  combat?: BotCombatState,
): boolean {
  cooldownSec.current = Math.max(0, cooldownSec.current - dt);
  if (cooldownSec.current > 0) return false;

  const net = findGoalNetContact(x, y, z, entityRadius);
  if (!net) return false;

  applyGoalNetLaunchToCharacter(body, net, kind, combat);
  cooldownSec.current = GOAL_RINGS.netBounceCooldownSec;
  return true;
}

/** Net mouth first, then rim ring eject */
export function tickGoalEntryCharacterBounce(
  body: RapierRigidBody,
  x: number,
  y: number,
  z: number,
  entityRadius: number,
  _gravity: number,
  netCooldownSec: { current: number },
  rimCooldownSec: { current: number },
  dt: number,
  kind: KnockStunKind = 'player',
  combat?: BotCombatState,
): boolean {
  if (
    tickGoalNetCharacterBounce(
      body,
      x,
      y,
      z,
      entityRadius,
      netCooldownSec,
      dt,
      kind,
      combat,
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
    rimCooldownSec,
    dt,
    kind,
    combat,
  );
}
