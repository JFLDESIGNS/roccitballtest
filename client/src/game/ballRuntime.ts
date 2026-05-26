import type { RapierRigidBody } from '@react-three/rapier';
import { ARENA, BALL, SUPERBALL } from '../shared/Constants';
import { clampToHex, hexSlackToBoundary } from './arenaHex';
import { sanitizeFanGlassBallBounce } from './ballFanGlassBounce';
import { tickGoalRimBallBounce } from './goalRingBounce';
import { gameStore } from './gameStore';
import { tuningStore } from './tuningStore';
import * as THREE from 'three';

function ballMaxSpeed(): number {
  return tuningStore.getState().ballType === 'superball'
    ? SUPERBALL.maxSpeed
    : BALL.maxSpeed;
}

const floorY = ARENA.floorY + BALL.radius + 0.06;
/**
 * Loose hex for the assist check — aligned near Rapier walls, not shrunk by ball radius.
 * Smaller inset = assist volume only on real tunneling, not normal bounces.
 */
const playRadius = ARENA.hexRadius - 0.35;
/** Must be this far past the boundary (m) before unstick — keeps "helping" rare */
const wallPenetrationMin = BALL.radius + 1.25;
const floorPenetrationMin = 0.22;

const _ballFrom = new THREE.Vector3();
const _ballTo = new THREE.Vector3();
const goalRimBounceCooldown = { current: 0 };

/**
 * After Rapier step: rare unstick only. Wall bounces stay on Rapier materials.
 */
export function stepBallPhysics(
  body: RapierRigidBody,
  prev?: THREE.Vector3,
  dt = 1 / 60,
): void {
  sanitizeFanGlassBallBounce(body);
  if (prev) {
    const t = body.translation();
    _ballFrom.copy(prev);
    _ballTo.set(t.x, t.y, t.z);
    tickGoalRimBallBounce(body, _ballFrom, _ballTo, goalRimBounceCooldown, dt);
  }
  applyBallFloorAssist(body);
  applyBallWallUnstick(body);
  clampBallSpeed(body);
}

/** Snap only when the ball center sinks through the floor collider */
export function applyBallFloorAssist(body: RapierRigidBody): void {
  const t = body.translation();
  const depth = floorY - t.y;
  if (depth < floorPenetrationMin) return;

  gameStore.notifyBallBoundaryHelp();
  body.setTranslation({ x: t.x, y: floorY, z: t.z }, true);

  const v = body.linvel();
  if (v.y < -0.8) {
    body.setLinvel(
      {
        x: v.x,
        y: Math.min(Math.abs(v.y) * BALL.restitution, ballMaxSpeed() * 0.45),
        z: v.z,
      },
      true,
    );
  }
}

/**
 * Nudge the ball back inside only on deep hex overlap (tunneling).
 * Never re-reflect velocity — Rapier already handled the bounce.
 */
export function applyBallWallUnstick(body: RapierRigidBody): void {
  const t = body.translation();
  const slack = hexSlackToBoundary(t.x, t.z, playRadius);
  if (slack >= -wallPenetrationMin) return;

  gameStore.notifyBallBoundaryHelp();
  const clamped = clampToHex(t.x, t.z, playRadius, 0.35);
  body.setTranslation({ x: clamped.x, y: t.y, z: clamped.z }, true);
}

/** @deprecated use applyBallWallUnstick */
export function applyBallWallBounceAssist(body: RapierRigidBody): void {
  applyBallWallUnstick(body);
}

/** Keep rolls fast — only trim extreme outliers */
export function clampBallSpeed(body: RapierRigidBody): void {
  const v = body.linvel();
  const speed = Math.hypot(v.x, v.y, v.z);
  const cap = ballMaxSpeed();
  if (speed <= cap) return;
  const s = cap / speed;
  body.setLinvel({ x: v.x * s, y: v.y * s, z: v.z * s }, true);
}
