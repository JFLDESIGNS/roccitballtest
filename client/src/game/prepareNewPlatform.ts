import * as THREE from 'three';
import type { NewPlatformMaps } from './newPlatformMaterials';
import {
  applyNewPlatformMapsToMesh,
  fitNewPlatformModel,
} from './newPlatformMaterials';
export type PreparedNewPlatform = {
  visual: THREE.Object3D;
};

export function prepareNewPlatform(
  fbx: THREE.Group,
  maps: NewPlatformMaps,
  outerRadius: number,
  floorY: number,
): PreparedNewPlatform {
  const visual = fbx.clone(true) as THREE.Group;
  visual.traverse((child: THREE.Object3D) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    applyNewPlatformMapsToMesh(mesh, maps);
  });
  fitNewPlatformModel(visual, outerRadius, floorY);

  return { visual };
}
