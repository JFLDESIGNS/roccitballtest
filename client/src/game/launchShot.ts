import * as THREE from 'three';
import { BALL, MOVEMENT } from '../shared/Constants';
import type { TuningValues } from './tuningStore';

const _lookHoriz = new THREE.Vector3();

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

/** 0 near level aim → suppress stray vertical carry; 1 on steep pitch → full Y momentum */
function aimVerticalAuthority(lookY: number): number {
  return THREE.MathUtils.smoothstep(Math.abs(lookY), 0.06, 0.34);
}

/** Damp upward carry/swing when not pitching up (stops forward-run pop-ups) */
function scaleMomentumVertical(vy: number, lookY: number): number {
  const auth = aimVerticalAuthority(lookY);
  if (lookY >= 0) return vy * auth;
  if (vy > 0) return vy * auth * 0.2;
  return vy * Math.max(auth, 0.5);
}

/** Keep strafe/run momentum along crosshair aim — not sideways to movement keys */
function addAimAlignedMomentum(
  out: THREE.Vector3,
  vec: THREE.Vector3,
  lookDir: THREE.Vector3,
  scale: number,
): void {
  _lookHoriz.set(lookDir.x, 0, lookDir.z);
  const horizLen = _lookHoriz.length();
  if (horizLen > 0.05) {
    _lookHoriz.multiplyScalar(1 / horizLen);
    const along = vec.x * _lookHoriz.x + vec.z * _lookHoriz.z;
    out.x += _lookHoriz.x * along * scale;
    out.z += _lookHoriz.z * along * scale;
  }
  out.y += scaleMomentumVertical(vec.y, lookDir.y) * scale;
}

/** Trim vertical speed that does not match camera pitch */
function squashUnaimedVertical(
  out: THREE.Vector3,
  lookDir: THREE.Vector3,
  baseForce: number,
): void {
  const aimUp = lookDir.y * baseForce;
  const excess = out.y - aimUp;
  const flat = Math.abs(lookDir.y) < 0.14;

  if (flat && excess > 1.5) {
    out.y = aimUp + excess * 0.22;
  } else if (lookDir.y < -0.12 && out.y > aimUp + 0.8) {
    out.y = aimUp + (out.y - aimUp) * 0.35;
  }
}

/** Remove sideways throw when aiming forward (strafe carry no longer bends the shot) */
function squashUnaimedHorizontal(
  out: THREE.Vector3,
  lookDir: THREE.Vector3,
  baseForce: number,
): void {
  _lookHoriz.set(lookDir.x, 0, lookDir.z);
  const horizLen = _lookHoriz.length();
  if (horizLen < 0.2) return;
  _lookHoriz.multiplyScalar(1 / horizLen);
  const perpX = -_lookHoriz.z;
  const perpZ = _lookHoriz.x;
  const perp = out.x * perpX + out.z * perpZ;
  const maxPerp = baseForce * 0.08;
  if (Math.abs(perp) <= maxPerp) return;
  const trim = perp - Math.sign(perp) * maxPerp;
  out.x -= perpX * trim;
  out.z -= perpZ * trim;
}

/** Swing + carry (optional aim blast) */
function addHoldMomentum(
  out: THREE.Vector3,
  input: LaunchVelocityInput,
  opts: { includeBaseAim: boolean; scale: number },
): void {
  const { lookDir, playerCarry, ballSwing, tune } = input;
  const s = opts.scale;
  const baseForce = BALL.launchForce * tune.baseLaunchForce;

  if (opts.includeBaseAim) {
    out.x += lookDir.x * baseForce;
    out.y += lookDir.y * baseForce;
    out.z += lookDir.z * baseForce;
  }

  addAimAlignedMomentum(
    out,
    playerCarry,
    lookDir,
    tune.carryMomentumToShot * s,
  );
  addAimAlignedMomentum(out, ballSwing, lookDir, tune.swingToShot * s);

  if (opts.includeBaseAim) {
    squashUnaimedVertical(out, lookDir, baseForce);
    squashUnaimedHorizontal(out, lookDir, baseForce);
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
  const { ballSwing, playerVel, tune, lookDir } = input;

  const swingHoriz = horizontalSpeed(ballSwing);
  const swingTotal = ballSwing.length();
  const active =
    swingHoriz >= tune.releaseSwingMinSpeed ||
    swingTotal >= tune.releaseSwingMinSpeed * 1.2;

  out.set(0, 0, 0);

  if (!active) {
    addAimAlignedMomentum(out, ballSwing, lookDir, tune.releaseIdleSwingScale);
    addAimAlignedMomentum(out, playerVel, lookDir, tune.releaseIdlePlayerScale);
    out.y = Math.max(0, out.y);
    const spd = out.length();
    if (spd > tune.releaseIdleMaxSpeed) {
      out.multiplyScalar(tune.releaseIdleMaxSpeed / spd);
    }
    return { velocity: out, active: false };
  }

  addHoldMomentum(out, input, { includeBaseAim: false, scale: tune.releaseMomentumScale });

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
