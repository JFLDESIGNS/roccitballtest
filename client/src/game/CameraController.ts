import * as THREE from 'three';
import { ARENA, CAMERA } from '../shared/Constants';
import { isInsideHex } from './arenaHex';
import { tuningStore } from './tuningStore';

const _lookDir = new THREE.Vector3();
const _orbitDir = new THREE.Vector3();
const _behind = new THREE.Vector3();
const _side = new THREE.Vector3();
const _lift = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _fromPivot = new THREE.Vector3();
const _toRef = new THREE.Vector3();
const _wallTest = new THREE.Vector3();

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

function clampCameraArenaWalls(pos: THREE.Vector3, pivot: THREE.Vector3) {
  if (pos.y > ARENA.wallHeight + 1.5) return;

  const radius = ARENA.hexRadius - ARENA.wallThickness - CAMERA.collisionPadding;
  if (isInsideHex(pos.x, pos.z, radius)) return;
  if (!isInsideHex(pivot.x, pivot.z, radius)) {
    pos.copy(pivot);
    return;
  }

  let insideT = 0;
  let outsideT = 1;
  for (let i = 0; i < 14; i += 1) {
    const t = (insideT + outsideT) * 0.5;
    _wallTest.lerpVectors(pivot, pos, t);
    if (isInsideHex(_wallTest.x, _wallTest.z, radius)) {
      insideT = t;
    } else {
      outsideT = t;
    }
  }
  pos.lerpVectors(pivot, pos, Math.max(0, insideT - 0.015));
}

/**
 * World point on the crosshair aim ray (camera → lookDir) near `depthRef` (e.g. chest).
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
 * Third-person camera — forward matches lookDir so the HUD center reticle is true aim.
 */
export function updateThirdPersonCamera(
  camera: THREE.Camera,
  pivot: THREE.Vector3,
  yaw: number,
  aimPitch: number,
  dt: number,
  snap = false,
  extraDistance = 0,
  fastFollow = false,
  lookYaw = yaw,
  lookPitch = aimPitch,
) {
  const {
    cameraSmoothingEnabled,
    cameraCollisionProbeEnabled,
  } = tuningStore.getState();

  setLookDirection(lookYaw, lookPitch, _lookDir);
  setLookDirection(yaw, aimPitch, _orbitDir);

  _behind.copy(_orbitDir).multiplyScalar(-(CAMERA.distance + extraDistance));
  _behind.y *= CAMERA.verticalInfluence;

  _side.crossVectors(_worldUp, _orbitDir);
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
  if (cameraCollisionProbeEnabled) {
    clampCameraArenaWalls(_desired, pivot);
  }

  if (snap || !cameraSmoothingEnabled) {
    camera.position.copy(_desired);
  } else {
    const smoothRate = fastFollow ? CAMERA.fastTurnSmooth : CAMERA.smooth;
    const smooth = 1 - Math.exp(-smoothRate * dt);
    camera.position.lerp(_desired, smooth);
  }

  clampCameraFloor(camera.position, pivot.y);
  if (cameraCollisionProbeEnabled) {
    clampCameraArenaWalls(camera.position, pivot);
  }

  _lookTarget.copy(camera.position).addScaledVector(_lookDir, CAMERA.lookAhead);

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
