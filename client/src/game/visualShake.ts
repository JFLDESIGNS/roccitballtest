import { burstPillarCornerSmoke } from './pillarSmokePuffs';

const SHAKE_MS = 500;
const MAX_TILT_DEG = 1.35;
const PILLAR_SHAKE_MS = 680;
const PILLAR_MAX_TILT_DEG = 1.45;

type ShakeEntry = { until: number; intensity: number };

const shakes = new Map<string, ShakeEntry>();

export function triggerVisualShake(
  key: string,
  intensity = 1,
  durationMs = SHAKE_MS,
): void {
  shakes.set(key, {
    until: performance.now() + durationMs,
    intensity,
  });
}

export function getVisualShake(
  key: string,
  seed = 0,
): { tiltX: number; tiltY: number; tiltZ: number } {
  const entry = shakes.get(key);
  if (!entry) return { tiltX: 0, tiltY: 0, tiltZ: 0 };

  const now = performance.now();
  const remaining = entry.until - now;
  if (remaining <= 0) {
    shakes.delete(key);
    return { tiltX: 0, tiltY: 0, tiltZ: 0 };
  }

  const u = 1 - remaining / SHAKE_MS;
  const envelope = Math.sin(u * Math.PI);
  const wobble = Math.sin(u * Math.PI * 2.6 + seed * 0.17);
  const wobble2 = Math.cos(u * Math.PI * 2.1 + seed * 0.23);
  const wobbleY = Math.sin(u * Math.PI * 1.85 + seed * 0.31);
  const maxRad = ((MAX_TILT_DEG * entry.intensity) * Math.PI) / 180;

  return {
    tiltX: wobble * envelope * maxRad,
    tiltZ: wobble2 * envelope * maxRad * 0.85,
    tiltY: wobbleY * envelope * maxRad * 0.55,
  };
}

export function pillarShakeKey(x: number, z: number): string {
  return `pillar:${x.toFixed(2)},${z.toFixed(2)}`;
}

export function octagonShakeKey(x: number, z: number): string {
  return `oct:${x.toFixed(2)},${z.toFixed(2)}`;
}

export function billboardShakeKey(x: number, y: number, z: number): string {
  return `bb:${x.toFixed(1)},${y.toFixed(1)},${z.toFixed(1)}`;
}

export function triggerArenaPillarShake(x: number, z: number): void {
  triggerVisualShake(pillarShakeKey(x, z), 1, PILLAR_SHAKE_MS);
  burstPillarCornerSmoke(x, z);
}

export function getArenaPillarShake(x: number, z: number): {
  tiltX: number;
  tiltZ: number;
} {
  const key = pillarShakeKey(x, z);
  const entry = shakes.get(key);
  if (!entry) return { tiltX: 0, tiltZ: 0 };

  const now = performance.now();
  const remaining = entry.until - now;
  if (remaining <= 0) {
    shakes.delete(key);
    return { tiltX: 0, tiltZ: 0 };
  }

  const seed = x + z;
  const u = 1 - remaining / PILLAR_SHAKE_MS;
  const envelope = Math.sin(u * Math.PI);
  const wobble =
    Math.sin(u * Math.PI * 3.5 + seed * 0.17) +
    Math.sin(u * Math.PI * 5.8 + seed * 0.41) * 0.22;
  const wobble2 =
    Math.cos(u * Math.PI * 2.85 + seed * 0.23) +
    Math.cos(u * Math.PI * 4.2 + seed * 0.31) * 0.18;
  const maxRad =
    ((PILLAR_MAX_TILT_DEG * entry.intensity) * Math.PI) / 180;

  return {
    tiltX: wobble * envelope * maxRad,
    tiltZ: wobble2 * envelope * maxRad * 0.92,
  };
}

export function triggerOctagonShake(x: number, z: number): void {
  triggerVisualShake(octagonShakeKey(x, z), 0.9);
}

export function triggerBillboardShake(x: number, y: number, z: number): void {
  triggerVisualShake(billboardShakeKey(x, y, z), 0.95);
}

const CEILING_WALL_SHAKE_MS = 380;
const CEILING_WALL_MAX_TILT_DEG = 2.1;

export function triggerCeilingWallHit(): void {
  triggerVisualShake('ceilingWall', 1, CEILING_WALL_SHAKE_MS);
}

export function getCeilingWallHitPulse(): number {
  const entry = shakes.get('ceilingWall');
  if (!entry) return 0;
  const now = performance.now();
  const remaining = entry.until - now;
  if (remaining <= 0) {
    shakes.delete('ceilingWall');
    return 0;
  }
  const u = 1 - remaining / CEILING_WALL_SHAKE_MS;
  return Math.max(0, Math.sin(u * Math.PI));
}

export function getCeilingWallWobble(seed = 0): { tiltX: number; tiltZ: number } {
  const entry = shakes.get('ceilingWall');
  if (!entry) return { tiltX: 0, tiltZ: 0 };
  const now = performance.now();
  const remaining = entry.until - now;
  if (remaining <= 0) {
    shakes.delete('ceilingWall');
    return { tiltX: 0, tiltZ: 0 };
  }
  const u = 1 - remaining / CEILING_WALL_SHAKE_MS;
  const envelope = Math.sin(u * Math.PI);
  const wobble = Math.sin(u * Math.PI * 3.3 + seed * 0.17);
  const wobble2 = Math.cos(u * Math.PI * 2.6 + seed * 0.23);
  const maxRad = ((CEILING_WALL_MAX_TILT_DEG * entry.intensity) * Math.PI) / 180;
  return { tiltX: wobble * envelope * maxRad, tiltZ: wobble2 * envelope * maxRad * 0.9 };
}

const BALL_DROP_SHAKE_MS = 520;
const BALL_DROP_MAX_TILT_DEG = 2.35;

export function triggerBallDropShake(intensity = 1): void {
  triggerVisualShake('ballDrop', intensity, BALL_DROP_SHAKE_MS);
}

export function getBallDropShake(seed = 0): { tiltX: number; tiltY: number; tiltZ: number } {
  const entry = shakes.get('ballDrop');
  if (!entry) return { tiltX: 0, tiltY: 0, tiltZ: 0 };
  const now = performance.now();
  const remaining = entry.until - now;
  if (remaining <= 0) {
    shakes.delete('ballDrop');
    return { tiltX: 0, tiltY: 0, tiltZ: 0 };
  }
  const u = 1 - remaining / BALL_DROP_SHAKE_MS;
  const envelope = Math.sin(u * Math.PI);
  const wobble = Math.sin(u * Math.PI * 4.1 + seed * 0.17) + Math.sin(u * Math.PI * 8.2 + seed * 0.41) * 0.22;
  const wobble2 = Math.cos(u * Math.PI * 3.2 + seed * 0.23) + Math.cos(u * Math.PI * 6.4 + seed * 0.31) * 0.18;
  const wobbleY = Math.sin(u * Math.PI * 2.6 + seed * 0.29);
  const maxRad = ((BALL_DROP_MAX_TILT_DEG * entry.intensity) * Math.PI) / 180;
  return {
    tiltX: wobble * envelope * maxRad,
    tiltZ: wobble2 * envelope * maxRad * 0.9,
    tiltY: wobbleY * envelope * maxRad * 0.55,
  };
}
