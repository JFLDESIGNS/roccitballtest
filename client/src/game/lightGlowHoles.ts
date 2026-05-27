import * as THREE from 'three';

/** Max rocket craters per lamp glow (shader loop size). */
export const LIGHT_GLOW_MAX_PUNCHES = 24;

/** Time for a punched hole to fully heal (s). */
export const LIGHT_GLOW_PUNCH_REGEN_S = 2.65;

const HOLE_RADIUS_M = 3.2 * 0.7 * 0.72 * 1.2;
const HOLE_RADIUS_EXPLOSIVE_M = 5.8 * 0.7 * 0.72 * 1.2;

/** Ball craters are 2× rocket punch radius. */
export const LIGHT_GLOW_BALL_RADIUS_MULTIPLIER = 2;

type WorldPunch = {
  x: number;
  y: number;
  z: number;
  radius: number;
  bornAt: number;
};

const punchesByGlow = new Map<string, WorldPunch[]>();
const listeners = new Set<() => void>();
let punchRevision = 0;

const _scratchCenters = Array.from(
  { length: LIGHT_GLOW_MAX_PUNCHES },
  () => new THREE.Vector3(),
);

function notify(): void {
  punchRevision += 1;
  listeners.forEach((fn) => fn());
}

export function lightGlowPunchNowSec(): number {
  return performance.now() * 0.001;
}

/** 1 = full cutout, 0 = fully healed. */
export function lightGlowPunchStrength(ageSec: number): number {
  if (ageSec >= LIGHT_GLOW_PUNCH_REGEN_S) return 0;
  return 1 - ageSec / LIGHT_GLOW_PUNCH_REGEN_S;
}

export function getLightGlowPunchRevision(): number {
  return punchRevision;
}

export function subscribeLightGlowPunches(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getPunchList(glowId: string): WorldPunch[] {
  let list = punchesByGlow.get(glowId);
  if (!list) {
    list = [];
    punchesByGlow.set(glowId, list);
  }
  return list;
}

function pruneExpired(list: WorldPunch[], nowSec: number): void {
  const maxAge = LIGHT_GLOW_PUNCH_REGEN_S;
  for (let i = list.length - 1; i >= 0; i--) {
    if (nowSec - list[i].bornAt >= maxAge) list.splice(i, 1);
  }
}

/** World-space soft crater on the glow volume (shader smoothstep, not UV canvas). */
function lightGlowHoleRadius(
  explosive: boolean,
  radiusMultiplier = 1,
): number {
  const base = explosive ? HOLE_RADIUS_EXPLOSIVE_M : HOLE_RADIUS_M;
  return base * radiusMultiplier;
}

export function punchLightGlowHoleAtWorld(
  glowId: string,
  worldPoint: THREE.Vector3,
  explosive = false,
  radiusMultiplier = 1,
): void {
  const nowSec = lightGlowPunchNowSec();
  const list = getPunchList(glowId);
  list.push({
    x: worldPoint.x,
    y: worldPoint.y,
    z: worldPoint.z,
    radius: lightGlowHoleRadius(explosive, radiusMultiplier),
    bornAt: nowSec,
  });
  while (list.length > LIGHT_GLOW_MAX_PUNCHES) list.shift();
  notify();
}

export type LightGlowPunchUniforms = {
  count: number;
  centers: THREE.Vector3[];
  radii: number[];
  strengths: number[];
};

export function getLightGlowPunchUniforms(
  glowId: string,
  nowSec: number,
): LightGlowPunchUniforms {
  const list = getPunchList(glowId);
  pruneExpired(list, nowSec);

  const active: { p: WorldPunch; strength: number }[] = [];
  for (const p of list) {
    const strength = lightGlowPunchStrength(nowSec - p.bornAt);
    if (strength <= 0.001) continue;
    active.push({ p, strength });
  }

  const count = Math.min(active.length, LIGHT_GLOW_MAX_PUNCHES);
  const start = active.length - count;
  const centers = _scratchCenters;
  const radii: number[] = [];
  const strengths: number[] = [];

  for (let i = 0; i < LIGHT_GLOW_MAX_PUNCHES; i++) {
    if (i < count) {
      const { p, strength } = active[start + i];
      centers[i].set(p.x, p.y, p.z);
      radii.push(p.radius);
      strengths.push(strength);
    } else {
      centers[i].set(0, -9999, 0);
      radii.push(0);
      strengths.push(0);
    }
  }

  return { count, centers, radii, strengths };
}
