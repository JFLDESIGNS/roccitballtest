import * as THREE from 'three';
import { CAMERA } from '../shared/Constants';
import { tuningStore } from './tuningStore';

const _lookDir = new THREE.Vector3();
const _behind = new THREE.Vector3();
const _side = new THREE.Vector3();
const _lift = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _actualLookTarget = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _toRef = new THREE.Vector3();

function setLookDirection(yaw: number, aimPitch: number, out: THREE.Vector3) {
  out.set(
    -Math.sin(yaw) * Math.cos(aimPitch),
    Math.sin(aimPitch),
    -Math.cos(yaw) * Math.cos(aimPitch),
  );
  return out.normalize();
}

/** Full 3D aim, used for rockets, beam, throw, and crosshair-aligned actions. */
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

/** Movement on XZ from camera yaw. */
export function getCameraBasis(yaw: number) {
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
  const right = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw)).normalize();
  return { forward, right };
}

/**
 * World point on the crosshair aim ray near `depthRef` (for example, chest).
 * Keeps rocket spawn on the same line as the HUD reticle.
 */
export function pointOnCrosshairAimRay(
  cameraPos: THREE.Vector3,
  aimDir: THREE.Vector3,
  depthRef: THREE.Vector3,
  extraAlong: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  _toRef.subVectors(depthRef, cameraPos);
  const along = Math.max(0.8, _toRef.dot(aimDir));
  return out.copy(cameraPos).addScaledVector(aimDir, along + extraAlong);
}

/**
 * Simple third-person camera.
 *
 * Yaw/pitch drive the view directly every frame, so fast mouse reversals do not
 * fight a delayed look target. Only the camera position eases behind the player.
 */
export function updateThirdPersonCamera(
  camera: THREE.Camera,
  pivot: THREE.Vector3,
  yaw: number,
  aimPitch: number,
  dt: number,
  snap = false,
  extraDistance = 0,
) {
  const { cameraSmoothingEnabled } = tuningStore.getState();

  setLookDirection(yaw, aimPitch, _lookDir);

  const distance = CAMERA.distance + extraDistance;
  _lift.copy(_worldUp).multiplyScalar(CAMERA.height);
  _behind.copy(_lookDir).multiplyScalar(-distance);

  _side.crossVectors(_worldUp, _lookDir);
  if (_side.lengthSq() < 1e-5) {
    _side.copy(getCameraBasis(yaw).right);
  } else {
    _side.normalize();
  }
  _side.multiplyScalar(CAMERA.shoulderOffset);

  _desired.copy(pivot).add(_behind).add(_lift).add(_side);
  _desired.y = Math.max(
    _desired.y,
    pivot.y - CAMERA.maxDropBelowPivot,
  );

  if (snap || !cameraSmoothingEnabled || dt <= 0) {
    camera.position.copy(_desired);
  } else {
    const smooth = 1 - Math.exp(-CAMERA.smooth * dt);
    camera.position.lerp(_desired, smooth);
  }

  const valid =
    Number.isFinite(camera.position.x) &&
    Number.isFinite(camera.position.y) &&
    Number.isFinite(camera.position.z) &&
    Number.isFinite(_lookDir.x) &&
    Number.isFinite(_lookDir.y) &&
    Number.isFinite(_lookDir.z);

  if (!valid) {
    camera.position.set(pivot.x - 6, pivot.y + CAMERA.height, pivot.z + 10);
    setLookDirection(yaw, aimPitch, _lookDir);
  }

  _actualLookTarget.copy(camera.position).add(_lookDir);
  camera.lookAt(_actualLookTarget);
  camera.updateMatrixWorld();
}
