import * as THREE from 'three';

export type MapLightGlowBlendMode = 'normal' | 'add' | 'screen' | 'lighten';

export const MAP_LIGHT_GLOW_BLEND_OPTIONS: {
  id: MapLightGlowBlendMode;
  label: string;
  hint: string;
}[] = [
  {
    id: 'normal',
    label: 'Normal (soft)',
    hint: 'Premultiplied alpha — gentle lift over the scene.',
  },
  {
    id: 'add',
    label: 'Additive',
    hint: 'Brighter halos; can blow out on overlapping glows.',
  },
  {
    id: 'screen',
    label: 'Screen',
    hint: 'Lightens like a projection; good for colored bulbs.',
  },
  {
    id: 'lighten',
    label: 'Lighten (max)',
    hint: 'Keeps the brighter of glow vs background per channel.',
  },
];

const MODES: MapLightGlowBlendMode[] = ['normal', 'add', 'screen', 'lighten'];

export function isMapLightGlowBlendMode(v: string): v is MapLightGlowBlendMode {
  return (MODES as string[]).includes(v);
}

/** Default peak opacity (40% lower than the previous 0.5 default). */
export const MAP_LIGHT_GLOW_DEFAULT_OPACITY = 0.3;

/** Full opacity at/ beyond this horizontal distance from the glow (feet). */
export const MAP_LIGHT_GLOW_PROXIMITY_FADE_FT = 20;
export const MAP_LIGHT_GLOW_PROXIMITY_FADE_M =
  MAP_LIGHT_GLOW_PROXIMITY_FADE_FT * 0.3048;

/**
 * 0 at the light, 1 at MAP_LIGHT_GLOW_PROXIMITY_FADE_FT or farther (camera distance).
 */
export function mapLightGlowProximityFactor(distM: number): number {
  if (distM >= MAP_LIGHT_GLOW_PROXIMITY_FADE_M) return 1;
  if (distM <= 0) return 0;
  return distM / MAP_LIGHT_GLOW_PROXIMITY_FADE_M;
}

export function applyMapLightGlowBlend(
  material: THREE.ShaderMaterial,
  mode: MapLightGlowBlendMode,
) {
  material.transparent = true;
  material.blending = THREE.CustomBlending;
  material.blendEquationAlpha = THREE.AddEquation;
  material.blendSrcAlpha = THREE.OneFactor;
  material.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;

  switch (mode) {
    case 'add':
      material.blendEquation = THREE.AddEquation;
      material.blendSrc = THREE.OneFactor;
      material.blendDst = THREE.OneFactor;
      break;
    case 'screen':
      material.blendEquation = THREE.AddEquation;
      material.blendSrc = THREE.OneFactor;
      material.blendDst = THREE.OneMinusSrcColorFactor;
      break;
    case 'lighten':
      material.blendEquation = THREE.MaxEquation;
      material.blendSrc = THREE.OneFactor;
      material.blendDst = THREE.OneFactor;
      break;
    default:
      material.blendEquation = THREE.AddEquation;
      material.blendSrc = THREE.OneFactor;
      material.blendDst = THREE.OneMinusSrcAlphaFactor;
      break;
  }
  material.needsUpdate = true;
}
