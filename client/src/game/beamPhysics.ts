import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { BALL, BEAM, MOVEMENT } from '../shared/Constants';
import { isBallPossessed } from './ballPossession';

export type BallMotionState = 'slow' | 'rolling' | 'falling' | 'airborne';

export type BeamMotionAnalysis = {
  state: BallMotionState;
  speed: number;
  horizontalSpeed: number;
  towardPlayer: number;
  attractionMod: number;
  captureMod: number;
  canCapture: boolean;
  pullScale: number;
};

const _toPlayer = new THREE.Vector3();
const _vel = new THREE.Vector3();

/** Ray endpoint on the ball shell toward the puller */
export function beamTraceBallAnchor(
  ballPos: THREE.Vector3,
  anchorPos: THREE.Vector3,
  out: THREE.Vector3,
): THREE.Vector3 {
  _toPlayer.subVectors(anchorPos, ballPos);
  const d = _toPlayer.length();
  if (d < 0.02) return out.copy(ballPos);
  return out.copy(ballPos).addScaledVector(_toPlayer.normalize(), BALL.radius);
}

/** Ball is against the player capsule / chest — should latch without rolling past */
export function isBeamTouchingPlayer(
  grabDist: number,
  chestDist: number,
): boolean {
  return (
    grabDist <= BEAM.contactStickDistance ||
    chestDist <= BEAM.contactChestDistance
  );
}

export function canPlayerContactCapture(
  grabDist: number,
  chestDist: number,
  analysis: BeamMotionAnalysis,
): boolean {
  if (isBallPossessed()) return false;
  if (!isBeamTouchingPlayer(grabDist, chestDist)) return false;
  return analysis.speed <= BEAM.maxContactCaptureSpeed;
}

/** Shortest distance for beam grab (chest or body surface to ball center) */
export function beamGrabDistance(
  ballPos: THREE.Vector3,
  chestPos: THREE.Vector3,
  playerPos: THREE.Vector3,
): { chestDist: number; bodyDist: number; grabDist: number } {
  const chestDist = chestPos.distanceTo(ballPos);
  const bodyDist = Math.max(
    0,
    playerPos.distanceTo(ballPos) - BALL.radius - MOVEMENT.capsuleRadius,
  );
  return { chestDist, bodyDist, grabDist: Math.min(chestDist, bodyDist) };
}

/** @deprecated use canCaptureWithContest from ballBeamContest */
export function canBeamCaptureBall(
  analysis: BeamMotionAnalysis,
  grabDist: number,
): boolean {
  if (grabDist > BEAM.captureDistance) return false;
  return analysis.canCapture && grabDist <= BEAM.tightCaptureDistance + 0.5;
}

export function analyzeBallBeamMotion(
  ballPos: THREE.Vector3,
  chestPos: THREE.Vector3,
  ballVel: THREE.Vector3,
  ballAngVel?: { x: number; y: number; z: number },
): BeamMotionAnalysis {
  _toPlayer.subVectors(chestPos, ballPos);
  const dist = _toPlayer.length();
  if (dist < 0.05) {
    return {
      state: 'slow',
      speed: 0,
      horizontalSpeed: 0,
      towardPlayer: 0,
      attractionMod: 1,
      captureMod: 1,
      canCapture: true,
      pullScale: 1,
    };
  }
  _toPlayer.normalize();

  _vel.copy(ballVel);
  const speed = _vel.length();
  const horizontalSpeed = Math.hypot(_vel.x, _vel.z);
  const towardPlayer = _vel.dot(_toPlayer);
  const spin = ballAngVel
    ? Math.hypot(ballAngVel.x, ballAngVel.y, ballAngVel.z)
    : 0;

  let state: BallMotionState = 'airborne';
  if (speed < BEAM.maxCaptureSpeed * 0.85) {
    state = 'slow';
  } else if (_vel.y < -3 && horizontalSpeed < speed * 0.85) {
    state = 'falling';
  } else if (horizontalSpeed > 5 && Math.abs(_vel.y) < 4) {
    state = 'rolling';
  }

  const speedT = 1 - speed / (BEAM.maxPullEffectSpeed * 1.15);
  let pullScale = Math.max(0.5, Math.min(1, speedT)) ** 0.72;
  let attractionMod = pullScale;
  let captureMod = 1;

  if (towardPlayer > 0.5) {
    attractionMod *= 1 + Math.min(towardPlayer / 12, 0.65);
    captureMod *= 1 + Math.min(towardPlayer / 16, 0.45);
  }

  if (state === 'rolling') {
    if (towardPlayer < -0.5) {
      attractionMod *= 0.78;
      captureMod *= 0.82;
    } else {
      attractionMod *= 1.38;
      captureMod *= 1.2;
    }
    if (spin > 4) {
      attractionMod *= 0.92;
      captureMod *= 0.94;
    }
  }

  if (state === 'falling') {
    attractionMod *= 0.82;
    captureMod *= 0.88;
    if (towardPlayer > 0) attractionMod *= 1.2;
  }

  if (state === 'slow') {
    attractionMod *= 1.28;
    captureMod *= 1.22;
  }

  if (state === 'airborne' && towardPlayer < -2) {
    attractionMod *= 0.88;
  }

  const canCapture =
    speed <= BEAM.maxCaptureSpeed * captureMod &&
    (state !== 'falling' || speed < BEAM.maxCaptureSpeed * 1.05);

  return {
    state,
    speed,
    horizontalSpeed,
    towardPlayer,
    attractionMod,
    captureMod,
    canCapture,
    pullScale,
  };
}

export type BeamPullResult = {
  applied: boolean;
  analysis: BeamMotionAnalysis;
  dist: number;
  /** Used for tug-of-war glow / capture contest */
  pullWeight: number;
};

/** Physical pull — adds acceleration along beam, resists motion away from player */
export function applyBeamAttraction(
  ball: RapierRigidBody,
  ballPos: THREE.Vector3,
  chestPos: THREE.Vector3,
  dt: number,
  strengthScale = 1,
): BeamPullResult {
  if (isBallPossessed()) {
    const lv = ball.linvel();
    return {
      applied: false,
      analysis: analyzeBallBeamMotion(
        ballPos,
        chestPos,
        _vel.set(lv.x, lv.y, lv.z),
        ball.angvel(),
      ),
      dist: ballPos.distanceTo(chestPos),
      pullWeight: 0,
    };
  }

  let pullWeight = 0;
  _toPlayer.subVectors(chestPos, ballPos);
  const dist = _toPlayer.length();
  const lv = ball.linvel();
  _vel.set(lv.x, lv.y, lv.z);
  const av = ball.angvel();

  const analysis = analyzeBallBeamMotion(
    ballPos,
    chestPos,
    _vel,
    av,
  );

  if (dist >= BEAM.range || analysis.pullScale < 0.02) {
    return { applied: false, analysis, dist, pullWeight: 0 };
  }

  _toPlayer.normalize();

  const distFalloff = 1 + (BEAM.range - dist) / BEAM.range;
  const nearT = 1 - THREE.MathUtils.clamp(dist / BEAM.range, 0, 1);
  let closeMul = 1 + nearT * nearT * nearT * BEAM.closePullBoost;
  if (dist <= BEAM.closePullDistance) {
    const zoneT = 1 - THREE.MathUtils.clamp(dist / BEAM.closePullDistance, 0, 1);
    const zoneBoost =
      1 + zoneT * zoneT * (BEAM.closePullStrengthMult - 1);
    closeMul *= zoneBoost;
  }
  const accel =
    BEAM.pullAccel *
    analysis.attractionMod *
    distFalloff *
    closeMul *
    strengthScale;
  pullWeight = accel * dt;

  let ax = _vel.x + _toPlayer.x * accel * dt;
  let ay = _vel.y + _toPlayer.y * accel * dt;
  let az = _vel.z + _toPlayer.z * accel * dt;

  if (analysis.state === 'falling') {
    ay += BEAM.pullVerticalAssist * analysis.attractionMod * dt * strengthScale;
  } else if (analysis.state === 'slow' || analysis.state === 'rolling') {
    ay += BEAM.pullVerticalAssist * 0.42 * dt * strengthScale;
  }

  if (analysis.towardPlayer < -0.8) {
    const resist = Math.min(
      Math.abs(analysis.towardPlayer) * 0.45,
      accel * dt * BEAM.pullCounterAway,
    );
    ax += _toPlayer.x * resist;
    ay += _toPlayer.y * resist * 0.4;
    az += _toPlayer.z * resist;
  }

  const inCloseZone = dist <= BEAM.closePullDistance;
  const maxDelta =
    BEAM.pullMaxDeltaPerFrame *
    dt *
    strengthScale *
    (inCloseZone ? 1.35 : closeMul > 1 ? 1.15 : 1);
  ax = _vel.x + THREE.MathUtils.clamp(ax - _vel.x, -maxDelta, maxDelta);
  ay = _vel.y + THREE.MathUtils.clamp(ay - _vel.y, -maxDelta, maxDelta);
  az = _vel.z + THREE.MathUtils.clamp(az - _vel.z, -maxDelta, maxDelta);

  const maxBall = BALL.maxSpeed * 1.15;
  const newSpeed = Math.hypot(ax, ay, az);
  if (newSpeed > maxBall) {
    const s = maxBall / newSpeed;
    ax *= s;
    ay *= s;
    az *= s;
  }

  ball.setLinvel({ x: ax, y: ay, z: az }, true);

  if (analysis.state === 'rolling' && av) {
    const damp = 1 - Math.min(0.55, BEAM.spinDamp * analysis.attractionMod * dt);
    ball.setAngvel(
      { x: av.x * damp, y: av.y * damp, z: av.z * damp },
      true,
    );
  }

  return { applied: true, analysis, dist, pullWeight };
}
