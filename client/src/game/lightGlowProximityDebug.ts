/** Live readout for proximity fade testing (Brightness menu). */

export type LightGlowProximityDebugSample = {
  /** Effective horizontal distance to nearest glow edge (feet). */
  distFt: number;
  /** 0 = fully faded, 1 = full glow opacity. */
  opacityFactor: number;
  /** Final shader opacity after proximity. */
  appliedOpacity: number;
  listenerUsesPlayer: boolean;
};

const empty: LightGlowProximityDebugSample = {
  distFt: 999,
  opacityFactor: 1,
  appliedOpacity: 0,
  listenerUsesPlayer: false,
};

let captureFrame = -1;
let sample = empty;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function reportLightGlowProximity(
  frame: number,
  distFt: number,
  opacityFactor: number,
  appliedOpacity: number,
  listenerUsesPlayer: boolean,
): void {
  if (frame !== captureFrame) {
    captureFrame = frame;
    sample = { ...empty, distFt: 999 };
  }
  if (distFt < sample.distFt) {
    sample = { distFt, opacityFactor, appliedOpacity, listenerUsesPlayer };
    notify();
  }
}

export function getLightGlowProximityDebug(): LightGlowProximityDebugSample {
  return sample;
}

export function subscribeLightGlowProximityDebug(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
