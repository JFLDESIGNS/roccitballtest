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

/**
 * Rocket exhaust — keep strong when the trail is close to the camera (chase / behind-player view).
 * Unlike trailCameraFade, which fades out near the lens.
 */
export function rocketTrailCamFade(
  worldPos: THREE.Vector3,
  camPos: THREE.Vector3,
): number {
  const d = worldPos.distanceTo(camPos);
  const near = THREE.MathUtils.smoothstep(d, 6, 28);
  const far = 1 - THREE.MathUtils.smoothstep(d, 55, 95);
  return THREE.MathUtils.clamp(0.88 + near * 0.12, 0.82, 1) * THREE.MathUtils.lerp(1, 0.88, far);
}
