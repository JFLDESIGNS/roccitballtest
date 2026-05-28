import * as THREE from 'three';
import { ARENA } from '../shared/Constants';
import { hexVertices } from './arenaHex';
import { ARENA_PILLAR, pillarSurfaceRadiusAtY } from './arenaPillarConfig';

const RAIL_PILLAR_GAP_M = 0.58;
const RAIL_GOAL_GAP_M = 27;
const RAIL_CORNER_CUT_M = 4.1;
const RAIL_CORNER_SEGMENTS = 4;
const railPathInsetM =
  ARENA_PILLAR.hexInset +
  pillarSurfaceRadiusAtY(ARENA.arenaLogoBannerY - ARENA.arenaLogoBannerHeightM * 0.5) +
  RAIL_PILLAR_GAP_M;

export const GRIND_RAIL = {
  y: ARENA.arenaLogoBannerY - ARENA.arenaLogoBannerHeightM * 0.5,
  radius: 0.22,
  pathInsetM: railPathInsetM,
  goalGapM: RAIL_GOAL_GAP_M,
  rideOffsetM: 0.06,
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
  openStart: boolean;
  openEnd: boolean;
};

export type GrindRailContact = {
  segmentIndex: number;
  segmentT: number;
  openStart: boolean;
  openEnd: boolean;
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
  openStart = false,
  openEnd = false,
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
    openStart,
    openEnd,
  };
}

function trimTowards(from: THREE.Vector2, to: THREE.Vector2, distance: number) {
  const out = to.clone().sub(from);
  const len = out.length();
  if (len <= 0.0001) return from.clone();
  out.multiplyScalar(Math.min(distance, len * 0.45) / len);
  return from.clone().add(out);
}

function appendRoundedCornerSegments(
  segments: GrindRailSegment[],
  start: THREE.Vector2,
  corner: THREE.Vector2,
  end: THREE.Vector2,
) {
  let last = start;
  for (let i = 1; i <= RAIL_CORNER_SEGMENTS; i += 1) {
    const t = i / RAIL_CORNER_SEGMENTS;
    const point = new THREE.Vector2()
      .copy(start)
      .multiplyScalar((1 - t) * (1 - t))
      .add(corner.clone().multiplyScalar(2 * (1 - t) * t))
      .add(end.clone().multiplyScalar(t * t));
    segments.push(buildSegment(last, point));
    last = point;
  }
}

export function getGrindRailSegments(): GrindRailSegment[] {
  if (cachedSegments) return cachedSegments;
  const verts = hexVertices(ARENA.hexRadius - GRIND_RAIL.pathInsetM);
  const trimmedVerts = verts.map((corner, i) => {
    const prev = verts[(i - 1 + verts.length) % verts.length]!;
    const next = verts[(i + 1) % verts.length]!;
    return {
      corner,
      inPoint: trimTowards(corner, prev, RAIL_CORNER_CUT_M),
      outPoint: trimTowards(corner, next, RAIL_CORNER_CUT_M),
    };
  });
  const segments: GrindRailSegment[] = [];
  for (let i = 0; i < trimmedVerts.length; i++) {
    const a = trimmedVerts[i]!;
    const b = trimmedVerts[(i + 1) % trimmedVerts.length]!;
    const dx = b.inPoint.x - a.outPoint.x;
    const dz = b.inPoint.y - a.outPoint.y;
    const length = Math.hypot(dx, dz);
    const tangentX = dx / length;
    const tangentZ = dz / length;

    if ((i === 0 || i === 3) && length > GRIND_RAIL.goalGapM + 8) {
      const keep = (length - GRIND_RAIL.goalGapM) * 0.5;
      segments.push(
        buildSegment(
          a.outPoint,
          new THREE.Vector2(
            a.outPoint.x + tangentX * keep,
            a.outPoint.y + tangentZ * keep,
          ),
          false,
          true,
        ),
      );
      segments.push(
        buildSegment(
          new THREE.Vector2(
            b.inPoint.x - tangentX * keep,
            b.inPoint.y - tangentZ * keep,
          ),
          b.inPoint,
          true,
          false,
        ),
      );
    } else {
      segments.push(buildSegment(a.outPoint, b.inPoint));
    }
    appendRoundedCornerSegments(segments, a.outPoint, b.corner, b.inPoint);
  }
  cachedSegments = segments;
  return cachedSegments;
}

const _nearest: GrindRailContact = {
  segmentIndex: -1,
  segmentT: 0,
  openStart: false,
  openEnd: false,
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
};

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
  let bestT = 0;
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
      bestT = t;
      bestX = px;
      bestZ = pz;
      bestDistanceSq = d2;
    }
  }

  const distance = Math.sqrt(bestDistanceSq);
  if (!best || distance > horizontalRange) return null;

  _nearest.segmentIndex = bestIndex;
  _nearest.segmentT = bestT;
  _nearest.openStart = best.openStart;
  _nearest.openEnd = best.openEnd;
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
