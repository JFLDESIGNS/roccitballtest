import type * as THREE from 'three';

const targets: THREE.Object3D[] = [];

/** Pick meshes for fly-mode light selection raycasts */
export const stadiumLightPickRegistry = {
  register(obj: THREE.Object3D) {
    if (!targets.includes(obj)) targets.push(obj);
  },
  unregister(obj: THREE.Object3D) {
    const i = targets.indexOf(obj);
    if (i >= 0) targets.splice(i, 1);
  },
  getTargets(): readonly THREE.Object3D[] {
    return targets;
  },
};
