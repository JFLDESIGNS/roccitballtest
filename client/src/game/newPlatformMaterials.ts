import * as THREE from 'three';

export type NewPlatformMaps = {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  metalnessMap: THREE.Texture;
  roughnessMap: THREE.Texture;
};

export function configureNewPlatformTextures(tex: NewPlatformMaps): NewPlatformMaps {
  tex.map.colorSpace = THREE.SRGBColorSpace;
  tex.map.anisotropy = 8;
  for (const key of ['normalMap', 'metalnessMap', 'roughnessMap'] as const) {
    tex[key].colorSpace = THREE.NoColorSpace;
    tex[key].anisotropy = 8;
  }
  return tex;
}

function ensureUv2(geometry: THREE.BufferGeometry): void {
  if (geometry.attributes.uv2) return;
  const uv = geometry.attributes.uv;
  if (uv) geometry.setAttribute('uv2', uv);
}

export function applyNewPlatformMapsToMesh(
  mesh: THREE.Mesh,
  maps: NewPlatformMaps,
): void {
  const old = mesh.material;
  if (Array.isArray(old)) old.forEach((m) => m.dispose());
  else if (old) old.dispose();

  if (mesh.geometry) ensureUv2(mesh.geometry);

  mesh.material = new THREE.MeshStandardMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    metalnessMap: maps.metalnessMap,
    roughnessMap: maps.roughnessMap,
    metalness: 1,
    roughness: 1,
    color: 0xffffff,
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
}

const _sample = new THREE.Vector3();

/**
 * Scale + ground the FBX to match legacy procedural octagon outer radius (`slopeR`).
 * Tightens to max horizontal reach = outerRadius (bbox alone overshoots on this mesh).
 */
export function fitNewPlatformModel(
  root: THREE.Object3D,
  outerRadius: number,
  floorY = 0,
): void {
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.scale.setScalar(1);

  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const horiz = Math.max(size.x, size.z, 0.001);
  root.scale.setScalar((outerRadius * 2) / horiz);

  root.updateMatrixWorld(true);
  let maxHoriz = 0;
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      _sample.fromBufferAttribute(pos, i);
      mesh.localToWorld(_sample);
      maxHoriz = Math.max(maxHoriz, Math.hypot(_sample.x, _sample.z));
    }
  });
  if (maxHoriz > 1e-5) {
    root.scale.multiplyScalar(outerRadius / maxHoriz);
  }

  box.setFromObject(root);
  const center = new THREE.Vector3();
  box.getCenter(center);
  root.position.set(-center.x, floorY - box.min.y, -center.z);
}
