import * as THREE from 'three';
import { BALL, MOVEMENT } from '../shared/Constants';
import type { TuningValues } from './tuningStore';

const _dir = new THREE.Vector3();
const _carry = new THREE.Vector3();
const _swing = new THREE.Vector3();

export type LaunchVelocityInput = {
  lookDir: THREE.Vector3;
  /** Averaged player velocity samples while holding */
  playerCarry: THREE.Vector3;
  /** Averaged ball socket velocity (swing) while holding */
  ballSwing: THREE.Vector3;
  /** Instant player velocity at release */
  playerVel: THREE.Vector3;
  tune: TuningValues;
};

export type BeamReleaseResult = {
  velocity: THREE.Vector3;
  /** True when release had meaningful swing — uses launched ball state */
  active: boolean;
};

function horizontalSpeed(v: THREE.Vector3): number {
  return Math.hypot(v.x, v.z);
}

/** Swing + carry + move (optional aim blast) */
function addHoldMomentum(
  out: THREE.Vector3,
  input: LaunchVelocityInput,
  opts: { includeBaseAim: boolean; scale: number },
): void {
  const { lookDir, playerCarry, ballSwing, playerVel, tune } = input;
  const s = opts.scale;

  if (opts.includeBaseAim) {
    const baseForce = BALL.launchForce * tune.baseLaunchForce;
    out.x += lookDir.x * baseForce;
    out.y += lookDir.y * baseForce + tune.launchUpBoost;
    out.z += lookDir.z * baseForce;
  }

  _carry.copy(playerCarry).multiplyScalar(tune.carryMomentumToShot * s);
  out.add(_carry);

  _swing.copy(ballSwing).multiplyScalar(tune.swingToShot * s);
  out.add(_swing);

  const moveSpd = horizontalSpeed(playerVel);
  if (moveSpd > 0.05) {
    _dir.set(playerVel.x, 0, playerVel.z).normalize();
    out.addScaledVector(_dir, moveSpd * tune.moveSpeedToShot * s);
  }
}

/** LMB / throw — look aim + swing + movement */
export function computeDirectedShotVelocity(
  input: LaunchVelocityInput,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  out.set(0, 0, 0);
  addHoldMomentum(out, input, { includeBaseAim: true, scale: 1 });
  return out;
}

/** RMB release — drop with no toss; swing uses same momentum recipe as shot (no aim blast) */
export function computeBeamReleaseVelocity(
  input: LaunchVelocityInput,
  out = new THREE.Vector3(),
): BeamReleaseResult {
  const { ballSwing, playerVel, tune } = input;

  const swingHoriz = horizontalSpeed(ballSwing);
  const swingTotal = ballSwing.length();
  const active =
    swingHoriz >= tune.releaseSwingMinSpeed ||
    swingTotal >= tune.releaseSwingMinSpeed * 1.2;

  out.set(0, 0, 0);

  if (!active) {
    out.copy(ballSwing).multiplyScalar(tune.releaseIdleSwingScale);
    out.addScaledVector(playerVel, tune.releaseIdlePlayerScale);
    out.y = Math.max(0, out.y);
    const spd = out.length();
    if (spd > tune.releaseIdleMaxSpeed) {
      out.multiplyScalar(tune.releaseIdleMaxSpeed / spd);
    }
    return { velocity: out, active: false };
  }

  addHoldMomentum(out, input, { includeBaseAim: false, scale: tune.releaseMomentumScale });
  out.y += Math.max(0, ballSwing.y * tune.swingToShot * tune.releaseMomentumScale * 0.2);

  return { velocity: out, active: true };
}

export function spawnBallFromChest(
  chest: THREE.Vector3,
  lookDir: THREE.Vector3,
  out: THREE.Vector3,
): THREE.Vector3 {
  return out
    .copy(chest)
    .addScaledVector(lookDir, BALL.launchSpawnOffset);
}

const _launchDir = new THREE.Vector3();

/** Spawn ahead of the player along shot direction so the capsule does not eat velocity. */
export function computeBallLaunchSpawn(
  chest: THREE.Vector3,
  lookDir: THREE.Vector3,
  velocity: THREE.Vector3,
  out: THREE.Vector3,
): THREE.Vector3 {
  const minDist =
    BALL.radius + MOVEMENT.capsuleRadius + BALL.launchClearancePad;
  _launchDir.copy(velocity);
  if (_launchDir.lengthSq() > 4) {
    _launchDir.normalize();
  } else {
    _launchDir.copy(lookDir);
    if (_launchDir.lengthSq() < 1e-6) _launchDir.set(0, 0, 1);
    _launchDir.normalize();
  }
  const dist = Math.max(BALL.launchSpawnOffset, minDist + BALL.radius * 0.2);
  return out.copy(chest).addScaledVector(_launchDir, dist);
}
