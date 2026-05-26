import * as THREE from 'three';

/** Player feet/chest position for map light glow proximity (updated during play). */
const anchor = new THREE.Vector3();
let anchorActive = false;

export function setLightGlowProximityAnchor(pos: THREE.Vector3): void {
  anchor.copy(pos);
  anchorActive = true;
}

export function clearLightGlowProximityAnchor(): void {
  anchorActive = false;
}

/** Nearest listener for glow fade — player when in a match, else camera. */
export function copyLightGlowProximityListener(
  out: THREE.Vector3,
  camera: THREE.Vector3,
): THREE.Vector3 {
  if (anchorActive) return out.copy(anchor);
  return out.copy(camera);
}
