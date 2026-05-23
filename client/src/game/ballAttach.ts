import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { BALL } from '../shared/Constants';
import { setBallHeldCollider, wakeBallBody } from './ballPhysics';

const KINEMATIC = 2;
const DYNAMIC = 0;
const _lerpPos = new THREE.Vector3();

export function getBallSocketPosition(
  chest: THREE.Vector3,
  lookDir: THREE.Vector3,
  holdDistance: number,
  ballRadius: number,
  out?: THREE.Vector3,
): THREE.Vector3 {
  const target = out ?? new THREE.Vector3();
  target.copy(chest);
  target.addScaledVector(lookDir, holdDistance + ballRadius * 0.25);
  return target;
}

/** Start hold at current ball position — avoids a one-frame snap */
export function captureBallSocket(
  body: RapierRigidBody,
  target: THREE.Vector3,
  startPos?: THREE.Vector3,
) {
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
  if (latchT >= 0.92 && dt > 1e-5) {
    const inv = 1 / dt;
    const vx = (target.x - t.x) * inv;
    const vy = (target.y - t.y) * inv;
    const vz = (target.z - t.z) * inv;
    _lerpPos.x += vx * dt * 0.22;
    _lerpPos.y += vy * dt * 0.22;
    _lerpPos.z += vz * dt * 0.22;
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
): boolean {
  getBallSocketPosition(chest, lookDir, holdDistance, ballRadius, _rawSocket);
  if (!initialized) {
    smoothed.copy(_rawSocket);
    return true;
  }
  const alpha = 1 - Math.exp(-rate * Math.max(dt, 1 / 120));
  smoothed.lerp(_rawSocket, alpha);
  return true;
}

export function releaseBallPhysics(body: RapierRigidBody) {
  setBallHeldCollider(body, false);
  body.setBodyType(DYNAMIC, true);
  body.setGravityScale(BALL.gravityScale, true);
  wakeBallBody(body);
}
