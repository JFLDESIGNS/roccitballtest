import * as THREE from 'three';
import { BALL } from '../shared/Constants';

export const HEAT_WAVE_POOL_SIZE = 8;
/** Layer for lens spheres — excluded from background capture pass */
export const HEAT_WAVE_LAYER = 1;
/** Longer heat pulse */
export const HEAT_WAVE_DURATION_SEC = 1.9;
export const HEAT_WAVE_DEBUG_WIREFRAME = false;
/** Starts as a large blast bubble */
export const HEAT_WAVE_START_RADIUS = BALL.radius * 2.8;
/** Expands to a very wide distortion field */
export const HEAT_WAVE_END_RADIUS = BALL.radius * 9.5;

export type HeatWaveSlot = {
  active: boolean;
  pos: THREE.Vector3;
  born: number;
};

export function createHeatWavePool(): HeatWaveSlot[] {
  return Array.from({ length: HEAT_WAVE_POOL_SIZE }, () => ({
    active: false,
    pos: new THREE.Vector3(),
    born: 0,
  }));
}

export function spawnHeatWave(
  pool: HeatWaveSlot[],
  x: number,
  y: number,
  z: number,
): void {
  let slot = pool.find((s) => !s.active);
  if (!slot) {
    let oldest = pool[0]!;
    for (const s of pool) {
      if (s.born < oldest.born) oldest = s;
    }
    slot = oldest;
  }
  slot.active = true;
  slot.pos.set(x, y, z);
  slot.born = performance.now() / 1000;
}

export function tickHeatWavePool(pool: HeatWaveSlot[], nowSec: number): void {
  for (const slot of pool) {
    if (slot.active && nowSec - slot.born >= HEAT_WAVE_DURATION_SEC) {
      slot.active = false;
    }
  }
}

export function heatWaveProgress(elapsedSec: number): {
  t: number;
  scale: number;
  fade: number;
  wobble: number;
} {
  const t = THREE.MathUtils.clamp(elapsedSec / HEAT_WAVE_DURATION_SEC, 0, 1);
  const expand = 1 - (1 - t) ** 1.75;
  const scale = THREE.MathUtils.lerp(HEAT_WAVE_START_RADIUS, HEAT_WAVE_END_RADIUS, expand);
  const fade = (1 - t) ** 1.2;
  const wobble = 1 + Math.sin(t * Math.PI * 4.2) * 0.035 * fade;
  return { t, scale, fade, wobble };
}
