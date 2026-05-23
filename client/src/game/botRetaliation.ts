import * as THREE from 'three';
import { BOT } from '../shared/Constants';
import type { BallHolderId, BotId } from './gameStore';
import type { Team } from '../shared/Types';
import { aimAnglesToward } from './botGoals';

export type BotRetaliationPhase = 'turn' | 'pause' | 'done';

export type BotRetaliationState = {
  activeUntilSec: number;
  phase: BotRetaliationPhase;
  /** Countdown before the next shot (0.7–1.5s after aimed) */
  pauseSec: number;
  shotsFired: number;
  /** Who triggered this burst — `'local'` or a bot id */
  attackerId: string | null;
};

export function createBotRetaliationState(): BotRetaliationState {
  return {
    activeUntilSec: 0,
    phase: 'done',
    pauseSec: 0,
    shotsFired: 0,
    attackerId: null,
  };
}

export function isBotRetaliationActive(
  state: BotRetaliationState,
  nowSec = performance.now() / 1000,
): boolean {
  return nowSec < state.activeUntilSec && state.phase !== 'done';
}

export function isHostileRocketHit(
  ownerId: string,
  victimTeam: Team,
  attackerTeam: Team | null,
  localTeam: Team,
): boolean {
  if (ownerId === 'local') return victimTeam !== localTeam;
  if (!attackerTeam) return false;
  return attackerTeam !== victimTeam;
}

function randomRetaliationPauseSec(): number {
  const min = BOT.retaliatePauseMinSec;
  const max = BOT.retaliatePauseMaxSec;
  return min + Math.random() * (max - min);
}

function finishRetaliation(state: BotRetaliationState, nowSec: number): void {
  state.phase = 'done';
  state.pauseSec = 0;
  state.activeUntilSec = nowSec + BOT.retaliateAfterBurstSec;
}

function retaliationFirePitch(chest: THREE.Vector3, target: THREE.Vector3): number {
  const aim = aimAnglesToward(chest, target);
  return Math.min(
    1.22,
    aim.pitch +
      THREE.MathUtils.degToRad(BOT.retaliateRocketPitchOffsetDeg),
  );
}

function isRetaliationAimedAt(
  yaw: number,
  pitch: number,
  chest: THREE.Vector3,
  target: THREE.Vector3,
): boolean {
  const aim = aimAnglesToward(chest, target);
  const wantPitch = retaliationFirePitch(chest, target);
  const yawErr = Math.abs(
    Math.atan2(Math.sin(yaw - aim.yaw), Math.cos(yaw - aim.yaw)),
  );
  const pitchErr = Math.abs(pitch - wantPitch);
  return (
    yawErr <= BOT.retaliateAimMaxErrorRad &&
    pitchErr <= BOT.retaliatePitchAimMaxErrorRad
  );
}

/** Rocket hit from player or an opposite-team bot — face attacker and burst back */
export function armBotRetaliation(
  state: BotRetaliationState,
  botId: BotId,
  hitByOwnerId: string,
  ballHolder: BallHolderId,
  botHoldingBall: boolean,
): void {
  if (botHoldingBall || ballHolder === botId) return;

  const nowSec = performance.now() / 1000;
  state.phase = 'turn';
  state.pauseSec = 0;
  state.shotsFired = 0;
  state.attackerId = hitByOwnerId;
  const maxWindow =
    BOT.retaliatePauseMaxSec * (BOT.retaliateMaxShots + 1) + 3.5;
  state.activeUntilSec = nowSec + Math.max(BOT.retaliateDurationSec, maxWindow);
}

export function clearBotRetaliation(state: BotRetaliationState): void {
  state.activeUntilSec = 0;
  state.phase = 'done';
  state.pauseSec = 0;
  state.shotsFired = 0;
  state.attackerId = null;
}

/**
 * Turn → pause (0.7–1.5s) → fire.
 * First rocket always fires; 2nd and 3rd only if dice passes.
 * Set allowPhaseAdvance false during knock stun (still aim, no shots).
 */
export function tickBotRetaliation(
  state: BotRetaliationState,
  dt: number,
  nowSec: number,
  yaw: number,
  pitch: number,
  chest: THREE.Vector3,
  target: THREE.Vector3,
  allowPhaseAdvance: boolean,
): boolean {
  if (!isBotRetaliationActive(state, nowSec)) return false;

  const aimed = isRetaliationAimedAt(yaw, pitch, chest, target);

  if (state.phase === 'turn') {
    if (!allowPhaseAdvance) return false;
    if (!aimed) return false;
    state.phase = 'pause';
    state.pauseSec =
      state.shotsFired === 0
        ? BOT.retaliateFirstShotPauseSec
        : randomRetaliationPauseSec();
    return false;
  }

  if (state.phase === 'pause') {
    if (!allowPhaseAdvance) return false;
    if (!aimed) {
      state.phase = 'turn';
      state.pauseSec = 0;
      return false;
    }
    state.pauseSec = Math.max(0, state.pauseSec - dt);
    if (state.pauseSec > 0) return false;
    if (!isRetaliationAimedAt(yaw, pitch, chest, target)) {
      state.phase = 'turn';
      state.pauseSec = 0;
      return false;
    }

    state.shotsFired += 1;
    const fired = true;

    if (state.shotsFired >= BOT.retaliateMaxShots) {
      finishRetaliation(state, nowSec);
      return fired;
    }

    if (Math.random() < BOT.retaliateContinueShotChance) {
      state.phase = 'pause';
      state.pauseSec = randomRetaliationPauseSec();
    } else {
      finishRetaliation(state, nowSec);
    }
    return fired;
  }

  return false;
}

/** Lock yaw/pitch onto the revenge target right before firing */
export function snapBotRetaliationAim(
  yaw: { current: number },
  pitch: { current: number },
  chest: THREE.Vector3,
  target: THREE.Vector3,
): void {
  const aim = aimAnglesToward(chest, target);
  yaw.current = aim.yaw;
  pitch.current = retaliationFirePitch(chest, target);
}
