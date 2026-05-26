export type RocketTrailSmokePuff = {
  active: boolean;
  x: number;
  y: number;
  z: number;
  life: number;
  maxLife: number;
  size: number;
  /** Per-puff radius multiplier (spawn jitter) */
  sizeMul: number;
};

/** Cap live trail puffs — keeps instanced draw + tick cost bounded */
export const MAX_ROCKET_TRAIL_PUFFS = 320;
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
    size: 0.44,
    sizeMul: 1,
  }),
);
const activeIndices: number[] = [];
let writeIdx = 0;

function removeActiveIndex(idx: number): void {
  const at = activeIndices.indexOf(idx);
  if (at < 0) return;
  const last = activeIndices.length - 1;
  if (at !== last) activeIndices[at] = activeIndices[last]!;
  activeIndices.pop();
}

function claimPuff(): { puff: RocketTrailSmokePuff; idx: number } {
  const idx = writeIdx;
  writeIdx = (writeIdx + 1) % MAX_ROCKET_TRAIL_PUFFS;
  const puff = puffs[idx]!;
  if (puff.active) removeActiveIndex(idx);
  puff.active = true;
  activeIndices.push(idx);
  return { puff, idx };
}

function initPuff(
  p: RocketTrailSmokePuff,
  x: number,
  y: number,
  z: number,
  explosive: boolean,
  posJitter: number,
): void {
  p.x = x + (Math.random() - 0.5) * posJitter;
  p.y = y + (Math.random() - 0.5) * posJitter * 0.4;
  p.z = z + (Math.random() - 0.5) * posJitter;
  p.maxLife = ROCKET_TRAIL_PUFF_LIFE_SEC * (0.88 + Math.random() * 0.24);
  p.life = p.maxLife;
  const base = explosive ? 0.52 : 0.44;
  p.size = base * (0.82 + Math.random() * 0.36);
  p.sizeMul = 0.62 + Math.random() * 0.78;
}

/** One soft puff — used for the simple exhaust trail */
export function spawnRocketTrailSmokePuff(
  x: number,
  y: number,
  z: number,
  explosive: boolean,
): void {
  const { puff } = claimPuff();
  initPuff(puff, x, y, z, explosive, 0.06);
}

/** Denser trail: 1–3 puffs with slight back/lateral scatter */
export function spawnRocketTrailSmokeBurst(
  x: number,
  y: number,
  z: number,
  explosive: boolean,
  vx = 0,
  vy = 0,
  vz = 0,
): void {
  const { puff } = claimPuff();
  initPuff(puff, x, y, z, explosive, 0.07);

  const vlen = Math.hypot(vx, vy, vz);
  const ux = vlen > 0.35 ? vx / vlen : 0;
  const uy = vlen > 0.35 ? vy / vlen : 0;
  const uz = vlen > 0.35 ? vz / vlen : 0;

  if (Math.random() < 0.78) {
    const back = 0.06 + Math.random() * 0.12;
    const { puff: p2 } = claimPuff();
    initPuff(
      p2,
      x - ux * back,
      y - uy * back,
      z - uz * back,
      explosive,
      0.09,
    );
  }

  if (Math.random() < 0.38) {
    const side = 0.05 + Math.random() * 0.08;
    const px = -uz;
    const pz = ux;
    const plen = Math.hypot(px, pz) || 1;
    const sign = Math.random() < 0.5 ? -1 : 1;
    const { puff: p3 } = claimPuff();
    initPuff(
      p3,
      x + (px / plen) * side * sign,
      y + (Math.random() - 0.5) * 0.04,
      z + (pz / plen) * side * sign,
      explosive,
      0.08,
    );
  }
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

export function tickRocketTrailSmokePuffs(dt: number): readonly number[] {
  for (let i = activeIndices.length - 1; i >= 0; i--) {
    const idx = activeIndices[i]!;
    const p = puffs[idx]!;
    p.life -= dt;
    if (p.life <= 0) {
      p.active = false;
      const last = activeIndices.length - 1;
      if (i !== last) activeIndices[i] = activeIndices[last]!;
      activeIndices.pop();
    }
  }
  return activeIndices;
}

export function getRocketTrailSmokePuff(
  idx: number,
): RocketTrailSmokePuff | undefined {
  return puffs[idx];
}
