import * as THREE from 'three';
import { ROCKET } from '../shared/Constants';

export const SPLASH_POOL_SIZE = 12;

export type FxWorldPos = { x: number; y: number; z: number };
export type FxFollowAnchor = () => FxWorldPos | null;

export type SplashSlot = {
  active: boolean;
  pos: THREE.Vector3;
  radius: number;
  born: number;
  follow: FxFollowAnchor | null;
};

export function createSplashPool(): SplashSlot[] {
  return Array.from({ length: SPLASH_POOL_SIZE }, () => ({
    active: false,
    pos: new THREE.Vector3(),
    radius: ROCKET.explosionRadius,
    born: 0,
    follow: null,
  }));
}

export function spawnSplash(
  pool: SplashSlot[],
  x: number,
  y: number,
  z: number,
  radius: number,
  follow: FxFollowAnchor | null = null,
) {
  let slot = pool.find((s) => !s.active);
  if (!slot) {
    let oldest = pool[0];
    for (const s of pool) {
      if (s.born < oldest.born) oldest = s;
    }
    slot = oldest;
  }
  slot.active = true;
  slot.pos.set(x, y, z);
  slot.radius = radius;
  slot.born = performance.now() / 1000;
  slot.follow = follow ?? null;
}

/** World-fixed burst — never pass a follow anchor (ragdoll electric uses BotRagdollBurstFx). */
export function spawnSplashFixed(
  pool: SplashSlot[],
  x: number,
  y: number,
  z: number,
  radius: number,
) {
  spawnSplash(pool, x, y, z, radius, null);
}

export function applySplashFollow(pool: SplashSlot[]): void {
  for (const slot of pool) {
    if (!slot.active || !slot.follow) continue;
    const p = slot.follow();
    if (p) slot.pos.set(p.x, p.y, p.z);
  }
}

export function tickSplashPool(pool: SplashSlot[], nowSec: number) {
  const dur = ROCKET.explosionVisualDuration;
  for (const s of pool) {
    if (s.active && nowSec - s.born >= dur) s.active = false;
  }
}
