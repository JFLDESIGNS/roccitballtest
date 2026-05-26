import * as THREE from 'three';
import { BOT } from '../shared/Constants';
import { aimAnglesToward } from './botGoals';
import {
  botChasingLooseBall,
  isPlayerChaseMode,
  type BotMode,
  type BotThinkInput,
} from './botBrain';
import type { BallHolderId } from './gameStore';
import type { BallStateKind } from '../shared/Types';

export type BotLookFocus = 'ball' | 'teammate' | 'opponent' | 'goal' | 'ballDrop' | 'move';

export type BotLookFocusState = {
  focus: BotLookFocus;
  holdLeft: number;
  smoothed: THREE.Vector3;
  initialized: boolean;
};

export type BotLookContext = {
  mode: BotMode;
  input: BotThinkInput;
  moveTarget: THREE.Vector3;
  teammateChest: THREE.Vector3 | null;
  opponentChest: THREE.Vector3 | null;
  ballDropPoint: THREE.Vector3;
  celebrating: boolean;
  kickoffContest: boolean;
  /** Loose ball in play on the floor (not held, not frozen at drop) */
  ballLooseOnCourt: boolean;
};

/** True when the ball is free on the court (not held / drop-frozen). */
export function isBallLooseOnCourt(
  holder: BallHolderId,
  ballState: BallStateKind,
  ballFrozen: boolean,
): boolean {
  if (holder) return false;
  if (ballFrozen) return false;
  return (
    ballState === 'loose' ||
    ballState === 'launched' ||
    ballState === 'pulled'
  );
}

function cycleLooseBallFieldLook(
  state: BotLookFocusState,
  ctx: BotLookContext,
  dt: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  return cycleFocus(
    state,
    ctx,
    [
      { focus: 'ball', weight: BOT.looseBallLookWeight },
      {
        focus: 'teammate',
        weight: (1 - BOT.looseBallLookWeight) * 0.55,
      },
      {
        focus: 'opponent',
        weight: (1 - BOT.looseBallLookWeight) * 0.45,
      },
    ],
    BOT.lookFocusHoldSec,
    dt,
    out,
  );
}

function cycleNoBallFieldLook(
  state: BotLookFocusState,
  ctx: BotLookContext,
  dt: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  return cycleFocus(
    state,
    ctx,
    [
      { focus: 'teammate', weight: 0.5 },
      { focus: 'opponent', weight: 0.5 },
    ],
    BOT.lookFocusHoldSec,
    dt,
    out,
  );
}

const _raw = new THREE.Vector3();

export function resetBotLookFocusState(state: BotLookFocusState): void {
  state.focus = 'ball';
  state.holdLeft = 0;
  state.initialized = false;
}

function lerpAngle(from: number, to: number, t: number): number {
  return from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * t;
}

/** Smooth yaw/pitch toward a world target — angle-aware, rate-limited. */
type AngleRef = { current: number };

export function smoothAimToward(
  yawRef: AngleRef,
  pitchRef: AngleRef,
  chest: THREE.Vector3,
  target: THREE.Vector3,
  dt: number,
  smoothing: number = BOT.lookAimSmoothing,
): void {
  const aim = aimAnglesToward(chest, target);
  const s = 1 - Math.exp(-smoothing * Math.max(dt, 1 / 240));

  let yaw = lerpAngle(yawRef.current, aim.yaw, s);
  let pitch = pitchRef.current + (aim.pitch - pitchRef.current) * s;

  const maxYawStep =
    (BOT.aimMaxYawRateDeg * Math.PI) / 180 / Math.max(dt, 1 / 240);
  const yawDelta = Math.atan2(
    Math.sin(yaw - yawRef.current),
    Math.cos(yaw - yawRef.current),
  );
  if (Math.abs(yawDelta) > maxYawStep) {
    yaw = yawRef.current + Math.sign(yawDelta) * maxYawStep;
  }

  const maxPitchStep =
    (BOT.aimMaxPitchRateDeg * Math.PI) / 180 / Math.max(dt, 1 / 240);
  const pitchDelta = pitch - pitchRef.current;
  if (Math.abs(pitchDelta) > maxPitchStep) {
    pitch = pitchRef.current + Math.sign(pitchDelta) * maxPitchStep;
  }

  yawRef.current = yaw;
  pitchRef.current = Math.max(-0.35, Math.min(1.22, pitch));
}

function pickWeightedFocus(
  options: { focus: BotLookFocus; weight: number }[],
): BotLookFocus {
  let total = 0;
  for (const o of options) total += o.weight;
  let r = Math.random() * total;
  for (const o of options) {
    r -= o.weight;
    if (r <= 0) return o.focus;
  }
  return options[0]?.focus ?? 'ball';
}

function blendLookPoint(state: BotLookFocusState, raw: THREE.Vector3, dt: number): void {
  if (!state.initialized) {
    state.smoothed.copy(raw);
    state.initialized = true;
    return;
  }
  const alpha = 1 - Math.exp(-BOT.lookPointSmooth * Math.max(dt, 1 / 120));
  state.smoothed.lerp(raw, alpha);
}

function setFocusRaw(focus: BotLookFocus, ctx: BotLookContext): THREE.Vector3 {
  const { input, moveTarget, teammateChest, opponentChest, ballDropPoint } = ctx;
  switch (focus) {
    case 'ball':
      return _raw.copy(input.ballPos);
    case 'teammate':
      if (teammateChest) return _raw.copy(teammateChest);
      return _raw.copy(input.ballPos);
    case 'opponent':
      if (opponentChest) return _raw.copy(opponentChest);
      return _raw.copy(input.playerChest);
    case 'goal':
      return _raw.copy(input.goal);
    case 'ballDrop':
      return _raw.copy(ballDropPoint);
    default:
      return _raw.copy(moveTarget);
  }
}

function cycleFocus(
  state: BotLookFocusState,
  ctx: BotLookContext,
  options: { focus: BotLookFocus; weight: number }[],
  holdSec: number,
  dt: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  if (state.holdLeft <= 0) {
    state.focus = pickWeightedFocus(options);
    state.holdLeft = holdSec;
  } else {
    state.holdLeft -= dt;
  }
  const raw = setFocusRaw(state.focus, ctx);
  blendLookPoint(state, raw, dt);
  return out.copy(state.smoothed);
}

/** World point bots glance at while winding up a shot (toward feet / floor). */
export function pickShotWindupLookPoint(
  chest: THREE.Vector3,
  goal: THREE.Vector3,
  out = _raw,
): THREE.Vector3 {
  const aheadX = goal.x - chest.x;
  const aheadZ = goal.z - chest.z;
  const len = Math.hypot(aheadX, aheadZ) || 1;
  return out.set(
    chest.x + (aheadX / len) * 1.4,
    chest.y - BOT.shotWindupLookDownOffsetY,
    chest.z + (aheadZ / len) * 1.4,
  );
}

/** Apply release pitch boost (look down → up through the shot). */
export function applyBotShotReleasePitch(
  pitchRef: AngleRef,
  kind: 'shoot' | 'pass' | 'loft',
  shotStylePitchRad = 0,
): void {
  if (kind === 'pass') return;
  const up = THREE.MathUtils.degToRad(BOT.shotReleaseLookUpDeg);
  const loft =
    kind === 'loft' ? THREE.MathUtils.degToRad(BOT.loftPitchOffsetDeg) : 0;
  pitchRef.current = Math.min(
    1.22,
    pitchRef.current +
      up +
      shotStylePitchRad +
      loft +
      THREE.MathUtils.degToRad(BOT.shotPitchOffsetDeg),
  );
}

/**
 * Always returns a meaningful look point; chases lock on ball.
 * Hold/carry modes should use updateCarryLook instead.
 */
export function resolveBotLookTarget(
  ctx: BotLookContext,
  state: BotLookFocusState,
  dt: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const { mode, input } = ctx;

  if (botChasingLooseBall(mode) || mode === 'attractBall' || mode === 'runToBall') {
    state.focus = 'ball';
    state.holdLeft = BOT.lookFocusHoldSec;
    return out.copy(input.ballPos);
  }

  if (mode === 'runToPlayer' || mode === 'moveAndShoot') {
    state.focus = 'opponent';
    return out.copy(input.playerChest);
  }

  if (mode === 'allySupport' || mode === 'allyReceive') {
    if (ctx.ballLooseOnCourt) {
      state.focus = 'ball';
      return out.copy(input.ballPos);
    }
    return cycleNoBallFieldLook(state, ctx, dt, out);
  }

  if (!isPlayerChaseMode(mode) && ctx.ballLooseOnCourt) {
    if (mode === 'teamOffense' || mode === 'teamCenter' || mode === 'teamDefense') {
      return cycleLooseBallFieldLook(state, ctx, dt, out);
    }
    return cycleLooseBallFieldLook(state, ctx, dt, out);
  }

  if (!isPlayerChaseMode(mode) && !ctx.ballLooseOnCourt) {
    if (mode === 'teamOffense' || mode === 'teamCenter' || mode === 'teamDefense') {
      return cycleNoBallFieldLook(state, ctx, dt, out);
    }
    return cycleNoBallFieldLook(state, ctx, dt, out);
  }

  if (mode === 'teamOffense') {
    return cycleNoBallFieldLook(state, ctx, dt, out);
  }

  if (mode === 'teamCenter' || mode === 'teamDefense') {
    return cycleNoBallFieldLook(state, ctx, dt, out);
  }

  if (ctx.kickoffContest) {
    return cycleFocus(
      state,
      ctx,
      [
        { focus: 'ballDrop', weight: 0.62 },
        { focus: 'opponent', weight: 0.22 },
        { focus: 'teammate', weight: 0.16 },
      ],
      BOT.kickoffLookHoldSec,
      dt,
      out,
    );
  }

  if (ctx.celebrating) {
    return cycleFocus(
      state,
      ctx,
      [
        { focus: 'ballDrop', weight: 0.4 },
        { focus: 'teammate', weight: 0.3 },
        { focus: 'opponent', weight: 0.3 },
      ],
      BOT.celebrationLookHoldSec,
      dt,
      out,
    );
  }

  return cycleNoBallFieldLook(state, ctx, dt, out);
}
