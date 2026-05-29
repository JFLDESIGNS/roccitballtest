import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { BALL, MOVEMENT } from '../shared/Constants';
import { clampHoldSocketPosition } from './ballAttach';
import type { TuningValues } from './tuningStore';
import type { BeamReleaseResult } from './launchShot';

const _fwd = new THREE.Vector3();
const _raw = new THREE.Vector3();
const _aim = new THREE.Vector3();

export type SuperReleaseInput = {
  lookDir: THREE.Vector3;
  playerVel: THREE.Vector3;
  tune: TuningValues;
};

export type SuperReleaseDropInput = SuperReleaseInput & {
  ballSwing: THREE.Vector3;
};

/** Torque-style mount: body origin + forward offset + up lift */
export function getSuperReleaseHoldSocket(
  bodyPos: THREE.Vector3,
  forward: THREE.Vector3,
  tune: TuningValues,
  out: THREE.Vector3,
): THREE.Vector3 {
  _fwd.set(forward.x, 0, forward.z);
  if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
  else _fwd.normalize();

  out.copy(bodyPos);
  out.y += tune.superReleaseUpOffset;
  out.addScaledVector(_fwd, tune.superReleaseForwardOffset);
  return out;
}

export function smoothSuperReleaseHoldSocket(
  smoothed: THREE.Vector3,
  bodyPos: THREE.Vector3,
  forward: THREE.Vector3,
  dt: number,
  rate: number,
  initialized: boolean,
  holderBody: RapierRigidBody | null,
  tune: TuningValues,
  chest: THREE.Vector3,
): boolean {
  getSuperReleaseHoldSocket(bodyPos, forward, tune, _raw);
  if (holderBody) {
    clampHoldSocketPosition(_raw, chest, holderBody);
  }
  if (!initialized) {
    smoothed.copy(_raw);
    return true;
  }
  let effectiveRate = rate;
  if (holderBody) {
    const lv = holderBody.linvel();
    const speed = Math.hypot(lv.x, lv.y, lv.z);
    if (speed > 5) effectiveRate += Math.min(speed * 0.65, 22);
  }
  const alpha = 1 - Math.exp(-effectiveRate * Math.max(dt, 1 / 120));
  smoothed.lerp(_raw, alpha);
  if (holderBody) clampHoldSocketPosition(smoothed, chest, holderBody);
  return true;
}

/** LMB — inherit movement + aim blast + arc lift */
export function computeSuperReleaseShotVelocity(
  input: SuperReleaseInput,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  const { lookDir, playerVel, tune } = input;
  _aim.copy(lookDir);
  if (_aim.lengthSq() < 1e-6) _aim.set(0, 0, 1);
  else _aim.normalize();

  const throwPower = tune.superReleaseThrowPower * tune.superReleaseShotStrength;

  out.copy(playerVel).multiplyScalar(tune.superReleaseInheritedVel);
  out.addScaledVector(_aim, throwPower);
  out.y += tune.superReleaseArcLift + tune.shortArc;
  return out;
}

/** RMB — inherit movement; active swing adds a lighter toss */
export function computeSuperReleaseDropVelocity(
  input: SuperReleaseDropInput,
  out = new THREE.Vector3(),
): BeamReleaseResult {
  const { lookDir, playerVel, ballSwing, tune } = input;
  const swingHoriz = Math.hypot(ballSwing.x, ballSwing.z);
  const swingTotal = ballSwing.length();
  const active =
    swingHoriz >= tune.releaseSwingMinSpeed ||
    swingTotal >= tune.releaseSwingMinSpeed * 1.2;

  out.copy(playerVel).multiplyScalar(
    active ? tune.superReleaseInheritedVel * 0.85 : tune.superReleaseInheritedVel * 0.55,
  );

  if (active) {
    _aim.copy(lookDir);
    if (_aim.lengthSq() < 1e-6) _aim.set(0, 0, 1);
    else _aim.normalize();
    const toss =
      tune.superReleaseThrowPower *
      tune.superReleaseShotStrength *
      tune.releaseMomentumScale *
      0.45;
    out.addScaledVector(_aim, toss);
    out.addScaledVector(ballSwing, tune.releaseMomentumScale * 0.85);
    out.y += tune.superReleaseArcLift * 0.35;
  } else {
    out.y = Math.max(0, out.y);
  }

  const spd = out.length();
  const cap = active ? tune.releaseMaxActiveSpeed : tune.releaseIdleMaxSpeed;
  if (spd > cap) out.multiplyScalar(cap / spd);

  return { velocity: out, active };
}

/** Spawn slightly ahead so the ball clears the thrower capsule */
export function computeSuperReleaseSpawn(
  bodyPos: THREE.Vector3,
  forward: THREE.Vector3,
  lookDir: THREE.Vector3,
  tune: TuningValues,
  out: THREE.Vector3,
): THREE.Vector3 {
  getSuperReleaseHoldSocket(bodyPos, forward, tune, out);

  _aim.copy(lookDir);
  if (_aim.lengthSq() < 1e-6) _aim.copy(forward);
  if (_aim.lengthSq() < 1e-6) _aim.set(0, 0, 1);
  _aim.normalize();

  const minDist =
    BALL.radius + MOVEMENT.capsuleRadius + BALL.launchClearancePad;
  const ahead = Math.max(
    tune.superReleaseForwardOffset * 0.35,
    minDist + BALL.radius * 0.15,
  );
  return out.addScaledVector(_aim, ahead);
}
