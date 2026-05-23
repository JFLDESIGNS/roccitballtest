import * as THREE from 'three';

/** Flat faces on an octagon prism (vertex at top of each wall panel) */
export const DRUM_OCTAGON_PHASE = -Math.PI / 8;

/** Radial segment count — must match ARENA.ballDropDoorCount */
export function drumSliceAngle(segments: number): number {
  return (Math.PI * 2) / segments;
}

export function drumFaceAngles(
  index: number,
  segments: number,
  phase = DRUM_OCTAGON_PHASE,
): { a0: number; a1: number; mid: number } {
  const slice = drumSliceAngle(segments);
  const a0 = index * slice + phase;
  const a1 = a0 + slice;
  return { a0, a1, mid: a0 + slice * 0.5 };
}

export function drumFaceChord(radius: number, segments: number): number {
  const slice = drumSliceAngle(segments);
  return 2 * radius * Math.sin(slice * 0.5);
}

export type RadialDropSlice = {
  /** Chord midpoint on the drum rim (XZ) */
  mx: number;
  mz: number;
  /** World-space hinge axis (along rim chord) */
  chordAxis: THREE.Vector3;
  geometry: THREE.BufferGeometry;
};

/**
 * Flat pizza slice in the drum-bottom plane (Y=0 local).
 * Pivot at chord midpoint; tip at drum center; opens by rotating around chordAxis.
 */
export function buildRadialDropSlice(
  a0: number,
  a1: number,
  radius: number,
): RadialDropSlice {
  const ax = Math.cos(a0) * radius;
  const az = Math.sin(a0) * radius;
  const bx = Math.cos(a1) * radius;
  const bz = Math.sin(a1) * radius;
  const mx = (ax + bx) * 0.5;
  const mz = (az + bz) * 0.5;

  const positions = new Float32Array([
    ax - mx,
    0,
    az - mz,
    bx - mx,
    0,
    bz - mz,
    -mx,
    0,
    -mz,
  ]);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // −Y normal — visible from below (arena looking up at the drop)
  geometry.setIndex([0, 2, 1]);
  geometry.computeVertexNormals();

  const chordAxis = new THREE.Vector3(bx - ax, 0, bz - az).normalize();
  return { mx, mz, chordAxis, geometry };
}

/** Faceted drum walls (octagonal prism when segments = 8) */
export function buildFacetedDrumWallGeometry(
  radius: number,
  height: number,
  segments: number,
  phaseRad = DRUM_OCTAGON_PHASE,
): THREE.BufferGeometry {
  const halfH = height * 0.5;
  const slice = drumSliceAngle(segments);
  const positions: number[] = [];
  const indices: number[] = [];

  const addVertex = (a: number, y: number) => {
    positions.push(Math.cos(a) * radius, y, Math.sin(a) * radius);
    return positions.length / 3 - 1;
  };

  for (let i = 0; i < segments; i++) {
    const a0 = i * slice + phaseRad;
    const a1 = a0 + slice;
    const i0 = addVertex(a0, halfH);
    const i1 = addVertex(a1, halfH);
    const i2 = addVertex(a1, -halfH);
    const i3 = addVertex(a0, -halfH);
    indices.push(i0, i2, i1, i0, i3, i2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);

  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
  const normArray = new Float32Array(posAttr.count * 3);
  for (let f = 0; f < indices.length; f += 3) {
    const ia = indices[f];
    const ib = indices[f + 1];
    const ic = indices[f + 2];
    const ax = positions[ia * 3];
    const ay = positions[ia * 3 + 1];
    const az = positions[ia * 3 + 2];
    const bx = positions[ib * 3];
    const by = positions[ib * 3 + 1];
    const bz = positions[ib * 3 + 2];
    const cx = positions[ic * 3];
    const cy = positions[ic * 3 + 1];
    const cz = positions[ic * 3 + 2];
    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;
    const acx = cx - ax;
    const acy = cy - ay;
    const acz = cz - az;
    let nx = aby * acz - abz * acy;
    let ny = abz * acx - abx * acz;
    let nz = abx * acy - aby * acx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    for (const vi of [ia, ib, ic]) {
      normArray[vi * 3] = nx;
      normArray[vi * 3 + 1] = ny;
      normArray[vi * 3 + 2] = nz;
    }
  }
  geometry.setAttribute('normal', new THREE.BufferAttribute(normArray, 3));
  return geometry;
}

/** Rapier trimesh buffers from a BufferGeometry (local space) */
export function bufferGeometryToTrimesh(
  geometry: THREE.BufferGeometry,
): { vertices: Float32Array; indices: Uint32Array } {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  const vertices = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    vertices[i * 3] = pos.getX(i);
    vertices[i * 3 + 1] = pos.getY(i);
    vertices[i * 3 + 2] = pos.getZ(i);
  }
  const indexAttr = geometry.getIndex();
  const indices = indexAttr
    ? new Uint32Array(indexAttr.array)
    : Uint32Array.from({ length: pos.count }, (_, i) => i);
  return { vertices, indices };
}
