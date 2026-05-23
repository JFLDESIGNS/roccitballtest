import type { RigidBody, World } from '@dimforge/rapier3d-compat';
import { Ray } from '@dimforge/rapier3d-compat';
import { ARENA, MOVEMENT } from '../shared/Constants';
import { sampleTrampolineFloorY } from './arenaPadLayout';

const capHalfH = MOVEMENT.capsuleHeight / 2 - MOVEMENT.capsuleRadius;
const capCenterY = capHalfH + MOVEMENT.capsuleRadius;
const feetOffsetY = capCenterY - capHalfH - MOVEMENT.capsuleRadius;

const _rayOrigin = { x: 0, y: 0, z: 0 };
const _rayDir = { x: 0, y: -1, z: 0 };
const _rayOffsets: { x: number; z: number }[] = [
  { x: 0, z: 0 },
  { x: 0.28, z: 0 },
  { x: -0.28, z: 0 },
  { x: 0, z: 0.28 },
  { x: 0, z: -0.28 },
];

/** World Y of capsule feet from rigid-body origin translation */
export function playerFeetY(bodyY: number): number {
  return bodyY + feetOffsetY;
}

export type PlayerGroundProbe = {
  grounded: boolean;
  groundY: number;
  /** Smallest gap from feet to ground among probe rays */
  groundGap: number;
};

function castDown(
  world: World,
  x: number,
  feetY: number,
  z: number,
  maxDist: number,
  excludeBody: RigidBody | null,
): { hit: boolean; gap: number; groundY: number } {
  _rayOrigin.x = x;
  _rayOrigin.y = feetY + 0.1;
  _rayOrigin.z = z;

  const hit = world.castRay(
    new Ray(_rayOrigin, _rayDir),
    maxDist + 0.35,
    true,
    undefined,
    undefined,
    undefined,
    excludeBody ?? undefined,
  );

  if (!hit) {
    return { hit: false, gap: maxDist + 1, groundY: ARENA.floorY };
  }

  const gap = hit.timeOfImpact - 0.1;
  const groundY = _rayOrigin.y - hit.timeOfImpact;
  return { hit: true, gap, groundY };
}

/**
 * Multi-ray feet probe — stable on ramps and platform lips.
 */
export function probePlayerGround(
  world: World,
  bodyX: number,
  bodyY: number,
  bodyZ: number,
  linvelY: number,
  excludeBody: RigidBody | null,
  maxProbe = MOVEMENT.groundProbeDist,
  maxVerticalSpeed: number = MOVEMENT.groundMaxVerticalSpeed,
): PlayerGroundProbe {
  const feetY = playerFeetY(bodyY);
  let bestGap = maxProbe + 1;
  let bestGroundY: number = ARENA.floorY;

  for (const off of _rayOffsets) {
    const sample = castDown(
      world,
      bodyX + off.x,
      feetY,
      bodyZ + off.z,
      maxProbe,
      excludeBody,
    );
    if (sample.hit && sample.gap < bestGap) {
      bestGap = sample.gap;
      bestGroundY = sample.groundY;
    }
  }

  const padFloorY = sampleTrampolineFloorY(bodyX, bodyZ);
  if (padFloorY !== null) {
    const padGap = feetY - padFloorY;
    if (padGap >= -0.08 && padGap < bestGap) {
      bestGap = padGap;
      bestGroundY = padFloorY;
    }
  }

  const grounded =
    bestGap <= maxProbe && Math.abs(linvelY) <= maxVerticalSpeed;

  return { grounded, groundY: bestGroundY, groundGap: bestGap };
}

/**
 * Small ledge climb for platform ramp lips (after physics step).
 */
export function applyPlayerStepUp(
  world: World,
  body: RigidBody,
  moveDirX: number,
  moveDirZ: number,
  excludeBody: RigidBody | null,
): void {
  const len = Math.hypot(moveDirX, moveDirZ);
  if (len < 0.12) return;

  const t = body.translation();
  const feetY = playerFeetY(t.y);
  const stepH = MOVEMENT.stepHeight;
  const ahead = MOVEMENT.stepProbeAhead;
  const nx = moveDirX / len;
  const nz = moveDirZ / len;

  const low = castDown(world, t.x, feetY, t.z, stepH + 0.15, excludeBody);
  if (low.gap <= 0.12) return;

  const ax = t.x + nx * ahead;
  const az = t.z + nz * ahead;
  const highFeetY = feetY + stepH;
  const high = castDown(world, ax, highFeetY, az, stepH + 0.2, excludeBody);

  if (!high.hit || high.gap > 0.2) return;
  if (high.groundY < feetY + 0.04) return;

  const lift = Math.min(stepH, high.groundY - feetY + 0.06);
  body.setTranslation({ x: t.x, y: t.y + lift, z: t.z }, true);
  const lv = body.linvel();
  if (lv.y < 0.5) {
    body.setLinvel({ x: lv.x, y: Math.max(lv.y, 0), z: lv.z }, true);
  }
}
