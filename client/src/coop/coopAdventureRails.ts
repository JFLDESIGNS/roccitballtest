import * as THREE from 'three';
import { GRIND_RAIL, type GrindRailContact } from '../game/grindRail';

export type CoopAdventureRailSpec = {
  key: string;
  start: THREE.Vector3;
  end: THREE.Vector3;
};

type CoopRailSegment = {
  key: string;
  start: THREE.Vector3;
  end: THREE.Vector3;
  length: number;
  tangentX: number;
  tangentY: number;
  tangentZ: number;
  inwardX: number;
  inwardZ: number;
};

const rails: CoopRailSegment[] = [];

const _nearest: GrindRailContact = {
  segmentIndex: -1,
  segmentT: 0,
  openStart: true,
  openEnd: true,
  x: 0,
  y: 0,
  z: 0,
  rideX: 0,
  rideZ: 0,
  distance: Infinity,
  tangentX: 1,
  tangentZ: 0,
  inwardX: 0,
  inwardZ: 1,
};

export function setCoopAdventureRails(specs: CoopAdventureRailSpec[]): void {
  rails.length = 0;
  for (const spec of specs) {
    const dx = spec.end.x - spec.start.x;
    const dy = spec.end.y - spec.start.y;
    const dz = spec.end.z - spec.start.z;
    const length = Math.hypot(dx, dy, dz);
    if (length < 0.01) continue;
    const tangentX = dx / length;
    const tangentY = dy / length;
    const tangentZ = dz / length;
    let inwardX = -tangentZ;
    let inwardZ = tangentX;
    const midX = (spec.start.x + spec.end.x) * 0.5;
    const midZ = (spec.start.z + spec.end.z) * 0.5;
    if (midX * inwardX + midZ * inwardZ > 0) {
      inwardX = -inwardX;
      inwardZ = -inwardZ;
    }
    rails.push({
      key: spec.key,
      start: spec.start.clone(),
      end: spec.end.clone(),
      length,
      tangentX,
      tangentY,
      tangentZ,
      inwardX,
      inwardZ,
    });
  }
}

export function clearCoopAdventureRails(): void {
  rails.length = 0;
}

export function sampleCoopAdventureRailContact(
  x: number,
  centerY: number,
  z: number,
  horizontalRange: number = GRIND_RAIL.contactHorizontalM,
  verticalRange: number = GRIND_RAIL.contactVerticalM + 1.8,
): GrindRailContact | null {
  let best: CoopRailSegment | null = null;
  let bestIndex = -1;
  let bestT = 0;
  let bestX = 0;
  let bestY = 0;
  let bestZ = 0;
  let bestDistanceSq = Infinity;

  for (let i = 0; i < rails.length; i += 1) {
    const s = rails[i]!;
    const ax = x - s.start.x;
    const ay = centerY - s.start.y;
    const az = z - s.start.z;
    const t = THREE.MathUtils.clamp(
      (ax * s.tangentX + ay * s.tangentY + az * s.tangentZ) / s.length,
      0,
      1,
    );
    const px = s.start.x + s.tangentX * s.length * t;
    const py = s.start.y + s.tangentY * s.length * t;
    const pz = s.start.z + s.tangentZ * s.length * t;
    const dx = x - px;
    const dy = centerY - py;
    const dz = z - pz;
    if (Math.abs(dy) > verticalRange) continue;
    const d2 = dx * dx + dz * dz + dy * dy * 0.18;
    if (d2 < bestDistanceSq) {
      best = s;
      bestIndex = i;
      bestT = t;
      bestX = px;
      bestY = py;
      bestZ = pz;
      bestDistanceSq = d2;
    }
  }

  const distance = Math.sqrt(bestDistanceSq);
  if (!best || distance > horizontalRange) return null;

  _nearest.segmentIndex = bestIndex;
  _nearest.segmentT = bestT;
  _nearest.openStart = true;
  _nearest.openEnd = true;
  _nearest.x = bestX;
  _nearest.y = bestY;
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
