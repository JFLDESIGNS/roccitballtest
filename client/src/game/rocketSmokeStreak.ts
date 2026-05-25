import * as THREE from 'three';
import { spawnRocketTrailSmokePuff } from './rocketTrailSmokePuffs';

export { tickRocketTrailSmokePuffs as tickRocketSmokeStreaks } from './rocketTrailSmokePuffs';

const lastTipByRocket = new Map<string, THREE.Vector3>();
const _tip = new THREE.Vector3();

/** Simple exhaust — one small puff when the rocket moves far enough */
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
  const last = lastTipByRocket.get(rocketId);
  if (!last) {
    lastTipByRocket.set(rocketId, _tip.clone());
    spawnRocketTrailSmokePuff(x, y, z, explosive);
    return;
  }

  if (last.distanceTo(_tip) < 0.13) return;

  spawnRocketTrailSmokePuff(x, y, z, explosive);
  last.copy(_tip);
}

export function releaseRocketSmokeTrail(rocketId: string | null): void {
  if (rocketId) lastTipByRocket.delete(rocketId);
}
