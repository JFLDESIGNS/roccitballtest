import {
  MAP_LIGHT_GLOW_ALPHA_HOLE_CUTOFF,
  MAP_LIGHT_GLOW_ALPHA_HOLE_SOFT,
  MAP_LIGHT_GLOW_ALPHA_HOLE_STRENGTH,
  MAP_LIGHT_GLOW_NOISE_SCALE,
} from './mapLightGlowSettings';

/** hash / noise / fbm — shared by map light blobs and volumetric cones */
export const ALPHA_HOLE_NOISE_GLSL = /* glsl */ `
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.55;
    mat2 rot = mat2(0.877, 0.48, -0.48, 0.877);
    for (int i = 0; i < 4; i++) {
      v += amp * noise(p);
      p = rot * p * 2.02 + vec2(1.6, 4.1);
      amp *= 0.5;
    }
    return v;
  }
`;

export const ALPHA_HOLE_UNIFORM_DECLS_GLSL = /* glsl */ `
  uniform float uNoiseScale;
  uniform float uHoleStrength;
  uniform float uHoleCutoff;
  uniform float uHoleSoft;
`;

/** Global-scope helper — safe for WebGL1 (no mid-main declarations). */
export const GLSL_ALPHA_HOLE_MASK_FUNC = /* glsl */ `
  float alphaHoleMask(vec2 nUv) {
    float nCoarse = fbm(nUv);
    float nFine = fbm(nUv * 3.6 + vec2(17.3, 4.7));
    float nSpeck = fbm(nUv * 9.5 + vec2(4.2, 11.1));
    float bw = nCoarse * 0.58 + nFine * 0.32 + nSpeck * 0.1;
    float holeLo = uHoleCutoff - uHoleSoft;
    float holeHi = uHoleCutoff + uHoleSoft;
    return smoothstep(holeLo, holeHi, bw);
  }
`;

export function alphaHoleNoiseUniforms() {
  return {
    uNoiseScale: { value: MAP_LIGHT_GLOW_NOISE_SCALE },
    uHoleStrength: { value: MAP_LIGHT_GLOW_ALPHA_HOLE_STRENGTH },
    uHoleCutoff: { value: MAP_LIGHT_GLOW_ALPHA_HOLE_CUTOFF },
    uHoleSoft: { value: MAP_LIGHT_GLOW_ALPHA_HOLE_SOFT },
  };
}

/** World-space UV scale for cone volumes (meters). */
export const SPOTLIGHT_CONE_NOISE_WORLD_MUL = 0.12;
