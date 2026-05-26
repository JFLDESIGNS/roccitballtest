import * as THREE from 'three';
import {
  mapLightGlowEffectiveHorizontalDistM,
  mapLightGlowFadeRadiusM,
  MAP_LIGHT_GLOW_PROXIMITY_FADE_FT,
  mapLightGlowProximityFactor,
} from './mapLightGlowBlend';

/** Player position for map light glow proximity (updated during play). */
const anchor = new THREE.Vector3();
let anchorActive = false;

export function setLightGlowProximityAnchor(pos: THREE.Vector3): void {
  anchor.copy(pos);
  anchorActive = true;
}

export function clearLightGlowProximityAnchor(): void {
  anchorActive = false;
}

export function isLightGlowProximityAnchorActive(): boolean {
  return anchorActive;
}

/** Effective edge distance (m) — min of player vs camera listeners. */
export function mapLightGlowListenerEffectiveDistanceM(
  glowWorld: THREE.Vector3,
  glowDiameterM: number,
  cameraPosition: THREE.Vector3,
): number {
  const cx = glowWorld.x;
  const cz = glowWorld.z;
  const cam = mapLightGlowEffectiveHorizontalDistM(
    cx,
    cz,
    cameraPosition.x,
    cameraPosition.z,
    glowDiameterM,
  );
  if (!anchorActive) return cam;
  const player = mapLightGlowEffectiveHorizontalDistM(
    cx,
    cz,
    anchor.x,
    anchor.z,
    glowDiameterM,
  );
  return Math.min(cam, player);
}

export function mapLightGlowProximityOpacity(
  glowWorld: THREE.Vector3,
  glowDiameterM: number,
  cameraPosition: THREE.Vector3,
  peakOpacity: number,
  fadeFt: number = MAP_LIGHT_GLOW_PROXIMITY_FADE_FT,
): { effectiveDistM: number; factor: number; opacity: number } {
  const effectiveDistM = mapLightGlowListenerEffectiveDistanceM(
    glowWorld,
    glowDiameterM,
    cameraPosition,
  );
  const fadeM = mapLightGlowFadeRadiusM(fadeFt);
  const factor = mapLightGlowProximityFactor(effectiveDistM, fadeM);
  return {
    effectiveDistM,
    factor,
    opacity: peakOpacity * factor,
  };
}
