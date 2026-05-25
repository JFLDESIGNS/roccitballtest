import * as THREE from 'three';

/** −15% saturation and brightness vs raw hex */
const SATURATION_MULT = 0.85;
const LIGHTNESS_MULT = 0.85;

/** Darken and slightly desaturate turf / blade colors */
export function turfGrassColor(hex: string): THREE.Color {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const h = hsl.h < 0.02 ? 0.22 : hsl.h;
  c.setHSL(h, hsl.s * SATURATION_MULT, hsl.l * LIGHTNESS_MULT);
  return c;
}
