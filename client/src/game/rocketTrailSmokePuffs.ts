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
export const MAX_ROCKET_TRAIL_PUFFS = 168;
export const ROCKET_TRAIL_PUFF_LIFE_SEC = 1.35;

const puffs: RocketTrailSmokePuff[] = Array.from(
  { length: MAX_ROCKET_TRAIL_PUFFS },
  () => ({
    active: false,
    x: 0,
    y: 0,
    z: 0,
    life: 0,
    maxLife: ROCKET_TRAIL_PUFF_LIFE_SEC,
    size: 0.29,
  }),
);
let writeIdx = 0;

function claimPuff(): RocketTrailSmokePuff {
  const p = puffs[writeIdx]!;
  writeIdx = (writeIdx + 1) % MAX_ROCKET_TRAIL_PUFFS;
  return p;
}

/** One soft puff — used for the simple exhaust trail */
export function spawnRocketTrailSmokePuff(
  x: number,
  y: number,
  z: number,
  explosive: boolean,
): void {
  const jitter = 0.06;
  const p = claimPuff();
  p.active = true;
  p.x = x + (Math.random() - 0.5) * jitter;
  p.y = y + (Math.random() - 0.5) * jitter * 0.4;
  p.z = z + (Math.random() - 0.5) * jitter;
  p.maxLife = ROCKET_TRAIL_PUFF_LIFE_SEC * (0.9 + Math.random() * 0.2);
  p.life = p.maxLife;
  p.size = (explosive ? 0.34 : 0.29) * (0.9 + Math.random() * 0.15);
}

/** Legacy segment fill — avoid for flight trail (creates solid white slab) */
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
  if (dist < 0.08) return;
  spawnRocketTrailSmokePuff(bx, by, bz, explosive);
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
