import type { WallMount } from './arenaPadLayout';
import { getBillboardMounts } from './arenaPadLayout';
import { getArenaCornerPillarLayouts } from './arenaPillars';
import { burstBillboardFaceSparks } from './impactSparkBurst';
import { burstPillarCornerSmoke } from './pillarSmokePuffs';
import { ARENA_PADS } from '../shared/Constants';

const SHAKE_MS = 500;
const MAX_TILT_DEG = 1.35;
const PILLAR_SHAKE_MS = 680;
const PILLAR_MAX_TILT_DEG = 1.45;
const PILLAR_MAX_OFFSET_M = 0.22;
const BILLBOARD_SHAKE_MS = 1280;
const BILLBOARD_MAX_TILT_DEG = 2.15;

type ShakeEntry = { until: number; intensity: number };

const shakes = new Map<string, ShakeEntry>();
const pillarShakeCooldownUntil = new Map<string, number>();
const PILLAR_SHAKE_COOLDOWN_MS = 120;

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
  const key = pillarShakeKey(x, z);
  const now = performance.now();
  if ((pillarShakeCooldownUntil.get(key) ?? 0) > now) return;
  pillarShakeCooldownUntil.set(key, now + PILLAR_SHAKE_COOLDOWN_MS);

  triggerArenaPillarShakeVisual(x, z, 1.05);
  burstPillarCornerSmoke(x, z);
}

/** Pillar wobble without corner smoke (roof open, etc.). */
export function triggerArenaPillarShakeVisual(
  x: number,
  z: number,
  intensity = 1,
): void {
  triggerVisualShake(pillarShakeKey(x, z), intensity, PILLAR_SHAKE_MS);
}

/** Roof open/close rumble — pillars, jumbotron, billboards, center platform. */
export function triggerStadiumRoofRumbleShake(): void {
  for (const p of getArenaCornerPillarLayouts()) {
    triggerArenaPillarShakeVisual(p.x, p.z, 1.05);
  }
  triggerBallDropShake(1.12);
  triggerOctagonShake(0, 0);
  for (const mount of getBillboardMounts()) {
    triggerBillboardShakeVisual(mount, 1.1);
  }
}

/** @deprecated use triggerStadiumRoofRumbleShake */
export const triggerStadiumRoofOpenShake = triggerStadiumRoofRumbleShake;

export function getArenaPillarShake(x: number, z: number): {
  tiltX: number;
  tiltZ: number;
  offsetX: number;
  offsetZ: number;
} {
  const key = pillarShakeKey(x, z);
  const entry = shakes.get(key);
  if (!entry) {
    return { tiltX: 0, tiltZ: 0, offsetX: 0, offsetZ: 0 };
  }

  const now = performance.now();
  const remaining = entry.until - now;
  if (remaining <= 0) {
    shakes.delete(key);
    return { tiltX: 0, tiltZ: 0, offsetX: 0, offsetZ: 0 };
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
  const maxOff = PILLAR_MAX_OFFSET_M * entry.intensity * envelope;

  return {
    tiltX: wobble * envelope * maxRad,
    tiltZ: wobble2 * envelope * maxRad * 0.92,
    offsetX: wobble * maxOff,
    offsetZ: wobble2 * maxOff * 0.88,
  };
}

export function triggerOctagonShake(x: number, z: number): void {
  triggerVisualShake(octagonShakeKey(x, z), 0.9);
}

const billboardSparkCooldownUntil = new Map<string, number>();
const BILLBOARD_SPARK_COOLDOWN_MS = 90;

export function triggerBillboardShakeVisual(
  mount: WallMount,
  intensity = 1.35,
): void {
  const key = billboardShakeKey(mount.x, mount.y, mount.z);
  const now = performance.now();
  const existing = shakes.get(key);
  const until = Math.max(existing?.until ?? 0, now + BILLBOARD_SHAKE_MS);
  shakes.set(key, { until, intensity });
}

export function triggerBillboardShake(mount: WallMount): void {
  const key = billboardShakeKey(mount.x, mount.y, mount.z);
  const now = performance.now();
  triggerBillboardShakeVisual(mount, 1.35);

  if ((billboardSparkCooldownUntil.get(key) ?? 0) <= now) {
    billboardSparkCooldownUntil.set(key, now + BILLBOARD_SPARK_COOLDOWN_MS);
    burstBillboardFaceSparks(
    mount.x,
    mount.y,
    mount.z,
    mount.yaw,
      ARENA_PADS.billboardWidthM,
      ARENA_PADS.billboardHeightM,
    );
  }
}

export function getBillboardShake(
  x: number,
  y: number,
  z: number,
): { tiltX: number; tiltY: number; tiltZ: number } {
  const key = billboardShakeKey(x, y, z);
  const entry = shakes.get(key);
  if (!entry) return { tiltX: 0, tiltY: 0, tiltZ: 0 };

  const now = performance.now();
  const remaining = entry.until - now;
  if (remaining <= 0) {
    shakes.delete(key);
    return { tiltX: 0, tiltY: 0, tiltZ: 0 };
  }

  const seed = x + y * 0.07 + z;
  const u = 1 - remaining / BILLBOARD_SHAKE_MS;
  const envelope = Math.sin(u * Math.PI);
  const wobble =
    Math.sin(u * Math.PI * 4.2 + seed * 0.19) +
    Math.sin(u * Math.PI * 6.4 + seed * 0.37) * 0.22;
  const wobble2 =
    Math.cos(u * Math.PI * 3.6 + seed * 0.27) +
    Math.cos(u * Math.PI * 5.5 + seed * 0.43) * 0.16;
  const wobbleY =
    Math.sin(u * Math.PI * 3.1 + seed * 0.33) +
    Math.sin(u * Math.PI * 7.2 + seed * 0.49) * 0.14;
  const maxRad =
    ((BILLBOARD_MAX_TILT_DEG * entry.intensity) * Math.PI) / 180;

  return {
    tiltX: wobble * envelope * maxRad * 0.82,
    tiltZ: wobble2 * envelope * maxRad * 0.78,
    tiltY: wobbleY * envelope * maxRad * 0.55,
  };
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

export function isBallDropShaking(): boolean {
  const entry = shakes.get('ballDrop');
  if (!entry) return false;
  if (performance.now() >= entry.until) {
    shakes.delete('ballDrop');
    return false;
  }
  return true;
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
