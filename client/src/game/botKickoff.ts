import * as THREE from 'three';
import { BALL_SPAWN, BOT } from '../shared/Constants';
import type { BotId } from './gameStore';
import type { Team } from '../shared/Types';
import { getBallDropLayout } from './arenaLayout';

const _lane = new THREE.Vector3();

/** Kickoff hook — kept for call sites; no special bot routing after countdown. */
export function tickKickoffState(
  _phase: string,
  _countdown: number,
  _nowSec: number,
  _roster: readonly { id: BotId; team: Team }[],
): void {}

export function isKickoffContestPhase(
  phase: string,
  countdown: number,
  ballFrozen: boolean,
): boolean {
  return phase === 'playing' && (countdown > 0 || ballFrozen);
}

/** World point bots jump toward during countdown / flap hold */
export function getKickoffBallAimPoint(out = new THREE.Vector3()): THREE.Vector3 {
  const { spawnY } = getBallDropLayout();
  return out.set(BALL_SPAWN.x, spawnY, BALL_SPAWN.z);
}

/** Spread bots under the drop so they do not stack */
export function pickKickoffContestGroundTarget(
  botId: BotId,
  feetY: number,
  out = _lane,
): THREE.Vector3 {
  const laneZ =
    botId === 'bot-0' ? -5.5 : botId === 'bot-1' ? 5.5 : 0;
  const laneX = botId === 'bot-2' ? 2.5 : -2.5;
  return out.set(BALL_SPAWN.x + laneX, feetY, BALL_SPAWN.z + laneZ);
}

/** Lane target on the floor — vertical reach is jump / double-jump only */
export function pickKickoffContestMoveTarget(
  botId: BotId,
  feetY: number,
  _aim: THREE.Vector3,
  out = _lane,
): THREE.Vector3 {
  return pickKickoffContestGroundTarget(botId, feetY, out);
}

export function kickoffContestHorizDistToAim(
  chestX: number,
  chestZ: number,
  aim: THREE.Vector3,
): number {
  return Math.hypot(chestX - aim.x, chestZ - aim.z);
}

/** Grounded jump toward the ball in the drop cube */
export function kickoffContestShouldJump(
  chestY: number,
  aimY: number,
  horizDist: number,
  grounded: boolean,
  jumpsLeft: number,
): boolean {
  if (!grounded || jumpsLeft <= 0) return false;
  if (horizDist > BOT.kickoffContestReachHorizM) return false;
  if (chestY < aimY - 0.9) return true;
  return (
    horizDist <= BOT.kickoffContestArriveRadius && chestY < aimY - 0.35
  );
}

export function kickoffContestShouldDoubleJump(
  chestY: number,
  aimY: number,
  horizDist: number,
): boolean {
  if (horizDist > BOT.kickoffContestReachHorizM * 0.9) return false;
  if (chestY < aimY - 2.2) return true;
  return (
    horizDist <= BOT.kickoffContestArriveRadius * 1.1 && chestY < aimY - 1.2
  );
}

export function kickoffContestWantsDoubleJump(): boolean {
  return Math.random() < BOT.kickoffContestDoubleJumpChance;
}

export function kickoffContestSprintSpeed(): number {
  return BOT.sprintSpeed * BOT.kickoffContestSprintMult;
}

export function kickoffContestJumpForce(baseJump: number): number {
  return baseJump * BOT.kickoffContestJumpForceScale;
}
