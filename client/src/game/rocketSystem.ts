import * as THREE from 'three';
import { ARENA, ARENA_PADS, ROCKET } from '../shared/Constants';
import { tuningStore } from './tuningStore';
import type { Vec3 } from '../shared/Types';
import { getMaxPlatformSurfaceY } from './arenaSpawn';
import {
  bounceLaunchSpeedY,
  getBounceTrampolinePads,
} from './arenaPadLayout';
import {
  findArenaPillarSegmentHit,
  resolveArenaPillarScorch,
  rocketSegmentHitsArenaPillar,
  tryArenaPillarRocketBounce,
} from './arenaPillars';
import {
  rocketSegmentHitsBallDrop,
  tryBallDropRocketBounce,
} from './ballDropRocketCollision';
import { clampToHex, hexBoundaryNormal, isInsideHex } from './arenaHex';
import {
  refreshFanGlassBoxes,
  triggerFanGlassHit,
  trySegmentHitsFanGlassWithPoint,
  tryTriggerFanGlassFromWallImpact,
} from './fanGlassHit';
import {
  triggerArenaPillarShake,
  triggerBallDropShake,
  triggerBillboardShake,
  triggerCeilingWallHit,
  triggerOctagonShake,
} from './visualShake';
import { triggerBallDropSpotlightFrenzy } from './BallDropSpotlightCones';
import {
  findBillboardSegmentHit,
  tryTriggerOctagonImpactAt,
} from './interactableHits';
import { findGoalRimSegmentContact } from './goalRingBounce';

export type RocketTrailSegment = {
  from: THREE.Vector3;
  to: THREE.Vector3;
  explosive: boolean;
};

export type ActiveRocket = {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  spawnPos: THREE.Vector3;
  /** Start of the current flight leg (reset on each surface bounce) */
  segmentStart: THREE.Vector3;
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
  speedScale = 1,
): ActiveRocket {
  const tune = tuningStore.getState();
  if (!explosive && !tune.bouncyRocketsEnabled) {
    explosive = true;
  }
  const dir = new THREE.Vector3(direction.x, direction.y, direction.z).normalize();
  const velocity = dir
    .clone()
    .multiplyScalar(tuningStore.getState().rocketSpeed * speedScale);

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
    segmentStart: spawnPos.clone(),
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
  const samples = 8;
  let lastPy = prev.y;

  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const px = prev.x + (pos.x - prev.x) * t;
    const py = prev.y + (pos.y - prev.y) * t;
    const pz = prev.z + (pos.z - prev.z) * t;
    const surf = getMaxPlatformSurfaceY(px, pz);
    if (surf !== null && lastPy > surf + 0.32 && py <= surf + 0.52) {
      return true;
    }
    lastPy = py;
  }
  return false;
}

function rocketSegmentHitsCeiling(prev: THREE.Vector3, pos: THREE.Vector3): boolean {
  const ceiling = ARENA.wallHeight;
  return prev.y <= ceiling - 0.35 && pos.y > ceiling - 0.35;
}

function tryTriggerCeilingWallFromRocket(prev: THREE.Vector3, pos: THREE.Vector3): void {
  if (rocketSegmentHitsCeiling(prev, pos)) triggerCeilingWallHit();
}

function detectExplosiveSurfaceHit(
  prev: THREE.Vector3,
  pos: THREE.Vector3,
  arenaRadius: number,
): boolean {
  if (prev.y >= 0.4 && pos.y < 0.4) return true;
  if (rocketHitsPlatformSurface(prev, pos)) return true;
  if (rocketSegmentHitsArenaPillar(prev, pos)) return true;
  if (rocketSegmentHitsBallDrop(prev, pos)) return true;
  if (findBillboardSegmentHit(prev, pos)) return true;
  if (rocketSegmentHitsCeiling(prev, pos)) return true;

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

const _entry = new THREE.Vector3();

/** First point where the segment enters the sphere shell (for off-center ball hits). */
export function segmentSphereEntryPoint(
  from: THREE.Vector3,
  to: THREE.Vector3,
  center: THREE.Vector3,
  radius: number,
  out: THREE.Vector3 = _entry,
): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const fx = from.x - center.x;
  const fy = from.y - center.y;
  const fz = from.z - center.z;

  const a = dx * dx + dy * dy + dz * dz;
  if (a < 1e-10) {
    if (from.distanceTo(center) <= radius) {
      out.copy(from);
      return true;
    }
    return false;
  }

  const b = 2 * (fx * dx + fy * dy + fz * dz);
  const c = fx * fx + fy * fy + fz * fz - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return false;

  const sqrt = Math.sqrt(disc);
  const inv2a = 1 / (2 * a);
  const t0 = (-b - sqrt) * inv2a;
  const t1 = (-b + sqrt) * inv2a;

  let t = -1;
  if (t0 >= 0 && t0 <= 1) t = t0;
  else if (t1 >= 0 && t1 <= 1) t = t1;
  else return false;

  out.set(from.x + dx * t, from.y + dy * t, from.z + dz * t);
  return true;
}

const _impactContact = new THREE.Vector3();
const _impactNormal = new THREE.Vector3();

/**
 * Closest approach on the segment → outward surface normal + contact point.
 * Used for superball billiards knock even when the rocket detonates slightly early.
 */
export function segmentBallSurfaceImpact(
  from: THREE.Vector3,
  to: THREE.Vector3,
  center: THREE.Vector3,
  radius: number,
  outContact: THREE.Vector3 = _impactContact,
  outNormal: THREE.Vector3 = _impactNormal,
): boolean {
  const ab = _ab.subVectors(to, from);
  const lenSq = ab.lengthSq();

  if (lenSq < 1e-10) {
    const dist = from.distanceTo(center);
    if (dist < 1e-4) return false;
    outNormal.copy(from).sub(center).multiplyScalar(1 / dist);
    outContact.copy(center).addScaledVector(outNormal, radius);
    return true;
  }

  const ac = _ac.subVectors(center, from);
  let t = ac.dot(ab) / lenSq;
  t = Math.max(0, Math.min(1, t));
  outNormal.copy(from).addScaledVector(ab, t).sub(center);
  const dist = outNormal.length();

  if (dist > 1e-4) {
    outNormal.multiplyScalar(1 / dist);
  } else {
    ab.normalize();
    outNormal.copy(ab).negate();
  }

  outContact.copy(center).addScaledVector(outNormal, radius);
  return true;
}

export type RocketExplosionEvent = Vec3 & {
  scorchNx?: number;
  scorchNy?: number;
  scorchNz?: number;
  scorchKind?: 'wall' | 'floor' | 'ceiling' | 'pillar';
  scorchPillarCx?: number;
  scorchPillarCz?: number;
};

const _scorchNormal = new THREE.Vector3();

/** Surface normal for delayed wall/floor/pillar scorch decals */
export function resolveScorchSurface(
  prev: THREE.Vector3,
  pos: THREE.Vector3,
  arenaRadius: number,
  _arenaHeight: number,
): {
  nx: number;
  ny: number;
  nz: number;
  kind: 'wall' | 'floor' | 'ceiling' | 'pillar';
  pillarCx?: number;
  pillarCz?: number;
} | null {
  const playR = arenaRadius - 0.6;

  if (prev.y >= 0.4 && pos.y < 0.55) {
    return { nx: 0, ny: 1, nz: 0, kind: 'floor' };
  }

  if (rocketSegmentHitsCeiling(prev, pos)) {
    return { nx: 0, ny: -1, nz: 0, kind: 'ceiling' };
  }

  const pillar = resolveArenaPillarScorch(prev, pos);
  if (pillar) {
    return {
      nx: pillar.nx,
      ny: pillar.ny,
      nz: pillar.nz,
      kind: 'pillar',
      pillarCx: pillar.cx,
      pillarCz: pillar.cz,
    };
  }

  const wasIn = isInsideHex(prev.x, prev.z, playR);
  const nowIn = isInsideHex(pos.x, pos.z, playR);
  if ((wasIn && !nowIn) || !nowIn) {
    const n2 = hexBoundaryNormal(pos.x, pos.z, playR);
    _scorchNormal.set(-n2.x, 0, -n2.y);
    if (_scorchNormal.lengthSq() < 1e-6) _scorchNormal.set(0, 0, 1);
    else _scorchNormal.normalize();
    return {
      nx: _scorchNormal.x,
      ny: _scorchNormal.y,
      nz: _scorchNormal.z,
      kind: 'wall',
    };
  }

  if (pos.y < 0.75) {
    return { nx: 0, ny: 1, nz: 0, kind: 'floor' };
  }

  return null;
}

const _wallNormal = new THREE.Vector2();
const _stepPrev = new THREE.Vector3();

function pushExplosionEvent(
  explosions: RocketExplosionEvent[],
  prev: THREE.Vector3,
  pos: THREE.Vector3,
  arenaRadius: number,
  arenaHeight: number,
  withScorch: boolean,
  impact?: THREE.Vector3,
) {
  const hit = impact ?? pos;
  const event: RocketExplosionEvent = {
    x: hit.x,
    y: Math.max(hit.y, 0.5),
    z: hit.z,
  };
  if (withScorch) {
    const scorch = resolveScorchSurface(prev, hit, arenaRadius, arenaHeight);
    if (scorch) {
      event.scorchNx = scorch.nx;
      event.scorchNy = scorch.ny;
      event.scorchNz = scorch.nz;
      event.scorchKind = scorch.kind;
      event.scorchPillarCx = scorch.pillarCx;
      event.scorchPillarCz = scorch.pillarCz;
    }
  }
  explosions.push(event);
}

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

const _bbNormal3 = new THREE.Vector3();

function reflectVelocityOffNormal3D(
  velocity: THREE.Vector3,
  normal: THREE.Vector3,
  rest: number,
): void {
  const vDotN = velocity.dot(normal);
  if (vDotN < 0) {
    velocity.addScaledVector(normal, -2 * vDotN);
    velocity.multiplyScalar(rest);
  }
}

function tryBillboardRocketHit(
  r: ActiveRocket,
  prev: THREE.Vector3,
  pos: THREE.Vector3,
  explosions: RocketExplosionEvent[],
  arenaRadius: number,
  arenaHeight: number,
): boolean {
  const hit = findBillboardSegmentHit(prev, pos);
  if (!hit) return false;

  triggerBillboardShake(hit.mount);
  pos.copy(hit.point);

  if (r.explosive) {
    pushExplosionEvent(
      explosions,
      prev,
      pos,
      arenaRadius,
      arenaHeight,
      true,
      hit.point,
    );
    return true;
  }

  _bbNormal3.copy(hit.normal);
  reflectVelocityOffNormal3D(r.velocity, _bbNormal3, ROCKET.bounceRestitution);
  r.velocity.y = Math.abs(r.velocity.y) * ROCKET.bounceRestitution * 0.5 + 1.2;
  r.bouncesLeft = Math.max(0, r.bouncesLeft - 1);
  return true;
}

function trampolineDeckYAt(x: number, z: number): number | null {
  for (const pad of getBounceTrampolinePads()) {
    if (Math.hypot(x - pad.x, z - pad.z) > pad.radius) continue;
    return pad.platformTopY + ARENA_PADS.bouncePadHeightM;
  }
  return null;
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

  const deckY = trampolineDeckYAt(pos.x, pos.z);
  const onTrampolineDeck = deckY !== null && Math.abs(bestSurf - deckY) < 0.35;

  if (onTrampolineDeck) {
    const tune = tuningStore.getState();
    const launchVy = bounceLaunchSpeedY(tune.gravity, tune.trampolineStrength);
    r.velocity.y = Math.max(Math.abs(r.velocity.y) * rest, launchVy * 0.82);
    triggerOctagonShake(pos.x, pos.z);
  } else {
    tryTriggerOctagonImpactAt(pos.x, pos.z);
    r.velocity.y = Math.abs(r.velocity.y) * rest;
  }

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

  if (tryBallDropRocketBounce(r, prev, pos)) {
    return true;
  }

  if (prev.y >= 0.4 && pos.y < 0.4) {
    pos.y = 0.42;
    r.velocity.y = Math.abs(r.velocity.y) * rest;
    bounced = true;
  }

  if (rocketSegmentHitsCeiling(prev, pos)) {
    pos.y = ARENA.wallHeight - 0.35;
    r.velocity.y = -Math.abs(r.velocity.y) * rest;
    triggerCeilingWallHit();
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

const TRAIL_MIN_LEN = 0.35;

function pushTrailSegment(
  out: RocketTrailSegment[],
  from: THREE.Vector3,
  to: THREE.Vector3,
  explosive: boolean,
) {
  if (from.distanceToSquared(to) < TRAIL_MIN_LEN * TRAIL_MIN_LEN) return;
  out.push({
    from: from.clone(),
    to: to.clone(),
    explosive,
  });
}

export function updateRockets(
  rockets: ActiveRocket[],
  dt: number,
  arenaHalf: { w: number; d: number; h: number },
): {
  rockets: ActiveRocket[];
  explosions: RocketExplosionEvent[];
  trailSegments: RocketTrailSegment[];
} {
  const explosions: RocketExplosionEvent[] = [];
  const trailSegments: RocketTrailSegment[] = [];
  const now = performance.now() / 1000;
  const remaining: ActiveRocket[] = [];

  const arenaRadius = arenaHalf.w;
  refreshFanGlassBoxes();

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
    const minExplodeTravel =
      r.ownerId === 'local'
        ? ROCKET.minTravelBeforeExplosiveDetonate
        : 1.1;

    const glassHit = trySegmentHitsFanGlassWithPoint(_stepPrev, pos);
    if (glassHit) {
      triggerFanGlassHit(glassHit.panel.bayKey, glassHit.point);
      if (r.explosive) {
        pushExplosionEvent(
          explosions,
          _stepPrev,
          pos,
          arenaRadius,
          arenaHalf.h,
          true,
          glassHit.point,
        );
        continue;
      }
      r.bouncesLeft = Math.max(0, r.bouncesLeft - 1);
      pushTrailSegment(trailSegments, _stepPrev, pos, r.explosive);
      remaining.push(r);
      continue;
    }

    if (
      tryBillboardRocketHit(
        r,
        _stepPrev,
        pos,
        explosions,
        arenaRadius,
        arenaHalf.h,
      )
    ) {
      if (!r.explosive) {
        pushTrailSegment(trailSegments, _stepPrev, pos, r.explosive);
        remaining.push(r);
      }
      continue;
    }

    const goalRingContact = findGoalRimSegmentContact(_stepPrev, pos, 0.55);
    if (goalRingContact) {
      if (r.explosive) {
        pushExplosionEvent(
          explosions,
          _stepPrev,
          pos,
          arenaRadius,
          arenaHalf.h,
          true,
        );
        continue;
      }
      const rim = goalRingContact;
      const vDot = r.velocity.x * rim.outwardX;
      if (vDot < 0) {
        r.velocity.x -= 2 * vDot * rim.outwardX * ROCKET.bounceRestitution;
        r.velocity.y = Math.abs(r.velocity.y) * ROCKET.bounceRestitution * 0.45 + 2;
        r.velocity.z *= 0.82;
      }
      r.bouncesLeft = Math.max(0, r.bouncesLeft - 1);
      pushTrailSegment(trailSegments, _stepPrev, pos, r.explosive);
      remaining.push(r);
      continue;
    }

    if (
      r.explosive &&
      traveled >= minExplodeTravel &&
      detectExplosiveSurfaceHit(_stepPrev, pos, arenaRadius)
    ) {
      const pillarHit = findArenaPillarSegmentHit(_stepPrev, pos);
      if (pillarHit) triggerArenaPillarShake(pillarHit.x, pillarHit.z);
      if (rocketSegmentHitsBallDrop(_stepPrev, pos)) {
        triggerBallDropShake(1);
        triggerBallDropSpotlightFrenzy(3000);
      }
      tryTriggerCeilingWallFromRocket(_stepPrev, pos);
      tryTriggerFanGlassFromWallImpact(_stepPrev, pos);
      pushExplosionEvent(
        explosions,
        _stepPrev,
        pos,
        arenaRadius,
        arenaHalf.h,
        true,
      );
      continue;
    }

    if (
      !r.explosive &&
      (trySurfaceBounce(r, _stepPrev, pos, arenaRadius) ||
        tryArenaPillarRocketBounce(r, _stepPrev, pos) ||
        tryBallDropRocketBounce(r, _stepPrev, pos))
    ) {
      tryTriggerFanGlassFromWallImpact(_stepPrev, pos);
      pushTrailSegment(trailSegments, r.segmentStart, pos, r.explosive);
      r.segmentStart.copy(pos);
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
      const pillarHit = findArenaPillarSegmentHit(_stepPrev, pos);
      if (pillarHit) triggerArenaPillarShake(pillarHit.x, pillarHit.z);
      if (stuckCeiling) triggerCeilingWallHit();
      else tryTriggerCeilingWallFromRocket(_stepPrev, pos);
      tryTriggerFanGlassFromWallImpact(_stepPrev, pos);
      pushExplosionEvent(
        explosions,
        _stepPrev,
        pos,
        arenaRadius,
        arenaHalf.h,
        true,
      );
      continue;
    }

    remaining.push(r);
  }

  return { rockets: remaining, explosions, trailSegments };
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
