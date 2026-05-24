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
