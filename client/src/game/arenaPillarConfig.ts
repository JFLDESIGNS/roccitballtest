import * as THREE from 'three';
import { ARENA, BALL } from '../shared/Constants';

const PILLAR_THICKNESS_SCALE = 3;

/** Shared pillar dimensions — no gameplay imports (avoids circular module loads) */
export const ARENA_PILLAR = {
  height: ARENA.wallHeight,
  capHeight: 1.16,
  radiusTop: 2.35 * PILLAR_THICKNESS_SCALE,
  radiusBase: 2.95 * PILLAR_THICKNESS_SCALE,
  colliderRadius: 2.95 * PILLAR_THICKNESS_SCALE,
  hexInset: 1.8,
  ringMajor: 3.35 * PILLAR_THICKNESS_SCALE,
  ringTube: 0.18 * PILLAR_THICKNESS_SCALE,
  ringGlowScale: 1.22,
  floorY: ARENA.floorY,
  bounceRestitution: BALL.restitution,
} as const;

/** World Y of the top of the pillar cap — roof slabs sit on this */
export function arenaPillarTopWorldY(): number {
  return ARENA_PILLAR.floorY + ARENA_PILLAR.height + ARENA_PILLAR.capHeight;
}

export function pillarSurfaceRadiusAtY(y: number): number {
  const t = THREE.MathUtils.clamp(
    (y - ARENA_PILLAR.floorY) / Math.max(ARENA_PILLAR.height, 0.001),
    0,
    1,
  );
  return THREE.MathUtils.lerp(
    ARENA_PILLAR.radiusBase,
    ARENA_PILLAR.radiusTop,
    t,
  );
}
