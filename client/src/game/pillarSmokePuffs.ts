import { ARENA } from '../shared/Constants';
import { ARENA_PILLAR, pillarSurfaceRadiusAtY } from './arenaPillarConfig';

export type PillarSmokeSphere = {
  x: number;
  y: number;
  z: number;
  /** Outward from pillar center (XZ) */
  outX: number;
  outZ: number;
  life: number;
  maxLife: number;
  /** Horizontal radius at full growth (m) */
  maxSize: number;
  phase: number;
};

const spheres: PillarSmokeSphere[] = [];
const MAX_SPHERES = 220;
/** Whole puff cycle runs 2× faster than before */
export const PILLAR_SMOKE_LIFE_SEC = 1.25;
const SURFACE_OUTSET_M = 1.35;
/** Skip puffs on the wall side of the pillar (away from arena center) */
const COURT_FACING_DOT_MIN = 0.06;

function claimSphere(): PillarSmokeSphere {
  if (spheres.length >= MAX_SPHERES) spheres.shift();
  const slot: PillarSmokeSphere = {
    x: 0,
    y: 0,
    z: 0,
    outX: 0,
    outZ: 0,
    life: PILLAR_SMOKE_LIFE_SEC,
    maxLife: PILLAR_SMOKE_LIFE_SEC,
    maxSize: 2.2,
    phase: 0,
  };
  spheres.push(slot);
  return slot;
}

/** +1 when spawn point faces the court (not behind the perimeter wall) */
function facesCourt(
  pillarX: number,
  pillarZ: number,
  outwardX: number,
  outwardZ: number,
): number {
  const len = Math.hypot(pillarX, pillarZ) || 1;
  const toCenterX = -pillarX / len;
  const toCenterZ = -pillarZ / len;
  return outwardX * toCenterX + outwardZ * toCenterZ;
}

function spawnVisibleRingCluster(
  pillarX: number,
  pillarZ: number,
  centerY: number,
  targetCount: number,
) {
  const surfaceR = pillarSurfaceRadiusAtY(centerY);
  let spawned = 0;
  let attempts = 0;
  const maxAttempts = targetCount * 12;

  while (spawned < targetCount && attempts < maxAttempts) {
    attempts++;
    const a = Math.random() * Math.PI * 2;
    const ox = Math.cos(a);
    const oz = Math.sin(a);
    if (facesCourt(pillarX, pillarZ, ox, oz) < COURT_FACING_DOT_MIN) continue;

    const ring =
      surfaceR + SURFACE_OUTSET_M + Math.random() * 0.95;
    const yJitter = (Math.random() - 0.5) * 0.9;
    const growOut = 1.5 + Math.random() * 2.1;

    const s = claimSphere();
    s.x = pillarX + ox * ring;
    s.y = centerY + yJitter;
    s.z = pillarZ + oz * ring;
    s.outX = ox * growOut;
    s.outZ = oz * growOut;
    s.life = PILLAR_SMOKE_LIFE_SEC * (0.94 + Math.random() * 0.06);
    s.maxLife = PILLAR_SMOKE_LIFE_SEC;
    s.maxSize = 1.8 + Math.random() * 2.4;
    s.phase = Math.random() * Math.PI * 2;
    spawned++;
  }
}

/** A few puffs that peel farther off the main ring */
function spawnFarCourtPoofs(
  pillarX: number,
  pillarZ: number,
  centerY: number,
  targetCount: number,
) {
  const surfaceR = pillarSurfaceRadiusAtY(centerY);
  let spawned = 0;
  let attempts = 0;
  const maxAttempts = targetCount * 14;

  while (spawned < targetCount && attempts < maxAttempts) {
    attempts++;
    const a = Math.random() * Math.PI * 2;
    const ox = Math.cos(a);
    const oz = Math.sin(a);
    if (facesCourt(pillarX, pillarZ, ox, oz) < COURT_FACING_DOT_MIN) continue;

    const ring =
      surfaceR + SURFACE_OUTSET_M + 1.15 + Math.random() * 1.85;
    const yJitter = (Math.random() - 0.5) * 1.1;
    const growOut = 3.6 + Math.random() * 3.4;

    const s = claimSphere();
    s.x = pillarX + ox * ring;
    s.y = centerY + yJitter;
    s.z = pillarZ + oz * ring;
    s.outX = ox * growOut;
    s.outZ = oz * growOut;
    s.life = PILLAR_SMOKE_LIFE_SEC * (0.98 + Math.random() * 0.08);
    s.maxLife = s.life;
    s.maxSize = 1.5 + Math.random() * 2.1;
    s.phase = Math.random() * Math.PI * 2;
    spawned++;
  }
}

/** Roof seam — smaller spheres, clumped with empty gaps (like pillar corner smoke) */
const ROOF_SMOKE_CLUSTER_SKIP = 0.38;
const ROOF_SMOKE_SIZE_MIN = 0.48;
const ROOF_SMOKE_SIZE_MAX = 1.22;

function spawnRoofGapPuffs(
  nearInnerZ: number,
  farInnerZ: number,
  centerY: number,
  spanX: number,
  count: number,
) {
  const clusterBudget = Math.max(1, Math.ceil(count / 3.2));
  let spawned = 0;

  for (let c = 0; c < clusterBudget && spawned < count; c++) {
    if (Math.random() < ROOF_SMOKE_CLUSTER_SKIP) continue;

    const alongNear = Math.random() < 0.5;
    const anchorX = (Math.random() - 0.5) * spanX * 0.9;
    const anchorZ = alongNear
      ? nearInnerZ + (Math.random() - 0.5) * 0.55
      : farInnerZ + (Math.random() - 0.5) * 0.55;
    const outZ = alongNear
      ? -0.55 - Math.random() * 1.15
      : 0.55 + Math.random() * 1.15;
    const outX = (Math.random() - 0.5) * 0.45;

    const inCluster = 2 + Math.floor(Math.random() * 3);
    for (let k = 0; k < inCluster && spawned < count; k++) {
      if (Math.random() < 0.22) continue;

      const s = claimSphere();
      s.x = anchorX + (Math.random() - 0.5) * 2.4;
      s.y = centerY + (Math.random() - 0.5) * 0.65;
      s.z = anchorZ + (Math.random() - 0.5) * 0.7;
      s.outX = outX + (Math.random() - 0.5) * 0.35;
      s.outZ = outZ + (Math.random() - 0.5) * 0.35;
      s.life = PILLAR_SMOKE_LIFE_SEC * (0.9 + Math.random() * 0.14);
      s.maxLife = PILLAR_SMOKE_LIFE_SEC;
      s.maxSize =
        ROOF_SMOKE_SIZE_MIN +
        Math.random() * (ROOF_SMOKE_SIZE_MAX - ROOF_SMOKE_SIZE_MIN);
      s.phase = Math.random() * Math.PI * 2;
      spawned++;
    }
  }
}

/** Dust along the midfield seam as roof halves slide apart */
export function burstRoofSeamSmoke(
  nearInnerZ: number,
  farInnerZ: number,
  centerY: number,
  spanX: number,
  puffCount: number,
): void {
  spawnRoofGapPuffs(nearInnerZ, farInnerZ, centerY, spanX, puffCount);
}

/** Opening kick — dense poofs on both inner slab edges */
export function burstRoofOpenSmoke(
  nearInnerZ: number,
  farInnerZ: number,
  centerY: number,
  spanX: number,
): void {
  spawnRoofGapPuffs(nearInnerZ, farInnerZ, centerY, spanX, 52);
  spawnRoofGapPuffs(nearInnerZ, farInnerZ, centerY, spanX, 36);
}

/** Smoke around court-visible side of pillar — top + platform-height base */
export function burstPillarCornerSmoke(pillarX: number, pillarZ: number): void {
  const topY = ARENA_PILLAR.floorY + ARENA_PILLAR.height - 0.65;
  const botY =
    ARENA_PILLAR.floorY + ARENA.platformTopHeight + 0.55;
  spawnVisibleRingCluster(pillarX, pillarZ, topY, 16);
  spawnVisibleRingCluster(pillarX, pillarZ, botY, 16);
  spawnFarCourtPoofs(pillarX, pillarZ, topY, 4);
  spawnFarCourtPoofs(pillarX, pillarZ, botY, 4);
}

export function tickPillarSmokePuffs(dt: number): PillarSmokeSphere[] {
  const step = dt * 2;
  for (let i = spheres.length - 1; i >= 0; i--) {
    const p = spheres[i]!;
    p.life -= step;
    if (p.life <= 0) {
      spheres.splice(i, 1);
      continue;
    }
    const age = 1 - p.life / p.maxLife;
    const drift = (0.85 + age * 1.35) * 2;
    p.x += p.outX * dt * drift;
    p.z += p.outZ * dt * drift;
    p.y += Math.sin(age * Math.PI * 2 + p.phase) * dt * 0.2;
  }
  return spheres;
}
