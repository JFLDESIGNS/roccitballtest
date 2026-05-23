import type { RigidBody, World } from '@dimforge/rapier3d-compat';
import { Ray } from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { ARENA, CAMERA } from '../shared/Constants';

const _lookDir = new THREE.Vector3();
const _behind = new THREE.Vector3();
const _side = new THREE.Vector3();
const _lift = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _rayDir = new THREE.Vector3();
const _probeOrigin = { x: 0, y: 0, z: 0 };
const _rayVec = { x: 0, y: 0, z: 0 };

function setLookDirection(yaw: number, aimPitch: number, out: THREE.Vector3) {
  out.set(
    -Math.sin(yaw) * Math.cos(aimPitch),
    Math.sin(aimPitch),
    -Math.cos(yaw) * Math.cos(aimPitch),
  );
  return out.normalize();
}

/** Full 3D aim — used for rockets, beam, throw (crosshair-aligned) */
export function getLookDirection(yaw: number, aimPitch: number): THREE.Vector3 {
  return setLookDirection(yaw, aimPitch, new THREE.Vector3());
}

export function writeLookDirection(
  yaw: number,
  aimPitch: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  return setLookDirection(yaw, aimPitch, out);
}

/** Movement on XZ from camera yaw */
export function getCameraBasis(yaw: number) {
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
  const right = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw)).normalize();
  return { forward, right };
}

function clampCameraFloor(pos: THREE.Vector3, pivotY: number) {
  const minY = Math.max(
    ARENA.floorY + CAMERA.groundClearance,
    pivotY - CAMERA.maxDropBelowPivot,
  );
  if (pos.y < minY) pos.y = minY;
}

/** Ray from pivot toward camera; probe ground under camera column */
function constrainCameraPosition(
  world: World,
  pivot: THREE.Vector3,
  pos: THREE.Vector3,
  excludeRigidBody?: RigidBody | null,
) {
  _rayDir.subVectors(pos, pivot);
  const dist = _rayDir.length();
  if (dist > 0.05) {
    _rayDir.multiplyScalar(1 / dist);
    _probeOrigin.x = pivot.x;
    _probeOrigin.y = pivot.y;
    _probeOrigin.z = pivot.z;
    _rayVec.x = _rayDir.x;
    _rayVec.y = _rayDir.y;
    _rayVec.z = _rayDir.z;

    const hit = world.castRay(
      new Ray(_probeOrigin, _rayVec),
      dist,
      true,
      undefined,
      undefined,
      undefined,
      excludeRigidBody ?? undefined,
    );

    if (hit) {
      const safe = Math.max(0.2, hit.timeOfImpact - CAMERA.collisionPadding);
      pos.copy(pivot).addScaledVector(_rayDir, safe);
    }
  }

  const probeY = Math.max(pivot.y, pos.y) + 6;
  _probeOrigin.x = pos.x;
  _probeOrigin.y = probeY;
  _probeOrigin.z = pos.z;
  _rayVec.x = 0;
  _rayVec.y = -1;
  _rayVec.z = 0;

  const groundHit = world.castRay(
    new Ray(_probeOrigin, _rayVec),
    probeY - ARENA.floorY + 2,
    true,
    undefined,
    undefined,
    undefined,
    excludeRigidBody ?? undefined,
  );

  if (groundHit) {
    const groundY = probeY - groundHit.timeOfImpact;
    const minY = groundY + CAMERA.groundClearance;
    if (pos.y < minY) pos.y = minY;
  }

  clampCameraFloor(pos, pivot.y);
}

/**
 * Third-person camera sits behind the aim ray so crosshair, camera, and shots align.
 */
export function updateThirdPersonCamera(
  camera: THREE.Camera,
  pivot: THREE.Vector3,
  yaw: number,
  aimPitch: number,
  dt: number,
  snap = false,
  world?: World | null,
  excludeRigidBody?: RigidBody | null,
) {
  setLookDirection(yaw, aimPitch, _lookDir);

  _behind.copy(_lookDir).multiplyScalar(-CAMERA.distance);
  _behind.y *= CAMERA.verticalInfluence;

  _side.crossVectors(_worldUp, _lookDir);
  if (_side.lengthSq() < 1e-5) {
    _side.copy(getCameraBasis(yaw).right);
  } else {
    _side.normalize();
  }
  _side.multiplyScalar(CAMERA.shoulderOffset);

  _lift.copy(_worldUp).multiplyScalar(CAMERA.height);

  _desired.copy(pivot).add(_behind).add(_lift).add(_side);

  if (world) {
    constrainCameraPosition(world, pivot, _desired, excludeRigidBody);
  } else {
    clampCameraFloor(_desired, pivot.y);
  }

  if (snap) {
    camera.position.copy(_desired);
  } else {
    const smooth = 1 - Math.exp(-CAMERA.smooth * dt);
    camera.position.lerp(_desired, smooth);
  }

  if (world) {
    constrainCameraPosition(world, pivot, camera.position, excludeRigidBody);
  } else {
    clampCameraFloor(camera.position, pivot.y);
  }

  _lookTarget.copy(pivot).addScaledVector(_lookDir, CAMERA.lookAhead);
  camera.lookAt(_lookTarget);
}
