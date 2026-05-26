import * as THREE from 'three';
import { ROCKET } from '../shared/Constants';
import { spawnRocketTrailSmokeBurst } from './rocketTrailSmokePuffs';

export { tickRocketTrailSmokePuffs as tickRocketSmokeStreaks } from './rocketTrailSmokePuffs';

const TRAIL_MIN_STEP = ROCKET.trailPuffSpawnStepM;

const lastTipByRocket = new Map<string, THREE.Vector3>();
const _tip = new THREE.Vector3();

/** Simple exhaust — puff burst when the rocket moves far enough */
export function spawnRocketSmokeStreak(
  rocketId: string | null,
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
  explosive: boolean,
): void {
  if (!rocketId) return;

  _tip.set(x, y, z);
  const last = lastTipByRocket.get(rocketId);
  if (!last) {
    lastTipByRocket.set(rocketId, _tip.clone());
    return;
  }

  if (last.distanceTo(_tip) < TRAIL_MIN_STEP) return;

  spawnRocketTrailSmokeBurst(x, y, z, explosive, vx, vy, vz);
  last.copy(_tip);
}

export function releaseRocketSmokeTrail(rocketId: string | null): void {
  if (rocketId) lastTipByRocket.delete(rocketId);
}
