import type { RapierRigidBody } from '@react-three/rapier';
import { interactionGroups } from '@react-three/rapier';
import * as THREE from 'three';
import { BALL } from '../shared/Constants';

/** Ball collider membership — group 1 */
const BALL_LOOSE_COLLISION = interactionGroups(1, [0, 1, 2, 4]);
/** After kickoff — skip ball-drop (group 4) briefly so the ball can fall out */
const BALL_NO_DROP_COLLISION = interactionGroups(1, [0, 1, 2]);
/** Held: collide with arena (group 2) only — not player/bots/ball */
const BALL_HELD_COLLISION = interactionGroups(1, [2]);

let ballDropGraceUntilMs = 0;

export function armBallDropCollisionGrace(seconds = 3): void {
  ballDropGraceUntilMs = performance.now() + seconds * 1000;
}

function ballDropGraceActive(): boolean {
  return performance.now() < ballDropGraceUntilMs;
}

function looseBallCollisionGroups(): number {
  return ballDropGraceActive()
    ? BALL_NO_DROP_COLLISION
    : BALL_LOOSE_COLLISION;
}

const _rollAxis = new THREE.Vector3();
const _spinNormal = new THREE.Vector3();
const _spinContact = new THREE.Vector3();
const _spinCross = new THREE.Vector3();
const _spinTangent = new THREE.Vector3();

export type PendingSpinBounce = {
  nx: number;
  ny: number;
  nz: number;
  impact: number;
};

/** After Rapier resolves contact — spin at the surface steers the bounce. */
export function applyBallSpinBounce(
  body: RapierRigidBody,
  normal: { nx: number; ny: number; nz: number },
): void {
  const av = body.angvel();
  const lv = body.linvel();
  const r = BALL.radius;
  const spinMag = Math.hypot(av.x, av.y, av.z);
  if (spinMag < 0.8) return;

  _spinNormal.set(normal.nx, normal.ny, normal.nz);
  if (_spinNormal.lengthSq() < 1e-6) return;
  _spinNormal.normalize();

  _spinContact.copy(_spinNormal).multiplyScalar(-r);
  _spinCross
    .set(
      av.y * _spinContact.z - av.z * _spinContact.y,
      av.z * _spinContact.x - av.x * _spinContact.z,
      av.x * _spinContact.y - av.y * _spinContact.x,
    );

  const alongNormal =
    _spinCross.x * _spinNormal.x +
    _spinCross.y * _spinNormal.y +
    _spinCross.z * _spinNormal.z;
  _spinTangent
    .copy(_spinCross)
    .addScaledVector(_spinNormal, -alongNormal);

  const tanMag = _spinTangent.length();
  if (tanMag < 0.12) return;

  const coupling = BALL.spinBounceCoupling;
  const transfer = BALL.spinBounceTransfer;
  const blend = Math.min(1, tanMag / (BALL.maxSpeed * 0.35));

  body.setLinvel(
    {
      x: lv.x + _spinTangent.x * coupling * blend,
      y: lv.y + _spinTangent.y * coupling * blend,
      z: lv.z + _spinTangent.z * coupling * blend,
    },
    true,
  );
  body.setAngvel(
    {
      x: av.x * (1 - transfer * blend),
      y: av.y * (1 - transfer * blend),
      z: av.z * (1 - transfer * blend),
    },
    true,
  );
  wakeBallBody(body);
}

/** Toggle held vs loose without React remounting the collider (avoids grab hitch). */
export function setBallHeldCollider(body: RapierRigidBody, held: boolean): void {
  const collider = body.collider(0);
  if (!collider) return;
  // Sensor while held — kinematic socket + raycast resolve; solid collider fights teleport.
  collider.setSensor(held);
  collider.setCollisionGroups(
    held ? BALL_HELD_COLLISION : looseBallCollisionGroups(),
  );
}

/** Re-apply loose collision groups after kickoff grace window */
export function syncBallLooseCollision(body: RapierRigidBody): void {
  const collider = body.collider(0);
  if (!collider) return;
  collider.setSensor(false);
  collider.setCollisionGroups(looseBallCollisionGroups());
}

export function wakeBallBody(body: RapierRigidBody): void {
  body.wakeUp();
}

/** Natural roll from horizontal launch speed (no swing sidespin). */
export function computeBallReleaseSpin(
  launchVel: THREE.Vector3,
): { x: number; y: number; z: number } {
  const horiz = Math.hypot(launchVel.x, launchVel.z);
  if (horiz < 0.4) return { x: 0, y: 0, z: 0 };

  const rollOmega = (horiz / BALL.radius) * BALL.launchSpinScale;
  _rollAxis.set(launchVel.z, 0, -launchVel.x).normalize();
  return {
    x: _rollAxis.x * rollOmega,
    y: 0,
    z: _rollAxis.z * rollOmega,
  };
}

export function applyBallLaunchImpulse(
  body: RapierRigidBody,
  launchVel: THREE.Vector3,
  _swingVel?: THREE.Vector3,
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
  body.setAngvel(computeBallReleaseSpin(launchVel), true);
  wakeBallBody(body);
}
