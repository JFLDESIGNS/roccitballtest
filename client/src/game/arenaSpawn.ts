import { ARENA } from '../shared/Constants';
import { mapRegistryStore } from '../mapEditor/mapEditorStore';
import {
  stadiumPlatformKey,
} from '../mapEditor/stadiumLayout';
import { isPointInOctagon } from './arenaOctagon';
import { listOctagonPlatformPlacements } from './arenaOctagonPlatforms';
import { sampleTrampolineFloorY } from './arenaPadLayout';

export type ArenaPlatformPlacement = {
  x: number;
  z: number;
  topR: number;
  slopeR: number;
};

/** All raised octagon decks (center + hex corners), including custom map offsets. */
export function listArenaPlatforms(): ArenaPlatformPlacement[] {
  const placements = listOctagonPlatformPlacements();
  const sizeMul = ARENA.octagonPlatformSizeMul;
  const baseSlope = ARENA.octagonSlopeRadius * sizeMul;
  const baseTop = ARENA.octagonTopRadius * sizeMul;
  const doc = mapRegistryStore.getActiveMapDocument();

  return placements.map((p, i) => {
    let x = p.x;
    let z = p.z;
    let scale = p.sizeScale;
    const group = doc?.groups.find((g) => g.stadiumKey === stadiumPlatformKey(i));
    if (group) {
      x = group.position[0];
      z = group.position[2];
      scale = p.sizeScale * ((group.scale[0] + group.scale[2]) / 2);
    }
    return {
      x,
      z,
      topR: baseTop * scale,
      slopeR: baseSlope * scale,
    };
  });
}

/** Deck + ramp height at world (x, z), or null if outside the platform footprint. */
export function platformSurfaceYAt(
  x: number,
  z: number,
  p: ArenaPlatformPlacement,
): number | null {
  const dx = x - p.x;
  const dz = z - p.z;
  if (!isPointInOctagon(dx, dz, p.slopeR)) return null;
  const d = Math.hypot(dx, dz);
  if (d > p.slopeR) return null;
  if (d <= p.topR) return ARENA.platformTopHeight;
  const t = (d - p.topR) / Math.max(p.slopeR - p.topR, 0.01);
  return (
    ARENA.platformTopHeight * (1 - t) +
    ARENA.floorY * t
  );
}

export function getMaxPlatformSurfaceY(x: number, z: number): number | null {
  let best: number | null = null;
  for (const p of listArenaPlatforms()) {
    const y = platformSurfaceYAt(x, z, p);
    if (y !== null && (best === null || y > best)) best = y;
  }
  const tramp = sampleTrampolineFloorY(x, z);
  if (tramp !== null && (best === null || tramp > best)) best = tramp;
  return best;
}

export function isOverArenaPlatform(x: number, z: number): boolean {
  for (const p of listArenaPlatforms()) {
    const dx = x - p.x;
    const dz = z - p.z;
    if (dx * dx + dz * dz <= p.slopeR * p.slopeR) return true;
  }
  return false;
}

/** Rigid-body center Y when standing on surface at (x, z). */
export function getArenaStandY(x: number, z: number, bodyCenterOffset = 2): number {
  const surface = isOverArenaPlatform(x, z)
    ? ARENA.platformTopHeight
    : ARENA.floorY;
  return surface + bodyCenterOffset;
}
