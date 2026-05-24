import type { RapierRigidBody } from '@react-three/rapier';
import type { Collider, World } from '@dimforge/rapier3d-compat';
import { Ray } from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { ARENA, BALL, BEAM, MOVEMENT } from '../shared/Constants';
import { getMaxPlatformSurfaceY } from './arenaSpawn';

const _rayOrig = { x: 0, y: 0, z: 0 };
const _rayDir = { x: 0, y: 0, z: 0 };

let smoothedSupportY = ARENA.floorY + BALL.radius;
let supportSmoothReady = false;

export function resetHeldBallSupportSmooth(): void {
  supportSmoothReady = false;
}

function holdRayExclude(
  ball: RapierRigidBody,
  holderBody?: RapierRigidBody | null,
): (collider: Collider) => boolean {
  const skip = new Set<number>([ball.handle]);
  if (holderBody) skip.add(holderBody.handle);
  return (collider) => {
    const parent = collider.parent();
    if (!parent) return true;
    return !skip.has(parent.handle);
  };
}

function castHoldRay(
  world: World,
  ball: RapierRigidBody,
  holderBody: RapierRigidBody | null | undefined,
  maxToi: number,
): ReturnType<World['castRay']> {
  return world.castRay(
    new Ray(_rayOrig, _rayDir),
    maxToi,
    true,
    undefined,
    undefined,
    undefined,
    ball,
    holdRayExclude(ball, holderBody),
  );
}

function smoothSupportY(targetMinY: number, dt: number): number {
  if (!supportSmoothReady) {
    smoothedSupportY = targetMinY;
    supportSmoothReady = true;
    return targetMinY;
  }
  const alpha = 1 - Math.exp(-BALL.holdSupportSmooth * Math.max(dt, 1 / 120));
  smoothedSupportY = THREE.MathUtils.lerp(smoothedSupportY, targetMinY, alpha);
  return smoothedSupportY;
}

/** Lowest valid center Y for a held ball at (x, z) — floor, ramps, and platforms. */
function ballSupportCenterY(
  world: World,
  x: number,
  z: number,
  probeTopY: number,
  ball: RapierRigidBody,
  holderBody: RapierRigidBody | null | undefined,
  radius: number,
): number {
  const platformY = getMaxPlatformSurfaceY(x, z);
  let supportSurface: number = ARENA.floorY;

  if (platformY !== null) {
    supportSurface = Math.max(supportSurface, platformY);
  }

  _rayOrig.x = x;
  _rayOrig.y = probeTopY + 14;
  _rayOrig.z = z;
  _rayDir.x = 0;
  _rayDir.y = -1;
  _rayDir.z = 0;

  const hit = castHoldRay(world, ball, holderBody, probeTopY + 20);
  if (hit) {
    const surfaceY = _rayOrig.y - hit.timeOfImpact;
    supportSurface = Math.max(supportSurface, surfaceY);
  }

  return supportSurface + radius + 0.06;
}

/** Keep held ball outside the holder capsule so it is not buried in the mesh. */
export function nudgeHeldBallClearOfHolder(
  out: THREE.Vector3,
  _holderBody: RapierRigidBody,
  holdSocket: THREE.Vector3,
  radius: number = BALL.radius,
  chest?: THREE.Vector3 | null,
): void {
  const anchor = chest ?? holdSocket;
  const minDist = radius + MOVEMENT.capsuleRadius * 0.88 + 0.38;
  const dx = out.x - anchor.x;
  const dy = out.y - anchor.y;
  const dz = out.z - anchor.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist >= minDist) return;

  out.lerp(holdSocket, 0.78);
  const dx2 = out.x - anchor.x;
  const dy2 = out.y - anchor.y;
  const dz2 = out.z - anchor.z;
  const d2 = Math.hypot(dx2, dy2, dz2);
  if (d2 < minDist) {
    if (d2 > 1e-5) {
      const s = minDist / d2;
      out.set(anchor.x + dx2 * s, anchor.y + dy2 * s, anchor.z + dz2 * s);
    } else {
      out.copy(holdSocket);
    }
  }
}

function heldSupportMinY(
  world: World,
  x: number,
  z: number,
  probeTopY: number,
  ball: RapierRigidBody,
  holderBody: RapierRigidBody | null | undefined,
  radius: number,
  chest?: THREE.Vector3 | null,
  dt = 1 / 60,
): number {
  const floorY = ballSupportCenterY(
    world,
    x,
    z,
    probeTopY,
    ball,
    holderBody,
    radius,
  );
  let minY = smoothSupportY(floorY, dt);
  if (!holderBody || !chest) return minY;
  const t = holderBody.translation();
  const nearHolder =
    Math.hypot(x - t.x, z - t.z) < MOVEMENT.capsuleRadius + BALL.radius + 1.8;
  if (!nearHolder) return minY;
  return Math.max(minY, chest.y + BEAM.holdMinSocketYBelowChest - radius * 0.35);
}

function applyHeldSupportAt(
  world: World,
  body: RapierRigidBody,
  out: THREE.Vector3,
  radius: number,
  holderBody: RapierRigidBody | null | undefined,
  chest: THREE.Vector3 | null | undefined,
  curY: number,
  dt: number,
): void {
  const minY = heldSupportMinY(
    world,
    out.x,
    out.z,
    Math.max(out.y, curY),
    body,
    holderBody,
    radius,
    chest,
    dt,
  );
  if (out.y < minY) out.y = minY;
}

/**
 * Clamp kinematic hold target so the ball stays on top of arena geometry
 * and does not sweep through walls/floors along the move segment.
 */
export function resolveHeldBallPosition(
  world: World,
  body: RapierRigidBody,
  desired: THREE.Vector3,
  out: THREE.Vector3,
  radius: number = BALL.radius,
  holderBody?: RapierRigidBody | null,
  holdSocket?: THREE.Vector3 | null,
  chest?: THREE.Vector3 | null,
  dt = 1 / 60,
): void {
  const cur = body.translation();
  out.copy(desired);

  applyHeldSupportAt(world, body, out, radius, holderBody, chest, cur.y, dt);

  if (holderBody && chest && holdSocket) {
    const ht = holderBody.translation();
    const nearHolder =
      Math.hypot(out.x - ht.x, out.z - ht.z) <
      MOVEMENT.capsuleRadius + radius + 2.4;
    if (nearHolder) {
      nudgeHeldBallClearOfHolder(out, holderBody, holdSocket, radius, chest);
      const minYNear = chest.y + BEAM.holdMinSocketYBelowChest - radius * 0.2;
      if (out.y < minYNear) out.y = minYNear;
    }
  }

  const dx = out.x - cur.x;
  const dy = out.y - cur.y;
  const dz = out.z - cur.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 0.04) {
    if (holderBody && holdSocket) {
      nudgeHeldBallClearOfHolder(out, holderBody, holdSocket, radius, chest);
    }
    applyHeldSupportAt(world, body, out, radius, holderBody, chest, cur.y, dt);
    return;
  }

  const inv = 1 / dist;
  _rayDir.x = dx * inv;
  _rayDir.y = dy * inv;
  _rayDir.z = dz * inv;
  _rayOrig.x = cur.x;
  _rayOrig.y = cur.y;
  _rayOrig.z = cur.z;

  const hit = castHoldRay(
    world,
    body,
    holderBody,
    Math.max(dist - radius * 0.82, 0.02),
  );

  if (hit) {
    const safe = Math.max(hit.timeOfImpact - radius * 0.92, 0);
    out.x = cur.x + _rayDir.x * safe;
    out.y = cur.y + _rayDir.y * safe;
    out.z = cur.z + _rayDir.z * safe;
  }

  applyHeldSupportAt(world, body, out, radius, holderBody, chest, cur.y, dt);

  if (holderBody && holdSocket) {
    nudgeHeldBallClearOfHolder(out, holderBody, holdSocket, radius, chest);
    applyHeldSupportAt(world, body, out, radius, holderBody, chest, cur.y, dt);
  }
}
