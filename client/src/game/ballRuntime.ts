import type { RapierRigidBody } from '@react-three/rapier';
import { ARENA, BALL } from '../shared/Constants';
import {
  clampToHex,
  hexBoundaryNormal,
  hexSlackToBoundary,
} from './arenaHex';

const floorY = ARENA.floorY + BALL.radius + 0.06;
const playRadius = ARENA.hexRadius - 1.2;

/**
 * After Rapier step: light floor help + wall unstick only (never steal inbound shots).
 */
export function stepBallPhysics(body: RapierRigidBody): void {
  applyBallFloorAssist(body);
  applyBallWallBounceAssist(body);
  clampBallSpeed(body);
}

/** Soft floor — lighter bounce than Rapier material alone. */
export function applyBallFloorAssist(body: RapierRigidBody): void {
  const t = body.translation();
  if (t.y >= floorY) return;

  const v = body.linvel();
  const depth = floorY - t.y;
  const horiz = Math.hypot(v.x, v.z);

  if (depth > 0.35) {
    body.setTranslation({ x: t.x, y: floorY, z: t.z }, true);
  } else if (depth > 0.04 && horiz < 10) {
    body.setTranslation({ x: t.x, y: floorY + depth * 0.2, z: t.z }, true);
  }

  if (v.y < 0) {
    let bounce = Math.abs(v.y) * BALL.restitution;
    if (horiz > 5) {
      bounce = Math.max(bounce, 0.75);
    }
    bounce = Math.min(bounce, Math.max(horiz * 0.15, 3));
    body.setLinvel({ x: v.x, y: bounce, z: v.z }, true);
  }
}

/**
 * Only when overlapping the hex or stuck on a wall at low speed.
 * Does NOT run on fast inbound shots still deep in the arena — Rapier owns that bounce.
 */
export function applyBallWallBounceAssist(body: RapierRigidBody): void {
  const t = body.translation();
  const v = body.linvel();
  const horizSpd = Math.hypot(v.x, v.z);
  if (horizSpd < 0.12) return;

  const slack = hexSlackToBoundary(t.x, t.z, playRadius);
  const outside = slack < 0;
  const nearWall = slack < 0.55;

  if (!outside && !nearWall) return;
  if (!outside && slack > 1.4) return;

  const n = hexBoundaryNormal(t.x, t.z, playRadius);
  const vn = v.x * n.x + v.z * n.y;

  if (!outside) {
    if (horizSpd > 10 && vn < -2) return;
    if (vn > -0.5 && horizSpd > 3) return;
  }

  const rest = BALL.restitution;
  let vx = v.x;
  let vz = v.z;

  if (vn < -0.25) {
    vx -= (1 + rest) * vn * n.x;
    vz -= (1 + rest) * vn * n.y;
  }

  let outDot = vx * n.x + vz * n.y;
  const inbound = Math.max(horizSpd, Math.abs(vn));
  const minOut = Math.max(
    3.5,
    inbound * rest * (outside ? 0.9 : 0.65),
  );

  if (outDot < minOut) {
    vx += n.x * (minOut - outDot);
    vz += n.y * (minOut - outDot);
  }

  if (outside || slack < 0.15) {
    const clamped = clampToHex(t.x, t.z, playRadius, BALL.radius * 0.4);
    body.setTranslation({ x: clamped.x, y: t.y, z: clamped.z }, true);
  }

  body.setLinvel({ x: vx, y: v.y, z: vz }, true);
}

/** Keep rolls fast — only trim extreme outliers */
export function clampBallSpeed(body: RapierRigidBody): void {
  const v = body.linvel();
  const speed = Math.hypot(v.x, v.y, v.z);
  if (speed <= BALL.maxSpeed) return;
  const s = BALL.maxSpeed / speed;
  body.setLinvel({ x: v.x * s, y: v.y * s, z: v.z * s }, true);
}
