export type RocketTrailSmokePuff = {
  active: boolean;
  x: number;
  y: number;
  z: number;
  life: number;
  maxLife: number;
  size: number;
};

/** Cap live trail puffs — keeps instanced draw + tick cost bounded */
export const MAX_ROCKET_TRAIL_PUFFS = 48;
export const ROCKET_TRAIL_PUFF_LIFE_SEC = 0.95;

const puffs: RocketTrailSmokePuff[] = Array.from(
  { length: MAX_ROCKET_TRAIL_PUFFS },
  () => ({
    active: false,
    x: 0,
    y: 0,
    z: 0,
    life: 0,
    maxLife: ROCKET_TRAIL_PUFF_LIFE_SEC,
    size: 0.3,
  }),
);
let writeIdx = 0;

function claimPuff(): RocketTrailSmokePuff {
  const p = puffs[writeIdx]!;
  writeIdx = (writeIdx + 1) % MAX_ROCKET_TRAIL_PUFFS;
  return p;
}

/** One or two soft puffs per trail segment — low spawn rate */
export function spawnRocketTrailSmokeAlongSegment(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  explosive: boolean,
): void {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 0.06) return;

  const baseSize =
    ((explosive ? 0.28 : 0.24) + Math.min(dist * 0.04, 0.12)) * 0.65;
  const midX = (ax + bx) * 0.5;
  const midY = (ay + by) * 0.5;
  const midZ = (az + bz) * 0.5;
  const jitter = 0.03;

  const p0 = claimPuff();
  p0.active = true;
  p0.x = midX + (Math.random() - 0.5) * jitter;
  p0.y = midY + (Math.random() - 0.5) * jitter * 0.5;
  p0.z = midZ + (Math.random() - 0.5) * jitter;
  p0.maxLife = ROCKET_TRAIL_PUFF_LIFE_SEC * (0.9 + Math.random() * 0.1);
  p0.life = p0.maxLife;
  p0.size = baseSize;

  if (dist > 0.35) {
    const p1 = claimPuff();
    p1.active = true;
    p1.x = bx + (Math.random() - 0.5) * jitter;
    p1.y = by + (Math.random() - 0.5) * jitter * 0.5;
    p1.z = bz + (Math.random() - 0.5) * jitter;
    p1.maxLife = p0.maxLife;
    p1.life = p1.maxLife;
    p1.size = baseSize * 0.88;
  }
}

export function tickRocketTrailSmokePuffs(
  dt: number,
): readonly RocketTrailSmokePuff[] {
  for (const p of puffs) {
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) p.active = false;
  }
  return puffs;
}
