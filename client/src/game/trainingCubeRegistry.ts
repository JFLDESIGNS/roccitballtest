import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';

export type TrainingCubeTarget = {
  id: string;
  body: RapierRigidBody;
  radius: number;
};

const cubes = new Map<string, TrainingCubeTarget>();
const _pos = new THREE.Vector3();
const _seg = new THREE.Vector3();
const _hitPoint = new THREE.Vector3();
const _normal = new THREE.Vector3();

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

export function rocketSegmentHitsTrainingCube(
  from: THREE.Vector3,
  to: THREE.Vector3,
  pad = 0.65,
): {
  target: TrainingCubeTarget;
  point: THREE.Vector3;
  normal: THREE.Vector3;
} | null {
  _seg.copy(to).sub(from);
  const lenSq = _seg.lengthSq();
  if (lenSq <= 1e-8) return null;

  let best: TrainingCubeTarget | null = null;
  let bestT = 1;
  let bestPoint: THREE.Vector3 | null = null;
  let bestNormal: THREE.Vector3 | null = null;

  for (const target of cubes.values()) {
    const t = target.body.translation();
    _pos.set(t.x, t.y, t.z);
    const along = THREE.MathUtils.clamp(
      _pos.clone().sub(from).dot(_seg) / lenSq,
      0,
      1,
    );
    _hitPoint.copy(from).addScaledVector(_seg, along);
    const dist = _hitPoint.distanceTo(_pos);
    if (dist > target.radius + pad || along > bestT) continue;

    best = target;
    bestT = along;
    bestPoint = _hitPoint.clone();
    _normal.copy(_pos).sub(_hitPoint);
    if (_normal.lengthSq() < 1e-8) _normal.copy(_seg).multiplyScalar(-1);
    _normal.normalize();
    bestNormal = _normal.clone();
  }

  return best && bestPoint && bestNormal
    ? { target: best, point: bestPoint, normal: bestNormal }
    : null;
}

export function hitTrainingCubeWithRocket(
  target: TrainingCubeTarget,
  rocketVelocity: THREE.Vector3,
  impactNormal: THREE.Vector3,
): void {
  const speed = rocketVelocity.length();
  const dir =
    speed > 1e-4
      ? rocketVelocity.clone().multiplyScalar(1 / speed)
      : impactNormal.clone().multiplyScalar(-1);
  const lv = target.body.linvel();
  target.body.wakeUp();
  target.body.setLinvel(
    {
      x: lv.x + dir.x * Math.max(13, speed * 0.34),
      y: lv.y + Math.max(4, dir.y * speed * 0.2 + 5),
      z: lv.z + dir.z * Math.max(13, speed * 0.34),
    },
    true,
  );
  target.body.setAngvel(
    {
      x: (Math.random() - 0.5) * 12,
      y: (Math.random() - 0.5) * 16,
      z: (Math.random() - 0.5) * 12,
    },
    true,
  );
}
