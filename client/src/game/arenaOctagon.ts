import * as THREE from 'three';

/** Flat-top octagon in XZ (Vector2.x → X, Vector2.y → Z) */
export function octagonVertices(radius: number): THREE.Vector2[] {
  const verts: THREE.Vector2[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i - Math.PI / 8;
    verts.push(new THREE.Vector2(radius * Math.cos(angle), radius * Math.sin(angle)));
  }
  return verts;
}

export function createOctagonShape(radius: number): THREE.Shape {
  const verts = octagonVertices(radius);
  const shape = new THREE.Shape();
  shape.moveTo(verts[0].x, verts[0].y);
  for (let i = 1; i < verts.length; i++) shape.lineTo(verts[i].x, verts[i].y);
  shape.closePath();
  return shape;
}

export type OctagonPlatformBuffers = {
  geometry: THREE.BufferGeometry;
  vertices: Float32Array;
  indices: Uint32Array;
};

/** Raised octagon cap + 8 outward sloped sides down to the arena floor */
export function buildOctagonPlatformBuffers(
  topRadius: number,
  slopeRadius: number,
  topY: number,
  bottomY: number,
): OctagonPlatformBuffers {
  const top = octagonVertices(topRadius);
  const bottom = octagonVertices(slopeRadius);
  const positions: number[] = [];
  const indices: number[] = [];

  const addVertex = (x: number, y: number, z: number) => {
    positions.push(x, y, z);
    return positions.length / 3 - 1;
  };

  const centerTop = addVertex(0, topY, 0);
  const topIdx: number[] = [];
  for (let i = 0; i < 8; i++) {
    topIdx.push(addVertex(top[i].x, topY, top[i].y));
  }
  const bottomIdx: number[] = [];
  for (let i = 0; i < 8; i++) {
    bottomIdx.push(addVertex(bottom[i].x, bottomY, bottom[i].y));
  }

  for (let i = 0; i < 8; i++) {
    const next = (i + 1) % 8;
    // Top deck — normal +Y (CCW when viewed from above)
    indices.push(centerTop, topIdx[next], topIdx[i]);
    // Ramp panels — normals face outward from arena center
    indices.push(topIdx[i], topIdx[next], bottomIdx[next]);
    indices.push(topIdx[i], bottomIdx[next], bottomIdx[i]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  // Per-face normals so ramp panels read as flat facets (not smoothed ramps)
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

  return {
    geometry,
    vertices: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
}
