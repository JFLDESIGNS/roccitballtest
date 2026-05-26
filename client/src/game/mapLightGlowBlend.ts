import * as THREE from 'three';
import { MAP_LIGHT_GLOW_ZERO_CORE_FT } from './mapLightGlowSettings';

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

const FT_TO_M = 0.3048;

export function mapLightGlowFadeRadiusM(fadeFt: number): number {
  return Math.max(1, fadeFt) * FT_TO_M;
}

/**
 * Horizontal distance into the proximity fade band (0 only when right on the lamp).
 * Uses a small core at the light center — not the huge glow billboard radius.
 */
export function mapLightGlowEffectiveHorizontalDistM(
  centerX: number,
  centerZ: number,
  listenerX: number,
  listenerZ: number,
  _glowDiameterM: number,
): number {
  const horiz = Math.hypot(listenerX - centerX, listenerZ - centerZ);
  const coreM = MAP_LIGHT_GLOW_ZERO_CORE_FT * FT_TO_M;
  return Math.max(0, horiz - coreM);
}

/**
 * 0 when against the lamp core, 1 at fadeRadiusM or farther out.
 */
export function mapLightGlowProximityFactor(
  effectiveDistM: number,
  fadeRadiusM: number,
): number {
  if (effectiveDistM >= fadeRadiusM) return 1;
  if (effectiveDistM <= 0) return 0;
  const t = effectiveDistM / fadeRadiusM;
  return t * t * (3 - 2 * t);
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
