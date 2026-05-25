import * as THREE from 'three';
import { spawnRocketTrailSmokeAlongSegment } from './rocketTrailSmokePuffs';

export { tickRocketTrailSmokePuffs as tickRocketSmokeStreaks } from './rocketTrailSmokePuffs';

const lastTipByRocket = new Map<string, THREE.Vector3>();
const _tip = new THREE.Vector3();

/** Smoke puffs along the rocket path — fades to grey away from the tip */
export function spawnRocketSmokeStreak(
  rocketId: string | null,
  x: number,
  y: number,
  z: number,
  _vx: number,
  _vy: number,
  _vz: number,
  explosive: boolean,
): void {
  if (!rocketId) return;

  _tip.set(x, y, z);
  if (!lastTipByRocket.has(rocketId)) {
    const seed = new THREE.Vector3(x, y, z);
    lastTipByRocket.set(rocketId, seed);
    const back = Math.max(0.12, Math.hypot(_vx, _vy, _vz) * 0.03);
    const inv = back > 1e-5 ? 1 / Math.hypot(_vx, _vy, _vz) : 0;
    spawnRocketTrailSmokeAlongSegment(
      x - _vx * inv * back,
      y - _vy * inv * back,
      z - _vz * inv * back,
      x,
      y,
      z,
      explosive,
    );
    return;
  }
  const last = lastTipByRocket.get(rocketId)!;

  const dist = last.distanceTo(_tip);
  if (dist < 0.035) return;

  spawnRocketTrailSmokeAlongSegment(
    last.x,
    last.y,
    last.z,
    x,
    y,
    z,
    explosive,
  );

  last.copy(_tip);
}

export function releaseRocketSmokeTrail(rocketId: string | null): void {
  if (rocketId) lastTipByRocket.delete(rocketId);
}
