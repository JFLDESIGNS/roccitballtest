import * as THREE from 'three';
import { ARENA } from '../shared/Constants';

/** Hex corners where perimeter walls meet (Vector2.y is world Z) */
export function hexCornerPositions(radius: number): { x: number; z: number }[] {
  return hexVertices(radius).map((v) => ({ x: v.x, z: v.y }));
}

/** Top/bottom corners on the field midline (between the two goal walls) */
export function isMidMapWallCorner(x: number, epsilon = 0.5): boolean {
  return Math.abs(x) <= epsilon;
}

/** Flat-top hexagon vertices in XZ plane (Vector2 x → world X, y → world Z) */
export function hexVertices(radius: number): THREE.Vector2[] {
  const verts: THREE.Vector2[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    verts.push(new THREE.Vector2(radius * Math.cos(angle), radius * Math.sin(angle)));
  }
  return verts;
}

/** Point-in-polygon test for flat-top hex in XZ (verts from hexVertices). */
export function isPointInHex(x: number, z: number, verts: THREE.Vector2[]): boolean {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const xi = verts[i].x;
    const zi = verts[i].y;
    const xj = verts[j].x;
    const zj = verts[j].y;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function createHexShape(radius: number): THREE.Shape {
  const verts = hexVertices(radius);
  const shape = new THREE.Shape();
  shape.moveTo(verts[0].x, verts[0].y);
  for (let i = 1; i < verts.length; i++) {
    shape.lineTo(verts[i].x, verts[i].y);
  }
  shape.closePath();
  return shape;
}

export type HexWallSegment = {
  x: number;
  z: number;
  y: number;
  yaw: number;
  length: number;
  /** Hex edge index 0–5 (vertex i → vertex i+1) */
  edgeIndex: number;
};

/** Goal end faces use edges 0 and 3 (see goals.ts / arenaPadLayout). */
export function isGoalHexEdge(edgeIndex: number): boolean {
  return edgeIndex === 0 || edgeIndex === 3;
}

/** Six perimeter walls — flush along hex edges, facing outward */
export function buildHexWallSegments(
  radius: number,
  wallThickness: number,
): HexWallSegment[] {
  const verts = hexVertices(radius);
  const segments: HexWallSegment[] = [];
  const h = ARENA.wallHeight / 2;

  for (let i = 0; i < 6; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % 6];
    const dx = b.x - a.x;
    const dz = b.y - a.y;
    const length = Math.hypot(dx, dz);
    const dirX = dx / length;
    const dirZ = dz / length;

    const midX = (a.x + b.x) / 2;
    const midZ = (a.y + b.y) / 2;

    let nx = dirZ;
    let nz = -dirX;
    if (midX * nx + midZ * nz < 0) {
      nx = -nx;
      nz = -nz;
    }

    const offset = wallThickness / 2 + 0.05;
    segments.push({
      x: midX + nx * offset,
      z: midZ + nz * offset,
      y: h,
      length,
      yaw: Math.atan2(-dirZ, dirX),
      edgeIndex: i,
    });
  }

  return segments;
}

/** Point inside flat-top hex (x, z) */
export function isInsideHex(x: number, z: number, radius: number): boolean {
  const ax = Math.abs(x);
  const az = Math.abs(z);
  const r = radius;
  if (az > r) return false;
  if (ax > (r * Math.sqrt(3)) / 2) return false;
  return ax * (Math.sqrt(3) / 3) + az <= r;
}

const SQRT3_3 = Math.sqrt(3) / 3;

/** Distance from (x, z) to the nearest hex edge (0 = at wall, larger = more interior). */
export function hexSlackToBoundary(
  x: number,
  z: number,
  radius: number,
): number {
  const ax = Math.abs(x);
  const az = Math.abs(z);
  const dZ = radius - az;
  const dX = (radius * Math.sqrt(3)) / 2 - ax;
  const dDiag = radius - (ax * SQRT3_3 + az);
  return Math.min(dZ, dX, dDiag);
}

/** Outward normal of the nearest hex edge at (x, z) — for rocket wall bounce */
export function hexBoundaryNormal(
  x: number,
  z: number,
  radius: number,
): THREE.Vector2 {
  const ax = Math.abs(x);
  const az = Math.abs(z);
  const sx = Math.sign(x) || 1;
  const sz = Math.sign(z) || 1;

  const dZ = radius - az;
  const dX = (radius * Math.sqrt(3)) / 2 - ax;
  const dDiag = radius - (ax * SQRT3_3 + az);
  const min = Math.min(dZ, dX, dDiag);

  if (min === dDiag) {
    const nx = SQRT3_3 * sx;
    const nz = sz;
    const len = Math.hypot(nx, nz) || 1;
    return new THREE.Vector2(nx / len, nz / len);
  }
  if (min === dX) return new THREE.Vector2(sx, 0);
  return new THREE.Vector2(0, sz);
}

/** Clamp position to stay inside hex with margin */
export function clampToHex(
  x: number,
  z: number,
  radius: number,
  margin = 1.5,
): { x: number; z: number } {
  const r = radius - margin;
  if (isInsideHex(x, z, r)) return { x, z };
  const dir = new THREE.Vector2(x, z);
  if (dir.lengthSq() < 0.001) return { x: 0, z: 0 };
  dir.normalize().multiplyScalar(r * 0.98);
  return { x: dir.x, z: dir.y };
}

export const HEX_RADIUS = ARENA.hexRadius;
