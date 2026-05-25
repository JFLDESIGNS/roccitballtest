import * as THREE from 'three';
import { ARENA } from '../shared/Constants';
import { arenaPillarTopWorldY } from './arenaPillarConfig';

/** World Y of ceiling rail — below roof slab, inside the bowl */
export function stadiumKeyLightMountY(): number {
  const pillarTop = arenaPillarTopWorldY();
  return pillarTop - 8.5;
}

/** Down-facing rect panel size (meters) — wide wash over the court */
export const STADIUM_KEY_LIGHT_PANEL = {
  width: 40,
  height: 40,
} as const;

/** Interior ceiling mounts — inside hex walls (hexRadius ≈ 64) */
export const STADIUM_KEY_LIGHT_2 = {
  position: new THREE.Vector3(-26, 0, 24),
} as const;

export const STADIUM_KEY_LIGHT_3 = {
  position: new THREE.Vector3(26, 0, -24),
} as const;

export function stadiumKeyLightWorldPosition(
  spec: typeof STADIUM_KEY_LIGHT_2,
): THREE.Vector3 {
  return new THREE.Vector3(
    spec.position.x,
    stadiumKeyLightMountY(),
    spec.position.z,
  );
}

/** Ground reference for wireframe omni radius ring */
export function stadiumKeyLightGroundY(): number {
  return ARENA.platformTopHeight + 0.5;
}

/** Approx omni reach shown in wireframe (m) */
export const STADIUM_KEY_LIGHT_OMNI_RADIUS = 52;
