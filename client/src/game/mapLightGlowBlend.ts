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

/** Default fade band beyond the glow disk edge (feet). */
export const MAP_LIGHT_GLOW_PROXIMITY_FADE_FT = 40;

const FT_TO_M = 0.3048;

export function mapLightGlowFadeRadiusM(fadeFt: number): number {
  return Math.max(1, fadeFt) * FT_TO_M;
}

/**
 * Horizontal distance from listener to the glow disk edge (0 when standing inside the blob).
 */
export function mapLightGlowEffectiveHorizontalDistM(
  centerX: number,
  centerZ: number,
  listenerX: number,
  listenerZ: number,
  glowDiameterM: number,
): number {
  const horiz = Math.hypot(listenerX - centerX, listenerZ - centerZ);
  const innerRadius = glowDiameterM * 0.5 * 0.9;
  return Math.max(0, horiz - innerRadius);
}

/**
 * 0 at the glow edge, 1 at fadeRadiusM or farther beyond the edge.
 */
export function mapLightGlowProximityFactor(
  effectiveDistM: number,
  fadeRadiusM: number = mapLightGlowFadeRadiusM(MAP_LIGHT_GLOW_PROXIMITY_FADE_FT),
): number {
  if (effectiveDistM >= fadeRadiusM) return 1;
  if (effectiveDistM <= 0) return 0;
  return effectiveDistM / fadeRadiusM;
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
