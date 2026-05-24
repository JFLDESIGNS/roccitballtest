import * as THREE from 'three';
import { ROCKET } from '../shared/Constants';

export const EXPLOSION_SPRITE_POOL_SIZE = 16;

export type ExplosionSpriteSlot = {
  active: boolean;
  pos: THREE.Vector3;
  radius: number;
  born: number;
};

export function createExplosionSpritePool(): ExplosionSpriteSlot[] {
  return Array.from({ length: EXPLOSION_SPRITE_POOL_SIZE }, () => ({
    active: false,
    pos: new THREE.Vector3(),
    radius: ROCKET.explosionRadius,
    born: 0,
  }));
}

export function spawnExplosionSprite(
  pool: ExplosionSpriteSlot[],
  x: number,
  y: number,
  z: number,
  radius: number,
) {
  let slot = pool.find((s) => !s.active);
  if (!slot) {
    let oldest = pool[0]!;
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

export function tickExplosionSpritePool(pool: ExplosionSpriteSlot[], nowSec: number) {
  const dur = ROCKET.explosionVisualDuration;
  for (const slot of pool) {
    if (slot.active && nowSec - slot.born >= dur) slot.active = false;
  }
}

export function explosionSpriteFrameIndex(elapsedSec: number): number {
  const dur = ROCKET.explosionVisualDuration;
  const frames = ROCKET.explosionSpriteFrames;
  const t = THREE.MathUtils.clamp(elapsedSec / dur, 0, 0.999);
  return Math.min(frames - 1, Math.floor(t * frames));
}

export function applyExplosionSpriteSheetFrame(
  texture: THREE.Texture,
  frameIndex: number,
  cols: number,
  rows: number,
) {
  const col = frameIndex % cols;
  const row = Math.floor(frameIndex / cols);
  texture.repeat.set(1 / cols, 1 / rows);
  texture.offset.set(col / cols, 1 - (row + 1) / rows);
}
