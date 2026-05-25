import * as THREE from 'three';
import { ARENA, ARENA_PADS } from '../shared/Constants';
import { getArenaCornerPillarLayouts } from './arenaPillars';
import { hexVertices, isMidMapWallCorner } from './arenaHex';
import { goalEndFaceX } from './goals';

export type WallMount = {
  x: number;
  y: number;
  z: number;
  yaw: number;
};

export type FloorPad = {
  x: number;
  z: number;
  radius: number;
  /** Top of the shared stone platform */
  platformTopY: number;
};

function hexEdgeMount(
  a: THREE.Vector2,
  b: THREE.Vector2,
  inset: number,
): WallMount {
  const midX = (a.x + b.x) / 2;
  const midZ = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dz = b.y - a.y;
  const len = Math.hypot(dx, dz) || 1;
  let nx = -dz / len;
  let nz = dx / len;
  if (midX * nx + midZ * nz > 0) {
    nx = -nx;
    nz = -nz;
  }
  const faceOffset = ARENA_PADS.billboardFaceOffsetM;
  return {
    x: midX + nx * (inset + faceOffset),
    y: ARENA_PADS.billboardCenterYM,
    z: midZ + nz * (inset + faceOffset),
    yaw: Math.atan2(-dz, dx),
  };
}

const NON_GOAL_HEX_EDGES: [number, number][] = [
  [1, 2],
  [2, 3],
  [4, 5],
  [5, 0],
];

/** Wall-face mounts for recessed fan stands (flush with perimeter wall, not billboards). */
export function getFanWallMounts(): WallMount[] {
  const verts = hexVertices(ARENA.hexRadius);
  const inset = ARENA.wallThickness / 2 + 0.05;
  return NON_GOAL_HEX_EDGES.map(([i, j]) =>
    hexWallFaceMount(verts[i], verts[j], inset),
  );
}

export function getBillboardMounts(): WallMount[] {
  const verts = hexVertices(ARENA.hexRadius);
  const inset = ARENA_PADS.billboardWallInsetM;
  return NON_GOAL_HEX_EDGES.map(([i, j]) => hexEdgeMount(verts[i], verts[j], inset));
}

function hexWallFaceMount(
  a: THREE.Vector2,
  b: THREE.Vector2,
  inset: number,
): WallMount {
  const midX = (a.x + b.x) / 2;
  const midZ = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dz = b.y - a.y;
  const len = Math.hypot(dx, dz) || 1;
  let nx = -dz / len;
  let nz = dx / len;
  if (midX * nx + midZ * nz > 0) {
    nx = -nx;
    nz = -nz;
  }
  return {
    x: midX + nx * inset,
    y: ARENA_PADS.fanBayCenterYM,
    z: midZ + nz * inset,
    yaw: Math.atan2(-dz, dx),
  };
}

function platformBaseY(): number {
  return (
    ARENA.floorY +
    ARENA_PADS.padPlatformHeightM +
    ARENA_PADS.padPlatformRaiseFt * 0.3048
  );
}

/** Corner pillars beside a goal end — used for bounce pad placement. */
function goalFlankPillarPositions(team: 'red' | 'blue'): { x: number; z: number }[] {
  const face = goalEndFaceX();
  const pillars = getArenaCornerPillarLayouts();
  const onEnd = pillars
    .filter((p) => (team === 'red' ? p.x < -20 : p.x > 20))
    .filter((p) => Math.abs(p.z) > 16)
    .sort((a, b) => b.z - a.z);
  const x = team === 'red' ? -face + 10 : face - 10;
  if (onEnd.length >= 2) {
    return onEnd.map((p) => ({ x, z: p.z }));
  }
  return [
    { x, z: 28 },
    { x, z: -28 },
  ];
}

function trampolinePadRadius(): number {
  return (
    ARENA_PADS.bouncePadRadiusM *
    ARENA_PADS.bouncePadWidthScale *
    ARENA_PADS.bouncePadSizeScale
  );
}

/** Top / bottom mid-wall pillars — pad on field side, offset from pillar toward center */
function midWallTrampolinePads(
  r: number,
  topY: number,
): FloorPad[] {
  const pillars = getArenaCornerPillarLayouts().filter((p) =>
    isMidMapWallCorner(p.x),
  );
  const inset = ARENA_PADS.midWallPadCenterInsetM;

  return pillars.map((p) => {
    const towardCenterZ = -Math.sign(p.z || 1);
    return {
      x: p.x,
      z: p.z + towardCenterZ * inset,
      radius: r,
      platformTopY: topY,
    };
  });
}

/**
 * Bounce trampolines at goal corners (4) + mid-wall pillars (2) = 6 total.
 */
export function getBounceTrampolinePads(): FloorPad[] {
  const r = trampolinePadRadius();
  const topY = platformBaseY() + ARENA_PADS.trampolineDeckRaiseM;
  const inset = ARENA_PADS.trampolinePillarClearanceM;

  const pads: FloorPad[] = [];
  for (const team of ['red', 'blue'] as const) {
    for (const p of goalFlankPillarPositions(team)) {
      pads.push({
        x: p.x + (team === 'red' ? inset : -inset),
        z: p.z,
        radius: r,
        platformTopY: topY,
      });
    }
  }
  pads.push(...midWallTrampolinePads(r, topY));
  return pads;
}

/**
 * Speed strips removed — launch trampolines only.
 */
export function getSpeedBoosterPads(): never[] {
  return [];
}

/** Standable surface Y at (x,z) on trampoline pads — stone ring or cyan deck */
export function sampleTrampolineFloorY(x: number, z: number): number | null {
  const pads = getBounceTrampolinePads();
  for (const pad of pads) {
    const stoneR = pad.radius * 1.2;
    const d = Math.hypot(x - pad.x, z - pad.z);
    if (d > stoneR) continue;
    if (d <= pad.radius) {
      return pad.platformTopY + ARENA_PADS.bouncePadHeightM;
    }
    return pad.platformTopY;
  }
  return null;
}

export function bounceLaunchSpeedY(gravity = -11, strengthMult = 1): number {
  const h = ARENA_PADS.bounceLaunchHeightFt * 0.3048;
  const g = Math.abs(gravity);
  return (
    Math.sqrt(2 * g * h) *
    strengthMult *
    ARENA_PADS.trampolineStrengthScale
  );
}
