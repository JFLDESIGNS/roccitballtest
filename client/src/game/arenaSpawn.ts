import { ARENA } from '../shared/Constants';
import { hexCornerPositions, isMidMapWallCorner } from './arenaHex';
import { isPointInOctagon } from './arenaOctagon';
import { sampleTrampolineFloorY } from './arenaPadLayout';

export type ArenaPlatformPlacement = {
  x: number;
  z: number;
  topR: number;
  slopeR: number;
};

/** All raised octagon decks (center + hex corners). */
export function listArenaPlatforms(): ArenaPlatformPlacement[] {
  const corners = hexCornerPositions(ARENA.hexRadius);
  const baseSlope = ARENA.octagonSlopeRadius;
  const baseTop = ARENA.octagonTopRadius;
  const scalePlatform = (s: number) => ({
    topR: baseTop * s,
    slopeR: baseSlope * s,
  });
  return [
    { x: 0, z: 0, ...scalePlatform(1) },
    ...corners.map((c) => ({
      x: c.x,
      z: c.z,
      ...scalePlatform(isMidMapWallCorner(c.x) ? ARENA.midWallOctagonSizeScale : 1),
    })),
  ];
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
