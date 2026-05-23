import * as THREE from 'three';
import { ARENA, ROCKET } from '../shared/Constants';
import { tuningStore } from './tuningStore';
import type { Vec3 } from '../shared/Types';
import { getMaxPlatformSurfaceY } from './arenaSpawn';
import {
  rocketSegmentHitsArenaPillar,
  tryArenaPillarRocketBounce,
} from './arenaPillars';
import { clampToHex, hexBoundaryNormal, isInsideHex } from './arenaHex';

export type ActiveRocket = {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  spawnPos: THREE.Vector3;
  ownerId: string;
  spawnTime: number;
  bouncesLeft: number;
  /** Detonates on first contact — no ricochet */
  explosive: boolean;
};

let nextId = 0;

export function createRocket(
  origin: Vec3,
  direction: Vec3,
  ownerId: string,
  inheritedVelocity?: Vec3,
  explosive = false,
): ActiveRocket {
  const dir = new THREE.Vector3(direction.x, direction.y, direction.z).normalize();
  const velocity = dir.clone().multiplyScalar(tuningStore.getState().rocketSpeed);

  if (inheritedVelocity) {
    const k = ROCKET.velocityInherit;
    velocity.x += inheritedVelocity.x * k;
    velocity.y += inheritedVelocity.y * k;
    velocity.z += inheritedVelocity.z * k;
  }

  const speed = velocity.length();
  if (speed > ROCKET.maxSpeed) {
    velocity.multiplyScalar(ROCKET.maxSpeed / speed);
  }

  const spawnPos = new THREE.Vector3(origin.x, origin.y, origin.z);
  return {
    id: `r-${++nextId}`,
    position: spawnPos.clone(),
    velocity,
    spawnPos,
    ownerId,
    spawnTime: performance.now() / 1000,
    bouncesLeft: explosive ? 0 : ROCKET.surfaceBounces,
    explosive,
  };
}

function rocketHitsPlatformSurface(
  prev: THREE.Vector3,
  pos: THREE.Vector3,
): boolean {
  const samples = 5;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const px = prev.x + (pos.x - prev.x) * t;
    const py = prev.y + (pos.y - prev.y) * t;
    const pz = prev.z + (pos.z - prev.z) * t;
    const surf = getMaxPlatformSurfaceY(px, pz);
    if (surf === null) continue;
    if (py <= surf + 0.45) return true;
  }
  return false;
}

function detectExplosiveSurfaceHit(
  prev: THREE.Vector3,
  pos: THREE.Vector3,
  arenaRadius: number,
): boolean {
  if (prev.y >= 0.4 && pos.y < 0.4) return true;
  if (rocketHitsPlatformSurface(prev, pos)) return true;
  if (rocketSegmentHitsArenaPillar(prev, pos)) return true;
  const ceiling = ARENA.wallHeight;
  if (prev.y <= ceiling - 0.35 && pos.y > ceiling - 0.35) return true;

  const playR = arenaRadius - 0.6;
  const wasIn = isInsideHex(prev.x, prev.z, playR);
  const nowIn = isInsideHex(pos.x, pos.z, playR);
  if (wasIn && !nowIn) return true;
  if (!nowIn) return true;
  return false;
}

const _ab = new THREE.Vector3();
const _ac = new THREE.Vector3();
const _closest = new THREE.Vector3();

/** Swept segment vs sphere — catches fast rockets passing through the ball in one frame */
export function segmentHitsSphere(
  from: THREE.Vector3,
  to: THREE.Vector3,
  center: THREE.Vector3,
  radius: number,
): boolean {
  const ab = _ab.subVectors(to, from);
  const lenSq = ab.lengthSq();
  if (lenSq < 1e-8) return from.distanceTo(center) <= radius;

  const ac = _ac.subVectors(center, from);
  const t = Math.max(0, Math.min(1, ac.dot(ab) / lenSq));
  _closest.copy(from).addScaledVector(ab, t);
  return _closest.distanceTo(center) <= radius;
}

const _wallNormal = new THREE.Vector2();
const _stepPrev = new THREE.Vector3();

function reflectVelocityOffWall(
  velocity: THREE.Vector3,
  normal: THREE.Vector2,
  rest: number,
): void {
  const vDotN = velocity.x * normal.x + velocity.z * normal.y;
  if (vDotN > 0) {
    velocity.x = (velocity.x - 2 * vDotN * normal.x) * rest;
    velocity.z = (velocity.z - 2 * vDotN * normal.y) * rest;
  } else {
    velocity.x *= -rest;
    velocity.z *= -rest;
  }
}

function tryPlatformBounce(
  r: ActiveRocket,
  prev: THREE.Vector3,
  pos: THREE.Vector3,
): boolean {
  const rest = ROCKET.bounceRestitution;
  const samples = 8;
  let bestSurf: number | null = null;
  let hitT = -1;
  let lastPy = prev.y;

  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const px = prev.x + (pos.x - prev.x) * t;
    const py = prev.y + (pos.y - prev.y) * t;
    const pz = prev.z + (pos.z - prev.z) * t;
    const surf = getMaxPlatformSurfaceY(px, pz);
    if (surf !== null && lastPy > surf + 0.32 && py <= surf + 0.52) {
      if (bestSurf === null || surf >= bestSurf) {
        bestSurf = surf;
        hitT = t;
      }
    }
    lastPy = py;
  }

  if (bestSurf === null || hitT < 0) return false;

  pos.x = prev.x + (pos.x - prev.x) * hitT;
  pos.z = prev.z + (pos.z - prev.z) * hitT;
  pos.y = bestSurf + 0.44;
  r.velocity.y = Math.abs(r.velocity.y) * rest;

  const horiz = Math.hypot(r.velocity.x, r.velocity.z);
  if (horiz > 0.5) {
    const damp = 0.9;
    r.velocity.x *= damp;
    r.velocity.z *= damp;
  }

  return true;
}

function trySurfaceBounce(
  r: ActiveRocket,
  prev: THREE.Vector3,
  pos: THREE.Vector3,
  arenaRadius: number,
): boolean {
  if (r.bouncesLeft <= 0) return false;

  const rest = ROCKET.bounceRestitution;
  let bounced = false;

  if (tryPlatformBounce(r, prev, pos)) {
    r.bouncesLeft -= 1;
    return true;
  }

  if (tryArenaPillarRocketBounce(r, prev, pos)) {
    return true;
  }

  if (prev.y >= 0.4 && pos.y < 0.4) {
    pos.y = 0.42;
    r.velocity.y = Math.abs(r.velocity.y) * rest;
    bounced = true;
  }

  const ceiling = ARENA.wallHeight;
  if (prev.y <= ceiling - 0.35 && pos.y > ceiling - 0.35) {
    pos.y = ceiling - 0.35;
    r.velocity.y = -Math.abs(r.velocity.y) * rest;
    bounced = true;
  }

  const margin = 0.6;
  const playR = arenaRadius - margin;
  const wasInside = isInsideHex(prev.x, prev.z, playR);
  const nowInside = isInsideHex(pos.x, pos.z, playR);

  if (wasInside && !nowInside) {
    const midX = (prev.x + pos.x) * 0.5;
    const midZ = (prev.z + pos.z) * 0.5;
    _wallNormal.copy(hexBoundaryNormal(midX, midZ, playR));

    reflectVelocityOffWall(r.velocity, _wallNormal, rest);

    const clamped = clampToHex(pos.x, pos.z, playR, 0.25);
    pos.x = clamped.x - _wallNormal.x * 0.15;
    pos.z = clamped.z - _wallNormal.y * 0.15;

    const inside = clampToHex(pos.x, pos.z, playR, 0.2);
    pos.x = inside.x;
    pos.z = inside.z;

    bounced = true;
  } else if (!nowInside && r.bouncesLeft > 0) {
    _wallNormal.copy(hexBoundaryNormal(pos.x, pos.z, playR));
    const vDotN = r.velocity.x * _wallNormal.x + r.velocity.z * _wallNormal.y;
    if (vDotN > 0) {
      reflectVelocityOffWall(r.velocity, _wallNormal, rest);
      const inside = clampToHex(pos.x, pos.z, playR, 0.25);
      pos.x = inside.x;
      pos.z = inside.z;
      bounced = true;
    }
  }

  if (bounced) {
    r.bouncesLeft -= 1;
    return true;
  }
  return false;
}

export function updateRockets(
  rockets: ActiveRocket[],
  dt: number,
  arenaHalf: { w: number; d: number; h: number },
): { rockets: ActiveRocket[]; explosions: Vec3[] } {
  const explosions: Vec3[] = [];
  const now = performance.now() / 1000;
  const remaining: ActiveRocket[] = [];

  const arenaRadius = arenaHalf.w;

  for (const r of rockets) {
    _stepPrev.copy(r.position);
    r.position.addScaledVector(r.velocity, dt);
    const pos = r.position;
    const { x, y, z } = pos;
    const farOut =
      Math.abs(x) > arenaRadius + 8 ||
      Math.abs(z) > arenaRadius + 8 ||
      y < -2 ||
      y > arenaHalf.h + 8;
    const expired = now - r.spawnTime > ROCKET.lifetime;

    if (farOut || expired) {
      explosions.push({ x, y: Math.max(y, 0.5), z });
      continue;
    }

    const traveled = rocketTravelDist(r);
    if (
      r.explosive &&
      traveled >= 1.1 &&
      detectExplosiveSurfaceHit(_stepPrev, pos, arenaRadius)
    ) {
      explosions.push({ x, y: Math.max(y, 0.5), z });
      continue;
    }

    if (
      !r.explosive &&
      (trySurfaceBounce(r, _stepPrev, pos, arenaRadius) ||
        tryArenaPillarRocketBounce(r, _stepPrev, pos))
    ) {
      remaining.push(r);
      continue;
    }

    const playMargin = arenaRadius - 0.4;
    const stuckFloor = y <= 0.35 && r.bouncesLeft <= 0;
    const stuckCeiling = y >= arenaHalf.h - 0.2 && r.bouncesLeft <= 0;
    const outside = !isInsideHex(x, z, playMargin);
    const n = hexBoundaryNormal(x, z, playMargin);
    const escaping = r.velocity.x * n.x + r.velocity.z * n.y > 0.5;
    const stuckWall = outside && r.bouncesLeft <= 0 && escaping;

    if (stuckFloor || stuckCeiling || stuckWall) {
      explosions.push({ x, y: Math.max(y, 0.5), z });
      continue;
    }

    remaining.push(r);
  }

  return { rockets: remaining, explosions };
}

export function splashDamageFactor(dist: number): number {
  const t = 1 - dist / ROCKET.explosionRadius;
  if (t <= 0) return 0;
  return (
    ROCKET.energyDamageSplashMin +
    t * (ROCKET.energyDamageSplashMax - ROCKET.energyDamageSplashMin)
  );
}

export function rocketAge(r: ActiveRocket): number {
  return performance.now() / 1000 - r.spawnTime;
}

export function rocketTravelDist(r: ActiveRocket): number {
  return r.position.distanceTo(r.spawnPos);
}
