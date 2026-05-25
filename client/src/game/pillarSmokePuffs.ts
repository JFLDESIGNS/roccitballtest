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
const MAX_SPHERES = 160;
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
