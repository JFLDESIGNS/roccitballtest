import * as THREE from 'three';

/** Fully faded within this distance of the camera (m) */
const NEAR_M = 4;
/** Full strength beyond this distance (m) */
const FAR_M = 17;

/** 0 near camera → 1 far from camera (smooth linear ramp) */
export function trailCameraFade(
  worldPos: THREE.Vector3,
  camPos: THREE.Vector3,
): number {
  const d = worldPos.distanceTo(camPos);
  return THREE.MathUtils.smoothstep(d, NEAR_M, FAR_M);
}
