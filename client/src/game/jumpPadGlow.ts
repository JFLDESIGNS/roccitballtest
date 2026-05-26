import type { FloorPad } from './arenaPadLayout';

/** Idle deck glow — soft cyan emissive on smooth top */
export const JUMP_PAD_EMISSIVE_IDLE = 0.28;
/** Brief pulse when someone launches off the pad */
export const JUMP_PAD_EMISSIVE_PULSE = 0.62;
const PULSE_MS = 420;

const padKey = (pad: FloorPad) => `${pad.x.toFixed(2)},${pad.z.toFixed(2)}`;
const glowUntilMs = new Map<string, number>();

export function triggerJumpPadGlow(pad: FloorPad): void {
  glowUntilMs.set(padKey(pad), performance.now() + PULSE_MS);
}

export function jumpPadEmissiveIntensity(pad: FloorPad, nowMs = performance.now()): number {
  const until = glowUntilMs.get(padKey(pad));
  if (!until || nowMs >= until) return JUMP_PAD_EMISSIVE_IDLE;
  const t = 1 - (until - nowMs) / PULSE_MS;
  const ease = t * t;
  return JUMP_PAD_EMISSIVE_IDLE + (JUMP_PAD_EMISSIVE_PULSE - JUMP_PAD_EMISSIVE_IDLE) * ease;
}
