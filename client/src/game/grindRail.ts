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
  radius: 0.52,
  pathInsetM: railPathInsetM,
  goalGapM: RAIL_GOAL_GAP_M,
  rideOffsetM: 0.02,
  contactHorizontalM: 2.1,
  activeHorizontalM: 2.8,
  contactVerticalM: 1.05,
  entryMinSpeed: 5.5,
  maxSpeedSprintMul: 1.575,
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
let cachedPaths: THREE.Vector3[][] | null = null;

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

function appendRoundedCornerPoints(
  path: THREE.Vector2[],
  start: THREE.Vector2,
  corner: THREE.Vector2,
  end: THREE.Vector2,
) {
  for (let i = 1; i <= RAIL_CORNER_SEGMENTS; i += 1) {
    const t = i / RAIL_CORNER_SEGMENTS;
    const point = new THREE.Vector2()
      .copy(start)
      .multiplyScalar((1 - t) * (1 - t))
      .add(corner.clone().multiplyScalar(2 * (1 - t) * t))
      .add(end.clone().multiplyScalar(t * t));
    path.push(point);
  }
}

function edgeGapPoints(
  trimmedVerts: Array<{
    corner: THREE.Vector2;
    inPoint: THREE.Vector2;
    outPoint: THREE.Vector2;
  }>,
  edgeIndex: number,
) {
  const a = trimmedVerts[edgeIndex]!;
  const b = trimmedVerts[(edgeIndex + 1) % trimmedVerts.length]!;
  const dx = b.inPoint.x - a.outPoint.x;
  const dz = b.inPoint.y - a.outPoint.y;
  const length = Math.hypot(dx, dz);
  const tangentX = dx / length;
  const tangentZ = dz / length;
  const keep = (length - GRIND_RAIL.goalGapM) * 0.5;
  return {
    firstEnd: new THREE.Vector2(
      a.outPoint.x + tangentX * keep,
      a.outPoint.y + tangentZ * keep,
    ),
    secondStart: new THREE.Vector2(
      b.inPoint.x - tangentX * keep,
      b.inPoint.y - tangentZ * keep,
    ),
  };
}

function buildRailPaths2d() {
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
  const gap0 = edgeGapPoints(trimmedVerts, 0);
  const gap3 = edgeGapPoints(trimmedVerts, 3);

  const pathA: THREE.Vector2[] = [gap0.secondStart.clone(), trimmedVerts[1]!.inPoint.clone()];
  appendRoundedCornerPoints(
    pathA,
    trimmedVerts[1]!.inPoint,
    trimmedVerts[1]!.corner,
    trimmedVerts[1]!.outPoint,
  );
  pathA.push(trimmedVerts[2]!.inPoint.clone());
  appendRoundedCornerPoints(
    pathA,
    trimmedVerts[2]!.inPoint,
    trimmedVerts[2]!.corner,
    trimmedVerts[2]!.outPoint,
  );
  pathA.push(trimmedVerts[3]!.inPoint.clone());
  appendRoundedCornerPoints(
    pathA,
    trimmedVerts[3]!.inPoint,
    trimmedVerts[3]!.corner,
    trimmedVerts[3]!.outPoint,
  );
  pathA.push(gap3.firstEnd.clone());

  const pathB: THREE.Vector2[] = [gap3.secondStart.clone(), trimmedVerts[4]!.inPoint.clone()];
  appendRoundedCornerPoints(
    pathB,
    trimmedVerts[4]!.inPoint,
    trimmedVerts[4]!.corner,
    trimmedVerts[4]!.outPoint,
  );
  pathB.push(trimmedVerts[5]!.inPoint.clone());
  appendRoundedCornerPoints(
    pathB,
    trimmedVerts[5]!.inPoint,
    trimmedVerts[5]!.corner,
    trimmedVerts[5]!.outPoint,
  );
  pathB.push(trimmedVerts[0]!.inPoint.clone());
  appendRoundedCornerPoints(
    pathB,
    trimmedVerts[0]!.inPoint,
    trimmedVerts[0]!.corner,
    trimmedVerts[0]!.outPoint,
  );
  pathB.push(gap0.firstEnd.clone());

  return [pathA, pathB];
}

export function getGrindRailPaths(): THREE.Vector3[][] {
  if (cachedPaths) return cachedPaths;
  cachedPaths = buildRailPaths2d().map((path) =>
    path.map((point) => new THREE.Vector3(point.x, GRIND_RAIL.y, point.y)),
  );
  return cachedPaths;
}

export function getGrindRailSegments(): GrindRailSegment[] {
  if (cachedSegments) return cachedSegments;
  const segments: GrindRailSegment[] = [];
  const paths = buildRailPaths2d();
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i += 1) {
      segments.push(
        buildSegment(
          path[i]!,
          path[i + 1]!,
          i === 0,
          i === path.length - 2,
        ),
      );
    }
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
