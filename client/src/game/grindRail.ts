import * as THREE from 'three';
import { ARENA, MOVEMENT } from '../shared/Constants';
import { hexVertices } from './arenaHex';
import { ARENA_PILLAR, pillarSurfaceRadiusAtY } from './arenaPillarConfig';

const RAIL_PILLAR_GAP_M = 0.35;
const RAIL_GOAL_GAP_M = 27;
const railPathInsetM =
  ARENA_PILLAR.hexInset +
  pillarSurfaceRadiusAtY(ARENA.arenaLogoBannerY - ARENA.arenaLogoBannerHeightM * 0.5) +
  RAIL_PILLAR_GAP_M;

export const GRIND_RAIL = {
  y: ARENA.arenaLogoBannerY - ARENA.arenaLogoBannerHeightM * 0.5,
  radius: 0.22,
  pathInsetM: railPathInsetM,
  goalGapM: RAIL_GOAL_GAP_M,
  rideOffsetM: MOVEMENT.capsuleRadius + 0.52,
  contactHorizontalM: 1.45,
  activeHorizontalM: 2.15,
  contactVerticalM: 1.05,
  entryMinSpeed: 5.5,
  minRideSpeed: 1.8,
  decelMps2: 3.4,
  jumpOutwardSpeed: 5.5,
  jumpCooldownSec: 0.42,
} as const;

export type GrindRailSegment = {
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  midX: number;
  midZ: number;
  length: number;
  yaw: number;
  tangentX: number;
  tangentZ: number;
  inwardX: number;
  inwardZ: number;
};

export type GrindRailContact = {
  segmentIndex: number;
  x: number;
  y: number;
  z: number;
  rideX: number;
  rideZ: number;
  distance: number;
  tangentX: number;
  tangentZ: number;
  inwardX: number;
  inwardZ: number;
};

let cachedSegments: GrindRailSegment[] | null = null;

function buildSegment(
  start: THREE.Vector2,
  end: THREE.Vector2,
): GrindRailSegment {
  const dx = end.x - start.x;
  const dz = end.y - start.y;
  const length = Math.hypot(dx, dz);
  const tangentX = dx / length;
  const tangentZ = dz / length;
  const midX = (start.x + end.x) * 0.5;
  const midZ = (start.y + end.y) * 0.5;
  let outwardX = tangentZ;
  let outwardZ = -tangentX;
  if (midX * outwardX + midZ * outwardZ < 0) {
    outwardX = -outwardX;
    outwardZ = -outwardZ;
  }

  return {
    startX: start.x,
    startZ: start.y,
    endX: end.x,
    endZ: end.y,
    midX,
    midZ,
    length,
    yaw: Math.atan2(-tangentZ, tangentX),
    tangentX,
    tangentZ,
    inwardX: -outwardX,
    inwardZ: -outwardZ,
  };
}

export function getGrindRailSegments(): GrindRailSegment[] {
  if (cachedSegments) return cachedSegments;
  const verts = hexVertices(ARENA.hexRadius - GRIND_RAIL.pathInsetM);
  const segments: GrindRailSegment[] = [];
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i]!;
    const b = verts[(i + 1) % verts.length]!;
    const dx = b.x - a.x;
    const dz = b.y - a.y;
    const length = Math.hypot(dx, dz);
    const tangentX = dx / length;
    const tangentZ = dz / length;

    if ((i === 0 || i === 3) && length > GRIND_RAIL.goalGapM + 8) {
      const keep = (length - GRIND_RAIL.goalGapM) * 0.5;
      segments.push(
        buildSegment(
          a,
          new THREE.Vector2(a.x + tangentX * keep, a.y + tangentZ * keep),
        ),
      );
      segments.push(
        buildSegment(
          new THREE.Vector2(b.x - tangentX * keep, b.y - tangentZ * keep),
          b,
        ),
      );
    } else {
      segments.push(buildSegment(a, b));
    }
  }
  cachedSegments = segments;
  return cachedSegments;
}

const _nearest = {
  segmentIndex: -1,
  x: 0,
  y: GRIND_RAIL.y,
  z: 0,
  rideX: 0,
  rideZ: 0,
  distance: Infinity,
  tangentX: 1,
  tangentZ: 0,
  inwardX: 0,
  inwardZ: 1,
} satisfies GrindRailContact;

export function sampleGrindRailContact(
  x: number,
  centerY: number,
  z: number,
  horizontalRange: number = GRIND_RAIL.contactHorizontalM,
  verticalRange: number = GRIND_RAIL.contactVerticalM,
): GrindRailContact | null {
  if (Math.abs(centerY - GRIND_RAIL.y) > verticalRange) return null;

  let best: GrindRailSegment | null = null;
  let bestIndex = -1;
  let bestX = 0;
  let bestZ = 0;
  let bestDistanceSq = Infinity;

  const segments = getGrindRailSegments();
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]!;
    const ax = x - s.startX;
    const az = z - s.startZ;
    const t = THREE.MathUtils.clamp(
      (ax * s.tangentX + az * s.tangentZ) / s.length,
      0,
      1,
    );
    const px = s.startX + s.tangentX * s.length * t;
    const pz = s.startZ + s.tangentZ * s.length * t;
    const dx = x - px;
    const dz = z - pz;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestDistanceSq) {
      best = s;
      bestIndex = i;
      bestX = px;
      bestZ = pz;
      bestDistanceSq = d2;
    }
  }

  const distance = Math.sqrt(bestDistanceSq);
  if (!best || distance > horizontalRange) return null;

  _nearest.segmentIndex = bestIndex;
  _nearest.x = bestX;
  _nearest.y = GRIND_RAIL.y;
  _nearest.z = bestZ;
  _nearest.rideX = bestX + best.inwardX * GRIND_RAIL.rideOffsetM;
  _nearest.rideZ = bestZ + best.inwardZ * GRIND_RAIL.rideOffsetM;
  _nearest.distance = distance;
  _nearest.tangentX = best.tangentX;
  _nearest.tangentZ = best.tangentZ;
  _nearest.inwardX = best.inwardX;
  _nearest.inwardZ = best.inwardZ;
  return _nearest;
}
