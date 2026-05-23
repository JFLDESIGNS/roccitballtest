import * as THREE from 'three';
import { ARENA, BALL, ROCKET } from '../shared/Constants';
import { hexVertices } from './arenaHex';
import type { ActiveRocket } from './rocketSystem';
import { triggerArenaPillarShake } from './visualShake';

const PILLAR_THICKNESS_SCALE = 3;

export const ARENA_PILLAR = {
  height: ARENA.wallHeight,
  radiusTop: 2.35 * PILLAR_THICKNESS_SCALE,
  radiusBase: 2.95 * PILLAR_THICKNESS_SCALE,
  /** Collider uses the wider base radius */
  colliderRadius: 2.95 * PILLAR_THICKNESS_SCALE,
  hexInset: 1.8,
  ringMajor: 3.35 * PILLAR_THICKNESS_SCALE,
  ringTube: 0.18 * PILLAR_THICKNESS_SCALE,
  ringGlowScale: 1.22,
  floorY: ARENA.floorY,
  bounceRestitution: BALL.restitution,
} as const;

export type ArenaPillarLayout = {
  x: number;
  z: number;
  colorIndex: number;
};

export function getArenaCornerPillarLayouts(): ArenaPillarLayout[] {
  return hexVertices(ARENA.hexRadius - ARENA_PILLAR.hexInset).map((v, i) => ({
    x: v.x,
    z: v.y,
    colorIndex: i,
  }));
}

const _push = new THREE.Vector2();

function segmentHitsCircleXZ(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
  radius: number,
): boolean {
  const abx = bx - ax;
  const abz = bz - az;
  const lenSq = abx * abx + abz * abz;
  if (lenSq < 1e-8) {
    const dx = ax - cx;
    const dz = az - cz;
    return dx * dx + dz * dz <= radius * radius;
  }
  const acx = cx - ax;
  const acz = cz - az;
  const t = Math.max(0, Math.min(1, (acx * abx + acz * abz) / lenSq));
  const px = ax + abx * t;
  const pz = az + abz * t;
  const dx = px - cx;
  const dz = pz - cz;
  return dx * dx + dz * dz <= radius * radius;
}

function segmentHitsVerticalCylinder(
  from: THREE.Vector3,
  to: THREE.Vector3,
  cx: number,
  cz: number,
  radius: number,
  yMin: number,
  yMax: number,
): boolean {
  const yLo = Math.min(from.y, to.y);
  const yHi = Math.max(from.y, to.y);
  if (yHi < yMin || yLo > yMax) return false;
  return segmentHitsCircleXZ(from.x, from.z, to.x, to.z, cx, cz, radius);
}

/** Swept rocket vs corner pillars */
export function rocketSegmentHitsArenaPillar(
  from: THREE.Vector3,
  to: THREE.Vector3,
  rocketRadius = 0.45,
): boolean {
  return findArenaPillarSegmentHit(from, to, rocketRadius) !== null;
}

export function findArenaPillarSegmentHit(
  from: THREE.Vector3,
  to: THREE.Vector3,
  rocketRadius = 0.45,
): { x: number; z: number } | null {
  const r = ARENA_PILLAR.colliderRadius + rocketRadius;
  const yMin = ARENA_PILLAR.floorY;
  const yMax = ARENA_PILLAR.floorY + ARENA_PILLAR.height;
  for (const p of getArenaCornerPillarLayouts()) {
    if (segmentHitsVerticalCylinder(from, to, p.x, p.z, r, yMin, yMax)) {
      return { x: p.x, z: p.z };
    }
  }
  return null;
}

function pushOutOfPillarXZ(
  pos: THREE.Vector3,
  cx: number,
  cz: number,
  radius: number,
): boolean {
  _push.set(pos.x - cx, pos.z - cz);
  const d = _push.length();
  if (d >= radius || d < 1e-6) return false;
  _push.multiplyScalar(radius / d);
  pos.x = cx + _push.x;
  pos.z = cz + _push.y;
  return true;
}

/** Ricochet / explode helper for non-explosive rockets */
export function tryArenaPillarRocketBounce(
  r: ActiveRocket,
  prev: THREE.Vector3,
  pos: THREE.Vector3,
): boolean {
  if (r.bouncesLeft <= 0) return false;

  const hitR = ARENA_PILLAR.colliderRadius + 0.45;
  const yMin = ARENA_PILLAR.floorY;
  const yMax = ARENA_PILLAR.floorY + ARENA_PILLAR.height;
  const rest = ROCKET.bounceRestitution;

  for (const p of getArenaCornerPillarLayouts()) {
    if (
      !segmentHitsVerticalCylinder(prev, pos, p.x, p.z, hitR, yMin, yMax)
    ) {
      continue;
    }

    triggerArenaPillarShake(p.x, p.z);

    pushOutOfPillarXZ(pos, p.x, p.z, hitR + 0.08);

    _push.set(pos.x - p.x, pos.z - p.z);
    if (_push.lengthSq() < 1e-6) _push.set(1, 0);
    _push.normalize();

    const vDotN = r.velocity.x * _push.x + r.velocity.z * _push.y;
    if (vDotN > 0) {
      r.velocity.x -= 2 * vDotN * _push.x * rest;
      r.velocity.z -= 2 * vDotN * _push.y * rest;
    } else {
      r.velocity.x *= -rest;
      r.velocity.z *= -rest;
    }

    r.velocity.y = Math.abs(r.velocity.y) * rest * 0.85;
    r.bouncesLeft -= 1;
    return true;
  }

  return false;
}
