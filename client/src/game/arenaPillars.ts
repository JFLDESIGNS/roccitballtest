import * as THREE from 'three';
import { ARENA, ROCKET } from '../shared/Constants';
import { hexVertices } from './arenaHex';
import type { ActiveRocket } from './rocketSystem';
import {
  ARENA_PILLAR,
  pillarSurfaceRadiusAtY,
} from './arenaPillarConfig';

export { ARENA_PILLAR, pillarSurfaceRadiusAtY };

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

export function rotateXZNormal(nx: number, nz: number, angleRad: number) {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return { nx: nx * c - nz * s, nz: nx * s + nz * c };
}

/** Point + outward normal on pillar surface for scorch decals */
export function pillarScorchSurfaceAt(
  cx: number,
  cz: number,
  y: number,
  outwardNx: number,
  outwardNz: number,
) {
  const surfaceR = pillarSurfaceRadiusAtY(y);
  return {
    x: cx + outwardNx * surfaceR,
    y,
    z: cz + outwardNz * surfaceR,
    nx: outwardNx,
    ny: 0,
    nz: outwardNz,
  };
}

function pillarOutwardNormal(
  cx: number,
  cz: number,
  pos: THREE.Vector3,
): { cx: number; cz: number; nx: number; ny: number; nz: number } {
  let nx = pos.x - cx;
  let nz = pos.z - cz;
  const len = Math.hypot(nx, nz);
  if (len < 1e-4) {
    nx = cx;
    nz = cz;
    const fallback = Math.hypot(nx, nz) || 1;
    nx /= fallback;
    nz /= fallback;
  } else {
    nx /= len;
    nz /= len;
  }
  return { cx, cz, nx, ny: 0, nz };
}

/** Radial scorch orientation when a blast hits a corner pillar */
export function resolveArenaPillarScorch(
  prev: THREE.Vector3,
  pos: THREE.Vector3,
): { cx: number; cz: number; nx: number; ny: number; nz: number } | null {
  const segHit = findArenaPillarSegmentHit(prev, pos, 0.45);
  if (segHit) {
    return pillarOutwardNormal(segHit.x, segHit.z, pos);
  }

  const nearR = ARENA_PILLAR.colliderRadius + 0.65;
  const nearRSq = nearR * nearR;
  let best: { cx: number; cz: number; distSq: number } | null = null;
  for (const p of getArenaCornerPillarLayouts()) {
    const dx = pos.x - p.x;
    const dz = pos.z - p.z;
    const distSq = dx * dx + dz * dz;
    if (distSq <= nearRSq && (!best || distSq < best.distSq)) {
      best = { cx: p.x, cz: p.z, distSq };
    }
  }
  if (!best) return null;
  return pillarOutwardNormal(best.cx, best.cz, pos);
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

    void import('./visualShake').then(({ triggerArenaPillarShake }) => {
      triggerArenaPillarShake(p.x, p.z);
    });

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
