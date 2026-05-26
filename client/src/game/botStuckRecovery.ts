import type { RapierRigidBody } from '@react-three/rapier';
import { BOT } from '../shared/Constants';
import { recoverBody, type FallTracker, type SafePosition } from './fallRecovery';
import { snapRigidBodyUpright } from './characterVisual';

const FT = 0.3048;

export type BotMoveStuckState = {
  anchorX: number;
  anchorZ: number;
  stillSec: number;
  escapeAttempted: boolean;
  suicideTriggered: boolean;
};

export function createBotMoveStuckState(x: number, z: number): BotMoveStuckState {
  return {
    anchorX: x,
    anchorZ: z,
    stillSec: 0,
    escapeAttempted: false,
    suicideTriggered: false,
  };
}

export function resetBotMoveStuckState(state: BotMoveStuckState, x: number, z: number): void {
  state.anchorX = x;
  state.anchorZ = z;
  state.stillSec = 0;
  state.escapeAttempted = false;
  state.suicideTriggered = false;
}

export type BotMoveStuckTick = {
  dropBall: boolean;
  needsFrozenEscape: boolean;
  needsRespawn: boolean;
};

/** No more than ~5 ft from anchor for `stillSec` → stuck */
export function tickBotMoveStuck(
  state: BotMoveStuckState,
  x: number,
  z: number,
  dt: number,
): BotMoveStuckTick {
  const moved = Math.hypot(x - state.anchorX, z - state.anchorZ);
  const moveThreshold = BOT.botStuckMoveThresholdFt * FT;

  if (moved >= moveThreshold) {
    resetBotMoveStuckState(state, x, z);
    return { dropBall: false, needsFrozenEscape: false, needsRespawn: false };
  }

  state.stillSec += dt;

  return {
    dropBall: state.stillSec >= BOT.botHoldStuckDropSec,
    needsFrozenEscape:
      state.stillSec >= BOT.botFrozenTurnJumpSec && !state.escapeAttempted,
    needsRespawn: state.stillSec >= BOT.botFrozenRespawnSec,
  };
}

export function markBotFrozenEscapeAttempted(state: BotMoveStuckState): void {
  state.escapeAttempted = true;
}

export function respawnBotAtSpawn(
  body: RapierRigidBody,
  fallTrack: FallTracker,
  spawn: SafePosition,
  label: string,
): boolean {
  snapRigidBodyUpright(body);
  const ok = recoverBody(body, fallTrack, spawn, label);
  if (ok) {
    fallTrack.lastSafe.x = spawn.x;
    fallTrack.lastSafe.y = spawn.y;
    fallTrack.lastSafe.z = spawn.z;
  }
  return ok;
}
