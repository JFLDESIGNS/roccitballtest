import { ROCKET } from '../shared/Constants';

export type BeamDenyZone = {
  x: number;
  y: number;
  z: number;
  radius: number;
  until: number;
};

const zones: BeamDenyZone[] = [];
const MAX_ZONES = 20;

export function registerBeamDenyZone(
  x: number,
  y: number,
  z: number,
  radius: number = ROCKET.beamDenyRadius,
  durationSec: number = ROCKET.beamDenyDurationSec,
) {
  const until = performance.now() / 1000 + durationSec;
  zones.push({ x, y, z, radius, until });
  if (zones.length > MAX_ZONES) zones.splice(0, zones.length - MAX_ZONES);
}

export function tickBeamDenyZones(nowSec = performance.now() / 1000) {
  for (let i = zones.length - 1; i >= 0; i--) {
    if (zones[i].until <= nowSec) zones.splice(i, 1);
  }
}

export function getActiveBeamDenyZones(): readonly BeamDenyZone[] {
  return zones;
}

/** Ball or chest inside blast deny field — no beam pull / bot beam */
export function isBeamDenied(x: number, y: number, z: number): boolean {
  const now = performance.now() / 1000;
  for (const zone of zones) {
    if (zone.until <= now) continue;
    const dx = x - zone.x;
    const dz = z - zone.z;
    const dy = Math.abs(y - zone.y);
    if (dy > 10) continue;
    if (Math.hypot(dx, dz) <= zone.radius) return true;
  }
  return false;
}
