import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _vertex = new THREE.Vector3();

/**
 * Clone mesh geometry with each vertex in world space (after `fitNewPlatformModel`).
 * Must use localToWorld — baking with matrixWorld × root⁻¹ fails when the mesh is a
 * direct child of the scaled root (vertices stay in unscaled FBX units).
 */
function geometryInPlatformSpace(
  mesh: THREE.Mesh,
  root: THREE.Object3D,
): THREE.BufferGeometry | null {
  if (!mesh.geometry) return null;
  root.updateMatrixWorld(true);

  const geo = mesh.geometry.clone();
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    _vertex.fromBufferAttribute(pos, i);
    mesh.localToWorld(_vertex);
    pos.setXYZ(i, _vertex.x, _vertex.y, _vertex.z);
  }
  return geo;
}

export function extractPlatformTrimesh(root: THREE.Object3D): {
  vertices: Float32Array;
  indices: Uint32Array;
} {
  const parts: THREE.BufferGeometry[] = [];

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = geometryInPlatformSpace(mesh, root);
    if (!geo) return;
    parts.push(geo);
  });

  if (parts.length === 0) {
    return { vertices: new Float32Array(0), indices: new Uint32Array(0) };
  }

  const merged = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  if (!merged) {
    return { vertices: new Float32Array(0), indices: new Uint32Array(0) };
  }

  const pos = merged.getAttribute('position') as THREE.BufferAttribute;
  const vertices = new Float32Array(pos.count * 3);
  vertices.set(pos.array as Float32Array);

  const indices = triangleIndicesFromGeometry(merged);

  merged.dispose();
  return { vertices, indices };
}

/** Rapier needs triangle indices; non-indexed FBX uses sequential verts (tri list). */
function triangleIndicesFromGeometry(geometry: THREE.BufferGeometry): Uint32Array {
  const indexAttr = geometry.getIndex();
  if (indexAttr) {
    return new Uint32Array(indexAttr.array);
  }
  const vertCount = geometry.getAttribute('position').count;
  const indices = new Uint32Array(vertCount);
  for (let i = 0; i < vertCount; i++) {
    indices[i] = i;
  }
  return indices;
}
