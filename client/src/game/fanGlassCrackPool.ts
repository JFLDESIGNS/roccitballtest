import * as THREE from 'three';

export const FAN_GLASS_CRACK_POOL_SIZE = 48;
/** Peak opacity when viewing the glass head-on */
export const FAN_GLASS_CRACK_BASE_OPACITY = 0.2;
/** ~1.5× prior average crack size */
export const FAN_GLASS_CRACK_BASE_SIZE_M = 7.65;
export const FAN_GLASS_CRACK_SURFACE_LIFT_M = 0.012;
/** Second decal layer — sits slightly in front of the first */
export const FAN_GLASS_CRACK_LAYER2_LIFT_M = 0.007;
/** Second crack layer with its own rotation */
export const FAN_GLASS_CRACK_DOUBLE_LAYER_CHANCE = 0.9;
export const FAN_GLASS_CRACK_HOLD_SEC = 2;
export const FAN_GLASS_CRACK_FADE_SEC = 1;

/** Ten rotation steps between 10° and 180° */
export const FAN_GLASS_CRACK_ROT_DEG = [
  10, 30, 50, 70, 90, 110, 130, 150, 170, 180,
] as const;

/** Scale steps — 75% … 115% of base */
export const FAN_GLASS_CRACK_SCALE = [0.75, 0.85, 0.95, 1.05, 1.15] as const;

export type FanGlassCrackSlot = {
  active: boolean;
  bornAtMs: number;
  pos: THREE.Vector3;
  normal: THREE.Vector3;
  rotRad: number;
  size: number;
  layerLift: number;
};

let pool: FanGlassCrackSlot[] | null = null;
let writeIdx = 0;

export function getFanGlassCrackPool(): FanGlassCrackSlot[] {
  if (!pool) pool = createFanGlassCrackPool();
  return pool;
}

export function createFanGlassCrackPool(): FanGlassCrackSlot[] {
  return Array.from({ length: FAN_GLASS_CRACK_POOL_SIZE }, () => ({
    active: false,
    bornAtMs: 0,
    pos: new THREE.Vector3(),
    normal: new THREE.Vector3(0, 0, 1),
    rotRad: 0,
    size: FAN_GLASS_CRACK_BASE_SIZE_M,
    layerLift: 0,
  }));
}

export function fanGlassCrackLifeOpacity(
  bornAtMs: number,
  nowMs: number,
): number {
  const ageSec = (nowMs - bornAtMs) / 1000;
  const total = FAN_GLASS_CRACK_HOLD_SEC + FAN_GLASS_CRACK_FADE_SEC;
  if (ageSec >= total) return 0;
  if (ageSec <= FAN_GLASS_CRACK_HOLD_SEC) return 1;
  return 1 - (ageSec - FAN_GLASS_CRACK_HOLD_SEC) / FAN_GLASS_CRACK_FADE_SEC;
}

export function tickFanGlassCrackLifetime(nowMs: number): void {
  const totalMs = (FAN_GLASS_CRACK_HOLD_SEC + FAN_GLASS_CRACK_FADE_SEC) * 1000;
  for (const slot of getFanGlassCrackPool()) {
    if (!slot.active) continue;
    if (nowMs - slot.bornAtMs >= totalMs) slot.active = false;
  }
}

function pickCrackRotationRad(): number {
  const deg =
    FAN_GLASS_CRACK_ROT_DEG[
      Math.floor(Math.random() * FAN_GLASS_CRACK_ROT_DEG.length)
    ]!;
  return (deg * Math.PI) / 180;
}

function pickDistinctRotation(excludeRad: number): number {
  for (let attempt = 0; attempt < 8; attempt++) {
    const rot = pickCrackRotationRad();
    const delta = Math.abs(
      Math.atan2(Math.sin(rot - excludeRad), Math.cos(rot - excludeRad)),
    );
    if (delta > (18 * Math.PI) / 180) return rot;
  }
  return excludeRad + (40 * Math.PI) / 180;
}

function pickCrackScale(): number {
  const s =
    FAN_GLASS_CRACK_SCALE[
      Math.floor(Math.random() * FAN_GLASS_CRACK_SCALE.length)
    ]!;
  return FAN_GLASS_CRACK_BASE_SIZE_M * s;
}

function claimCrackSlot(): FanGlassCrackSlot {
  const slots = getFanGlassCrackPool();
  const slot = slots[writeIdx]!;
  writeIdx = (writeIdx + 1) % slots.length;
  return slot;
}

function activateCrackLayer(
  slot: FanGlassCrackSlot,
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
  layerLift: number,
  rotRad?: number,
  size?: number,
): void {
  slot.active = true;
  slot.bornAtMs = performance.now();
  slot.pos.set(x, y, z);
  slot.normal.set(nx, ny, nz).normalize();
  slot.layerLift = layerLift;
  slot.rotRad = rotRad ?? pickCrackRotationRad();
  slot.size = size ?? pickCrackScale();
}

export function spawnFanGlassCrack(
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
): void {
  const rot1 = pickCrackRotationRad();
  const size1 = pickCrackScale();
  activateCrackLayer(claimCrackSlot(), x, y, z, nx, ny, nz, 0, rot1, size1);

  if (Math.random() < FAN_GLASS_CRACK_DOUBLE_LAYER_CHANCE) {
    activateCrackLayer(
      claimCrackSlot(),
      x,
      y,
      z,
      nx,
      ny,
      nz,
      FAN_GLASS_CRACK_LAYER2_LIFT_M,
      pickDistinctRotation(rot1),
      size1 * (0.86 + Math.random() * 0.16),
    );
  }

}
