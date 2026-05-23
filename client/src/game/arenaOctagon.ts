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
  geometry.computeVertexNormals();

  return {
    geometry,
    vertices: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
}
