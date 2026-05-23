import * as THREE from 'three';
import { ROCKET } from '../shared/Constants';

export const SPLASH_POOL_SIZE = 12;

export type SplashSlot = {
  active: boolean;
  pos: THREE.Vector3;
  radius: number;
  born: number;
};

export function createSplashPool(): SplashSlot[] {
  return Array.from({ length: SPLASH_POOL_SIZE }, () => ({
    active: false,
    pos: new THREE.Vector3(),
    radius: ROCKET.explosionRadius,
    born: 0,
  }));
}

export function spawnSplash(
  pool: SplashSlot[],
  x: number,
  y: number,
  z: number,
  radius: number,
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
}

export function tickSplashPool(pool: SplashSlot[], nowSec: number) {
  const dur = ROCKET.explosionVisualDuration;
  for (const s of pool) {
    if (s.active && nowSec - s.born >= dur) s.active = false;
  }
}
