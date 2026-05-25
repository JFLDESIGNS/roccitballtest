import * as THREE from 'three';
import { ARENA } from '../shared/Constants';
import { isInsideHex } from './arenaHex';

export const FOG_VOXEL = {
  cellSize: 4,
  hexInset: 12,
  /** Whole volume shifted down (m) */
  yShiftM: -4.5,
  yMin: ARENA.platformTopHeight + 0.8,
  yMax: ARENA.wallHeight - 5,
  /** Seconds puff stays gone after a rocket passes */
  respawnSec: 6,
  fadeOutSec: 0.12,
  fadeInSec: 1.4,
} as const;

export type FogVoxelGrid = {
  cellSize: number;
  nx: number;
  ny: number;
  nz: number;
  originX: number;
  originY: number;
  originZ: number;
  count: number;
  centers: Float32Array;
  life: Float32Array;
  deadUntil: Float32Array;
  /** Linear cell index per (ix,iy,iz) or -1 */
  cellMap: Int32Array;
};

let grid: FogVoxelGrid | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribeFogVoxels(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getFogVoxelGrid(): FogVoxelGrid | null {
  return grid;
}

function cellKey(ix: number, iy: number, iz: number, nx: number, ny: number): number {
  return ix + nx * (iy + ny * iz);
}

export function buildFogVoxelGrid(): FogVoxelGrid {
  const { cellSize, hexInset, yMin, yMax, yShiftM } = FOG_VOXEL;
  const playR = ARENA.hexRadius - hexInset;
  const span = playR * 2;
  const nx = Math.ceil(span / cellSize);
  const ny = Math.ceil((yMax - yMin) / cellSize);
  const nz = nx;
  const originX = -playR + cellSize * 0.5;
  const originY = yMin + yShiftM + cellSize * 0.5;
  const originZ = -playR + cellSize * 0.5;

  const centers: number[] = [];
  const cellMap = new Int32Array(nx * ny * nz);
  cellMap.fill(-1);

  for (let iz = 0; iz < nz; iz++) {
    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        const x = originX + ix * cellSize;
        const y = originY + iy * cellSize;
        const z = originZ + iz * cellSize;
        if (!isInsideHex(x, z, playR)) continue;
        if (y > yMax) continue;
        const idx = centers.length / 3;
        const linear = cellKey(ix, iy, iz, nx, ny);
        cellMap[linear] = idx;
        centers.push(x, y, z);
      }
    }
  }

  const count = centers.length / 3;
  const life = new Float32Array(count);
  const deadUntil = new Float32Array(count);
  life.fill(1);

  grid = {
    cellSize,
    nx,
    ny,
    nz,
    originX,
    originY,
    originZ,
    count,
    centers: new Float32Array(centers),
    life,
    deadUntil,
    cellMap,
  };
  notify();
  return grid;
}

/** Rocket segment intersects the voxel's axis-aligned cell box (center ± half) */
function segmentIntersectsCellBox(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  half: number,
): boolean {
  const minX = cx - half;
  const maxX = cx + half;
  const minY = cy - half;
  const maxY = cy + half;
  const minZ = cz - half;
  const maxZ = cz + half;

  const inBox = (x: number, y: number, z: number) =>
    x >= minX &&
    x <= maxX &&
    y >= minY &&
    y <= maxY &&
    z >= minZ &&
    z <= maxZ;

  if (inBox(ax, ay, az) || inBox(bx, by, bz)) return true;

  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;

  const axes: { min: number; max: number; p: number; d: number }[] = [
    { min: minX, max: maxX, p: ax, d: dx },
    { min: minY, max: maxY, p: ay, d: dy },
    { min: minZ, max: maxZ, p: az, d: dz },
  ];

  let t0 = 0;
  let t1 = 1;
  for (const { min, max, p, d } of axes) {
    if (Math.abs(d) < 1e-10) {
      if (p < min || p > max) return false;
      continue;
    }
    const inv = 1 / d;
    let tNear = (min - p) * inv;
    let tFar = (max - p) * inv;
    if (tNear > tFar) {
      const tmp = tNear;
      tNear = tFar;
      tFar = tmp;
    }
    t0 = Math.max(t0, tNear);
    t1 = Math.min(t1, tFar);
    if (t0 > t1) return false;
  }
  return true;
}

function killVoxel(g: FogVoxelGrid, vi: number, now: number) {
  g.life[vi] = 0;
  g.deadUntil[vi] = now + FOG_VOXEL.respawnSec;
}

/** Clear every voxel whose cell box is touched by the rocket segment */
function carveSegmentVolume(
  g: FogVoxelGrid,
  from: THREE.Vector3,
  to: THREE.Vector3,
  now: number,
) {
  const half = g.cellSize * 0.5;
  const ax = from.x;
  const ay = from.y;
  const az = from.z;
  const bx = to.x;
  const by = to.y;
  const bz = to.z;

  const pad = half;
  const minX = Math.min(ax, bx) - pad;
  const maxX = Math.max(ax, bx) + pad;
  const minY = Math.min(ay, by) - pad;
  const maxY = Math.max(ay, by) + pad;
  const minZ = Math.min(az, bz) - pad;
  const maxZ = Math.max(az, bz) + pad;

  const ix0 = Math.max(0, Math.floor((minX - g.originX) / g.cellSize));
  const ix1 = Math.min(g.nx - 1, Math.floor((maxX - g.originX) / g.cellSize));
  const iy0 = Math.max(0, Math.floor((minY - g.originY) / g.cellSize));
  const iy1 = Math.min(g.ny - 1, Math.floor((maxY - g.originY) / g.cellSize));
  const iz0 = Math.max(0, Math.floor((minZ - g.originZ) / g.cellSize));
  const iz1 = Math.min(g.nz - 1, Math.floor((maxZ - g.originZ) / g.cellSize));

  let hit = false;
  for (let iz = iz0; iz <= iz1; iz++) {
    for (let iy = iy0; iy <= iy1; iy++) {
      for (let ix = ix0; ix <= ix1; ix++) {
        const vi = g.cellMap[cellKey(ix, iy, iz, g.nx, g.ny)];
        if (vi < 0) continue;
        const cx = g.centers[vi * 3];
        const cy = g.centers[vi * 3 + 1];
        const cz = g.centers[vi * 3 + 2];
        if (
          segmentIntersectsCellBox(ax, ay, az, bx, by, bz, cx, cy, cz, half)
        ) {
          killVoxel(g, vi, now);
          hit = true;
        }
      }
    }
  }
  return hit;
}

/** Rockets pass through; punches holes that stay empty for respawnSec */
export function carveFogAlongRocketSegment(
  from: THREE.Vector3,
  to: THREE.Vector3,
): void {
  const g = grid;
  if (!g || g.count === 0) return;
  const now = performance.now() / 1000;
  if (carveSegmentVolume(g, from, to, now)) notify();
}

export function stepFogVoxelFade(dt: number): boolean {
  const g = grid;
  if (!g || g.count === 0) return false;
  const now = performance.now() / 1000;
  let changed = false;
  const fadeInSpeed = dt / Math.max(0.001, FOG_VOXEL.fadeInSec);

  for (let i = 0; i < g.count; i++) {
    if (g.deadUntil[i] > now) {
      if (g.life[i] !== 0) {
        g.life[i] = 0;
        changed = true;
      }
      continue;
    }

    if (g.deadUntil[i] > 0 && now >= g.deadUntil[i]) {
      g.deadUntil[i] = 0;
      changed = true;
    }

    if (g.life[i] < 1) {
      const next = Math.min(1, g.life[i] + fadeInSpeed);
      if (next !== g.life[i]) {
        g.life[i] = next;
        changed = true;
      }
    }
  }
  if (changed) notify();
  return changed;
}
