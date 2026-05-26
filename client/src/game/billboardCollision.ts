import * as THREE from 'three';
import { ARENA_PADS } from '../shared/Constants';

const BILLBOARD_FRAME_DEPTH = 0.14;
/** Trim ring around screen in ArenaInteractables */
const BILLBOARD_TRIM_PAD = 0.52;
/** Gameplay query beyond framed mesh — empty space around billboards */
export const BILLBOARD_HIT_PAD_XY = 2.75;
export const BILLBOARD_HIT_PAD_Z = 2.5;
/** @deprecated use BILLBOARD_HIT_PAD_XY */
export const BILLBOARD_ROCKET_PAD = BILLBOARD_HIT_PAD_XY;

export function billboardHitHalfExtents() {
  const w = ARENA_PADS.billboardWidthM;
  const h = ARENA_PADS.billboardHeightM;
  return {
    hx: (w + BILLBOARD_TRIM_PAD) * 0.5 + BILLBOARD_HIT_PAD_XY,
    hy: (h + BILLBOARD_TRIM_PAD) * 0.5 + BILLBOARD_HIT_PAD_XY,
    lzMin: -BILLBOARD_FRAME_DEPTH - BILLBOARD_HIT_PAD_Z * 0.45,
    lzMax: BILLBOARD_FRAME_DEPTH + 0.55 + BILLBOARD_HIT_PAD_Z,
  };
}

/** Matches ArenaInteractables / debug wire box (Y rotation at mount.yaw). */
export function worldDeltaToBillboardLocal(
  dx: number,
  dy: number,
  dz: number,
  yaw: number,
  out: { lx: number; ly: number; lz: number },
): void {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  out.lx = dx * c + dz * s;
  out.ly = dy;
  out.lz = -dx * s + dz * c;
}

export function billboardLocalToWorldDelta(
  lx: number,
  ly: number,
  lz: number,
  yaw: number,
  out: THREE.Vector3,
): void {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  out.set(lx * c - lz * s, ly, lx * s + lz * c);
}

/** Unit normal from screen face toward the court (+Z local). */
export function billboardFaceNormalWorld(
  yaw: number,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  billboardLocalToWorldDelta(0, 0, 1, yaw, out);
  return out.normalize();
}

export function segmentHitsLocalAabb(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  hx: number,
  hy: number,
  lzMin: number,
  lzMax: number,
): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;

  const slab = (
    min: number,
    max: number,
    start: number,
    dir: number,
  ): boolean => {
    if (Math.abs(dir) < 1e-8) {
      return start >= min && start <= max;
    }
    const inv = 1 / dir;
    let tNear = (min - start) * inv;
    let tFar = (max - start) * inv;
    if (tNear > tFar) {
      const tmp = tNear;
      tNear = tFar;
      tFar = tmp;
    }
    t0 = Math.max(t0, tNear);
    t1 = Math.min(t1, tFar);
    return t0 <= t1;
  };

  if (!slab(-hx, hx, ax, dx)) return false;
  if (!slab(-hy, hy, ay, dy)) return false;
  if (!slab(lzMin, lzMax, az, dz)) return false;
  return t0 <= t1 && t1 >= 0 && t0 <= 1;
}
