import * as THREE from 'three';
import { BOT } from '../shared/Constants';

export type FeintPhase = 'goal' | 'left' | 'sweepRight' | 'done';

export type BotFeintShotState = {
  phase: FeintPhase;
  phaseT: number;
  goalYaw: number;
  leftYaw: number;
  rightYaw: number;
  sweepFromYaw: number;
};

const DEG = Math.PI / 180;

export function createBotFeintShotState(): BotFeintShotState {
  return {
    phase: 'goal',
    phaseT: 0,
    goalYaw: 0,
    leftYaw: 0,
    rightYaw: 0,
    sweepFromYaw: 0,
  };
}

export function resetBotFeintShotState(state: BotFeintShotState): void {
  state.phase = 'goal';
  state.phaseT = 0;
}

function goalYawFrom(chest: THREE.Vector3, goal: THREE.Vector3): number {
  return Math.atan2(goal.x - chest.x, goal.z - chest.z);
}

function lerpAngle(from: number, to: number, t: number): number {
  return from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * t;
}

/** World point one unit ahead at a yaw from the chest (for aim smoothing). */
export function feintLookPointAtYaw(
  chest: THREE.Vector3,
  yaw: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  return out.set(
    chest.x + Math.sin(yaw) * 6,
    chest.y + 0.35,
    chest.z + Math.cos(yaw) * 6,
  );
}

export function initBotFeintShot(
  state: BotFeintShotState,
  chest: THREE.Vector3,
  goal: THREE.Vector3,
): void {
  const sideRad = BOT.feintSideDeg * DEG;
  const goalYaw = goalYawFrom(chest, goal);
  state.goalYaw = goalYaw;
  state.leftYaw = goalYaw + sideRad;
  state.rightYaw = goalYaw - sideRad;
  state.sweepFromYaw = state.leftYaw;
  state.phase = 'goal';
  state.phaseT = 0;
}

/**
 * Goal look → 60° left → smooth sweep 120° to the right → release near +59° on the right.
 * Returns true when the bot should fire this frame.
 */
export function tickBotFeintShot(
  state: BotFeintShotState,
  chest: THREE.Vector3,
  goal: THREE.Vector3,
  dt: number,
  outLook: THREE.Vector3,
): boolean {
  if (state.phase === 'done') {
    feintLookPointAtYaw(chest, state.rightYaw, outLook);
    return true;
  }

  if (state.phaseT <= 0 && state.phase === 'goal') {
    initBotFeintShot(state, chest, goal);
  }

  state.phaseT += dt;
  let yaw = state.goalYaw;
  let releaseNow = false;

  switch (state.phase) {
    case 'goal':
      yaw = state.goalYaw;
      if (state.phaseT >= BOT.feintLookGoalSec) {
        state.phase = 'left';
        state.phaseT = 0;
      }
      break;
    case 'left': {
      const t = Math.min(1, state.phaseT / BOT.feintTurnLeftSec);
      const ease = t * t * (3 - 2 * t);
      yaw = lerpAngle(state.goalYaw, state.leftYaw, ease);
      if (state.phaseT >= BOT.feintTurnLeftSec) {
        state.sweepFromYaw = state.leftYaw;
        state.phase = 'sweepRight';
        state.phaseT = 0;
      }
      break;
    }
    case 'sweepRight': {
      const t = Math.min(1, state.phaseT / BOT.feintSweepRightSec);
      const ease = t * t * (3 - 2 * t);
      yaw = lerpAngle(state.sweepFromYaw, state.rightYaw, ease);
      const releaseT = BOT.feintReleaseAtRightDeg / Math.max(BOT.feintSideDeg, 1);
      if (t >= releaseT) {
        releaseNow = true;
        state.phase = 'done';
      } else if (t >= 1) {
        releaseNow = true;
        state.phase = 'done';
      }
      break;
    }
    default:
      break;
  }

  feintLookPointAtYaw(chest, yaw, outLook);
  return releaseNow;
}

export function isFeintShotActive(phase: FeintPhase): boolean {
  return phase !== 'done';
}
