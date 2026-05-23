import * as THREE from 'three';
import { ARENA, CAMERA } from '../shared/Constants';

const _lookDir = new THREE.Vector3();
const _behind = new THREE.Vector3();
const _side = new THREE.Vector3();
const _lift = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _fromPivot = new THREE.Vector3();

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

  _fromPivot.subVectors(_desired, pivot);
  const pivotDist = _fromPivot.length();
  if (pivotDist < CAMERA.minDistanceFromPivot) {
    if (pivotDist > 1e-4) {
      _fromPivot.multiplyScalar(CAMERA.minDistanceFromPivot / pivotDist);
    } else {
      _fromPivot.copy(_behind).setLength(CAMERA.minDistanceFromPivot);
    }
    _desired.copy(pivot).add(_fromPivot);
  }

  clampCameraFloor(_desired, pivot.y);

  if (snap) {
    camera.position.copy(_desired);
  } else {
    const smooth = 1 - Math.exp(-CAMERA.smooth * dt);
    camera.position.lerp(_desired, smooth);
  }

  clampCameraFloor(camera.position, pivot.y);

  _lookTarget.copy(pivot).addScaledVector(_lookDir, CAMERA.lookAhead);

  const valid =
    Number.isFinite(camera.position.x) &&
    Number.isFinite(_lookTarget.x) &&
    Number.isFinite(_desired.x);

  if (!valid) {
    camera.position.set(pivot.x - 6, pivot.y + 4, pivot.z + 10);
    _lookTarget.set(pivot.x, pivot.y + 1.2, pivot.z);
  }

  camera.lookAt(_lookTarget);
  camera.updateMatrixWorld();
}
