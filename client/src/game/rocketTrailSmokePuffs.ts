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
export const MAX_ROCKET_TRAIL_PUFFS = 160;
export const ROCKET_TRAIL_PUFF_LIFE_SEC = 1.65;

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

function spawnOnePuff(
  x: number,
  y: number,
  z: number,
  baseSize: number,
  explosive: boolean,
): void {
  const jitter = 0.12;
  const p = claimPuff();
  p.active = true;
  p.x = x + (Math.random() - 0.5) * jitter;
  p.y = y + (Math.random() - 0.5) * jitter * 0.45;
  p.z = z + (Math.random() - 0.5) * jitter;
  p.maxLife = ROCKET_TRAIL_PUFF_LIFE_SEC * (0.85 + Math.random() * 0.3);
  p.life = p.maxLife;
  p.size = baseSize * (0.88 + Math.random() * 0.28);
  if (explosive) p.size *= 1.08;
}

/** Soft grey smoke puffs along a trail segment */
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
  if (dist < 0.04) return;

  const baseSize =
    (explosive ? 0.48 : 0.42) + Math.min(dist * 0.06, 0.14);
  const steps = Math.max(1, Math.ceil(dist / 0.16));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    spawnOnePuff(
      ax + dx * t,
      ay + dy * t,
      az + dz * t,
      baseSize,
      explosive,
    );
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
