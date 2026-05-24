import type { RapierRigidBody } from '@react-three/rapier';
import type { World } from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { ARENA, BALL, BEAM } from '../shared/Constants';
import { resolveHeldBallPosition, resetHeldBallSupportSmooth } from './ballHoldResolve';
import { setBallHeldCollider, wakeBallBody } from './ballPhysics';

const KINEMATIC = 2;
const DYNAMIC = 0;
const _lerpPos = new THREE.Vector3();
const _holdAim = new THREE.Vector3();
const _holdDelta = new THREE.Vector3();

/** Clamp carry aim so steep downward pitch does not bury the ball in the player mesh. */
export function holdAimDirection(
  lookDir: THREE.Vector3,
  out: THREE.Vector3 = _holdAim,
): THREE.Vector3 {
  out.copy(lookDir);
  if (out.lengthSq() < 1e-8) out.set(0, 0, 1);
  else out.normalize();

  if (out.y < -BEAM.holdMaxDownPitch) {
    out.y = -BEAM.holdMaxDownPitch;
    out.normalize();
  }

  const minHoriz = 0.34;
  const horiz = Math.hypot(out.x, out.z);
  if (horiz < minHoriz) {
    const scale = minHoriz / Math.max(horiz, 1e-6);
    out.x *= scale;
    out.z *= scale;
    out.normalize();
  }
  return out;
}

export function getBallSocketPosition(
  chest: THREE.Vector3,
  lookDir: THREE.Vector3,
  holdDistance: number,
  ballRadius: number,
  out?: THREE.Vector3,
): THREE.Vector3 {
  const target = out ?? new THREE.Vector3();
  holdAimDirection(lookDir, _holdAim);
  target.copy(chest);
  target.addScaledVector(_holdAim, holdDistance + ballRadius * 0.55);
  return target;
}

/** Keep hold socket in a visible arc in front of the chest. */
export function clampHoldSocketPosition(
  socket: THREE.Vector3,
  chest: THREE.Vector3,
  _holderBody: RapierRigidBody,
): void {
  const floorY = ARENA.floorY + BALL.radius + 0.1;
  const minY = Math.max(floorY, chest.y + BEAM.holdMinSocketYBelowChest);
  if (socket.y < minY) socket.y = minY;

  const maxDist = BEAM.holdDistance + BALL.radius * 0.65;
  _holdDelta.subVectors(socket, chest);
  const d = _holdDelta.length();
  if (d > maxDist) {
    _holdDelta.multiplyScalar(maxDist / d);
    socket.copy(chest).add(_holdDelta);
  }
}

/** Start hold at current ball position — avoids a one-frame snap */
export function captureBallSocket(
  body: RapierRigidBody,
  target: THREE.Vector3,
  startPos?: THREE.Vector3,
) {
  resetHeldBallSupportSmooth();
  body.setBodyType(KINEMATIC, true);
  body.setGravityScale(0, true);
  setBallHeldCollider(body, true);
  const p = startPos ?? target;
  body.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  body.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

/** @deprecated use captureBallSocket */
export function attachBallSocket(body: RapierRigidBody, worldPos: THREE.Vector3) {
  captureBallSocket(body, worldPos);
}

/** Smooth follow toward hold socket (lerpT: 0 = latch-in, 1 = normal carry) */
export function updateBallSocketSmooth(
  body: RapierRigidBody,
  target: THREE.Vector3,
  dt: number,
  latchT: number,
  followSmooth: number = BALL.holdFollowSmooth,
  world?: World,
  holderBody?: RapierRigidBody | null,
  chest?: THREE.Vector3 | null,
) {
  const smooth = THREE.MathUtils.lerp(
    BALL.holdLatchSmooth,
    followSmooth,
    THREE.MathUtils.clamp(latchT, 0, 1),
  );
  const alpha = 1 - Math.exp(-smooth * Math.max(dt, 1 / 120));
  const t = body.translation();

  _lerpPos.set(
    THREE.MathUtils.lerp(t.x, target.x, alpha),
    THREE.MathUtils.lerp(t.y, target.y, alpha),
    THREE.MathUtils.lerp(t.z, target.z, alpha),
  );

  if (world) {
    resolveHeldBallPosition(
      world,
      body,
      _lerpPos,
      _lerpPos,
      BALL.radius,
      holderBody,
      target,
      chest,
      dt,
    );
  }

  body.setTranslation({ x: _lerpPos.x, y: _lerpPos.y, z: _lerpPos.z }, true);
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  body.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

export function updateBallSocket(body: RapierRigidBody, worldPos: THREE.Vector3) {
  updateBallSocketSmooth(body, worldPos, 1 / 60, 1);
}

const _rawSocket = new THREE.Vector3();

/** Low-pass filter on hold point before physics follow (stops aim jitter on the ball). */
export function smoothHoldSocketTarget(
  smoothed: THREE.Vector3,
  chest: THREE.Vector3,
  lookDir: THREE.Vector3,
  holdDistance: number,
  ballRadius: number,
  dt: number,
  rate: number,
  initialized: boolean,
  holderBody?: RapierRigidBody | null,
): boolean {
  holdAimDirection(lookDir, _holdAim);
  getBallSocketPosition(chest, _holdAim, holdDistance, ballRadius, _rawSocket);
  if (holderBody) clampHoldSocketPosition(_rawSocket, chest, holderBody);
  if (!initialized) {
    smoothed.copy(_rawSocket);
    return true;
  }
  let effectiveRate = rate;
  if (holderBody) {
    const lv = holderBody.linvel();
    const speed = Math.hypot(lv.x, lv.y, lv.z);
    if (speed > 5) effectiveRate += Math.min(speed * 0.65, 22);
  }
  const alpha = 1 - Math.exp(-effectiveRate * Math.max(dt, 1 / 120));
  smoothed.lerp(_rawSocket, alpha);
  if (holderBody) clampHoldSocketPosition(smoothed, chest, holderBody);
  return true;
}

export function releaseBallPhysics(body: RapierRigidBody) {
  resetHeldBallSupportSmooth();
  setBallHeldCollider(body, false);
  body.setBodyType(DYNAMIC, true);
  body.setGravityScale(BALL.gravityScale, true);
  wakeBallBody(body);
}
