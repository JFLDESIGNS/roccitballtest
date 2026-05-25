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
    lastTipByRocket.set(rocketId, new THREE.Vector3(x, y, z));
    return;
  }
  const last = lastTipByRocket.get(rocketId)!;

  const dist = last.distanceTo(_tip);
  if (dist < 0.14) return;

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
