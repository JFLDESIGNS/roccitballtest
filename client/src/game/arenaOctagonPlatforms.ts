import { ARENA } from '../shared/Constants';
import { hexCornerPositions, isMidMapWallCorner } from './arenaHex';

export type OctagonPlatformPlacement = {
  x: number;
  z: number;
  sizeScale: number;
};

/** Every raised octagon deck in the arena (center + hex corners). */
export function listOctagonPlatformPlacements(): OctagonPlatformPlacement[] {
  const corners = hexCornerPositions(ARENA.hexRadius);
  return [
    { x: 0, z: 0, sizeScale: 1 },
    ...corners.map((c) => ({
      x: c.x,
      z: c.z,
      sizeScale: isMidMapWallCorner(c.x) ? ARENA.midWallOctagonSizeScale : 1,
    })),
  ];
}
