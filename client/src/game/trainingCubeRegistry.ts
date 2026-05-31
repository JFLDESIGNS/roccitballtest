import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';

export type TrainingCubeTarget = {
  id: string;
  body: RapierRigidBody;
  radius: number;
};

const cubes = new Map<string, TrainingCubeTarget>();
const _pos = new THREE.Vector3();

export function registerTrainingCube(
  id: string,
  body: RapierRigidBody,
  radius: number,
): () => void {
  cubes.set(id, { id, body, radius });
  return () => {
    if (cubes.get(id)?.body === body) cubes.delete(id);
  };
}

export function getTrainingCubes(): TrainingCubeTarget[] {
  return Array.from(cubes.values());
}

export function getNearestTrainingCube(
  origin: THREE.Vector3,
  maxDistance: number,
  excluded?: RapierRigidBody | null,
): { target: TrainingCubeTarget; distance: number; position: THREE.Vector3 } | null {
  let best: TrainingCubeTarget | null = null;
  let bestDist = maxDistance;
  const bestPos = new THREE.Vector3();

  for (const target of cubes.values()) {
    if (target.body === excluded) continue;
    const t = target.body.translation();
    _pos.set(t.x, t.y, t.z);
    const d = _pos.distanceTo(origin);
    if (d < bestDist) {
      best = target;
      bestDist = d;
      bestPos.copy(_pos);
    }
  }

  return best ? { target: best, distance: bestDist, position: bestPos } : null;
}
