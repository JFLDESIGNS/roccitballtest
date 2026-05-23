import type { RapierRigidBody } from '@react-three/rapier';
import { ARENA } from '../shared/Constants';
import { isInsideHex } from './arenaHex';

export type SafePosition = { x: number; y: number; z: number };

export type FallTracker = {
  lastSafe: SafePosition;
  recordCooldown: number;
  fallCount: number;
};

export function createFallTracker(initial: SafePosition): FallTracker {
  return { lastSafe: { ...initial }, recordCooldown: 0, fallCount: 0 };
}

export const FALL_LIMITS = {
  minY: -5,
  maxY: ARENA.wallHeight + 6,
  hexMargin: 4,
} as const;

export function isValidWorldPosition(x: number, y: number, z: number): boolean {
  if (y < ARENA.floorY - 2 || y > FALL_LIMITS.maxY) return false;
  if (!isInsideHex(x, z, ARENA.hexRadius - FALL_LIMITS.hexMargin)) return false;
  return true;
}

export function shouldRecoverPosition(x: number, y: number, z: number): boolean {
  if (y < FALL_LIMITS.minY || y > FALL_LIMITS.maxY) return true;
  if (!isInsideHex(x, z, ARENA.hexRadius - 1)) return true;
  return false;
}

export function tickSafePosition(
  tracker: FallTracker,
  x: number,
  y: number,
  z: number,
  dt: number,
): void {
  tracker.recordCooldown -= dt;
  if (tracker.recordCooldown > 0) return;
  if (!isValidWorldPosition(x, y, z)) return;
  tracker.recordCooldown = 0.12;
  tracker.lastSafe.x = x;
  tracker.lastSafe.y = y;
  tracker.lastSafe.z = z;
}

export function recoverBody(
  body: RapierRigidBody,
  tracker: FallTracker,
  fallback: SafePosition,
  label: string,
): boolean {
  const t = body.translation();
  if (!shouldRecoverPosition(t.x, t.y, t.z)) return false;

  const safe = isValidWorldPosition(
    tracker.lastSafe.x,
    tracker.lastSafe.y,
    tracker.lastSafe.z,
  )
    ? tracker.lastSafe
    : fallback;

  tracker.fallCount += 1;
  console.warn(`[fall-recovery] ${label} #${tracker.fallCount} →`, safe);

  body.setTranslation({ x: safe.x, y: safe.y, z: safe.z }, true);
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  return true;
}
