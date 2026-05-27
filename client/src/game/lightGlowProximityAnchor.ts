import * as THREE from 'three';
import {
  mapLightGlowEffectiveHorizontalDistM,
  mapLightGlowFadeRadiusM,
  mapLightGlowProximityFactor,
} from './mapLightGlowBlend';
import {
  MAP_LIGHT_GLOW_WOBBLE_RADIUS_FT,
  MAP_LIGHT_GLOW_WOBBLE_STRENGTH,
} from './mapLightGlowSettings';

const FT_TO_M = 0.3048;

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

/** Raw horizontal distance (m) from camera/player to the lamp center. */
export function mapLightGlowListenerHorizontalDistanceM(
  glowWorld: THREE.Vector3,
  cameraPosition: THREE.Vector3,
): number {
  const cam = Math.hypot(
    cameraPosition.x - glowWorld.x,
    cameraPosition.z - glowWorld.z,
  );
  if (!anchorActive) return cam;
  const player = Math.hypot(anchor.x - glowWorld.x, anchor.z - glowWorld.z);
  return Math.min(cam, player);
}

/** Effective edge distance (m): min of player vs camera listeners. */
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

/** 0 at wobble radius, 1 at lamp center — smoke shimmer ramps as you walk in. */
export function mapLightGlowWobbleStrength(
  glowWorld: THREE.Vector3,
  cameraPosition: THREE.Vector3,
): number {
  const closeDistM = mapLightGlowListenerHorizontalDistanceM(
    glowWorld,
    cameraPosition,
  );
  const wobbleRadiusM = MAP_LIGHT_GLOW_WOBBLE_RADIUS_FT * FT_TO_M;
  if (closeDistM >= wobbleRadiusM) return 0;
  const closeness = 1 - closeDistM / wobbleRadiusM;
  const eased = closeness * closeness * (3 - 2 * closeness);
  return eased * MAP_LIGHT_GLOW_WOBBLE_STRENGTH;
}

export function mapLightGlowProximityOpacity(
  glowWorld: THREE.Vector3,
  glowDiameterM: number,
  cameraPosition: THREE.Vector3,
  peakOpacity: number,
  fadeFt: number,
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
