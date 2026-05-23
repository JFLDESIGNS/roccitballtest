import type { RapierRigidBody } from '@react-three/rapier';
import { interactionGroups } from '@react-three/rapier';
import * as THREE from 'three';
import { BALL } from '../shared/Constants';

/** Ball collider membership — group 1 */
const BALL_LOOSE_COLLISION = interactionGroups(1, [0, 1, 2]);
const BALL_HELD_COLLISION = interactionGroups(1, []);

const _launch = new THREE.Vector3();
const _swing = new THREE.Vector3();
const _rollAxis = new THREE.Vector3();

/** Toggle held vs loose without React remounting the collider (avoids grab hitch). */
export function setBallHeldCollider(body: RapierRigidBody, held: boolean): void {
  const collider = body.collider(0);
  if (!collider) return;
  collider.setSensor(held);
  collider.setCollisionGroups(
    held ? BALL_HELD_COLLISION : BALL_LOOSE_COLLISION,
  );
}

export function wakeBallBody(body: RapierRigidBody): void {
  body.wakeUp();
}

/** Roll + sidespin from shot speed and carry swing (not zeroed on release). */
export function computeBallReleaseSpin(
  launchVel: THREE.Vector3,
  swingVel: THREE.Vector3,
): { x: number; y: number; z: number } {
  const speed = launchVel.length();
  if (speed < 1.2) return { x: 0, y: 0, z: 0 };

  const horiz = Math.hypot(launchVel.x, launchVel.z);
  if (horiz < 0.4) return { x: 0, y: 0, z: 0 };

  const rollOmega =
    (horiz / BALL.radius) * BALL.launchSpinScale * 0.85;
  _rollAxis.set(launchVel.z, 0, -launchVel.x);
  if (_rollAxis.lengthSq() > 1e-6) _rollAxis.normalize();

  let wx = _rollAxis.x * rollOmega;
  let wz = _rollAxis.z * rollOmega;
  let wy = 0;

  _swing.copy(swingVel);
  const swingHoriz = Math.hypot(_swing.x, _swing.z);
  if (swingHoriz > 0.35) {
    _launch.set(launchVel.x, 0, launchVel.z).normalize();
    const side = _swing.x * _launch.z - _launch.x * _swing.z;
    wy = Math.sign(side || 1) * Math.min(7, swingHoriz * 0.45);
  }

  return { x: wx, y: wy, z: wz };
}

export function applyBallLaunchImpulse(
  body: RapierRigidBody,
  launchVel: THREE.Vector3,
  swingVel: THREE.Vector3,
): void {
  let x = launchVel.x;
  let y = launchVel.y;
  let z = launchVel.z;
  const spd = Math.hypot(x, y, z);
  if (spd > BALL.maxSpeed) {
    const s = BALL.maxSpeed / spd;
    x *= s;
    y *= s;
    z *= s;
  }

  body.setLinvel({ x, y, z }, true);
  _launch.set(x, y, z);
  const spin = computeBallReleaseSpin(_launch, swingVel);
  body.setAngvel(spin, true);
  wakeBallBody(body);
}
