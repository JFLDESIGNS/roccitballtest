import * as THREE from 'three';

/** World-space turf scale — higher = denser blade pattern */
const TURF_REPEAT_BASE = 0.2;
/** Fake blade height via normal perturbation (keep low for short dense turf) */
const TURF_BUMP_BASE = 0.32;

export const arenaTurfShaderUniforms = {
  uTurfRepeat: { value: TURF_REPEAT_BASE },
  uTurfBump: { value: TURF_BUMP_BASE },
};

/** Match instanced grass scale from tuning menu */
export function setArenaTurfShaderGrassScale(scale: number) {
  const s = Math.max(0.25, Math.min(3, scale));
  arenaTurfShaderUniforms.uTurfRepeat.value = TURF_REPEAT_BASE * s;
  arenaTurfShaderUniforms.uTurfBump.value = TURF_BUMP_BASE * Math.min(s, 2);
}

const TURF_GLSL = /* glsl */ `
vec2 turfHash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

float turfNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = turfHash2(i).x;
  float b = turfHash2(i + vec2(1.0, 0.0)).x;
  float c = turfHash2(i + vec2(0.0, 1.0)).x;
  float d = turfHash2(i + vec2(1.0, 1.0)).x;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float turfField(vec2 uv) {
  float n = turfNoise(uv);
  n += turfNoise(uv * 2.2 + 1.3) * 0.48;
  n += turfNoise(uv * 5.5 + 2.0) * 0.2;
  n += turfNoise(uv * 13.5 + 0.7) * 0.07;
  return n / 1.75;
}
`;

/** Performant dense short turf — procedural color + micro normal bump */
export const arenaTurfMaterial = new THREE.MeshStandardMaterial({
  color: '#141a0a',
  roughness: 1,
  metalness: 0,
  envMapIntensity: 0,
});

arenaTurfMaterial.customProgramCacheKey = () => 'arena_turf_v1';

arenaTurfMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uTurfRepeat = arenaTurfShaderUniforms.uTurfRepeat;
  shader.uniforms.uTurfBump = arenaTurfShaderUniforms.uTurfBump;

  shader.vertexShader =
    TURF_GLSL +
    shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      varying vec3 vTurfWorldPos;`,
    );

  shader.vertexShader = shader.vertexShader.replace(
    '#include <worldpos_vertex>',
    `#include <worldpos_vertex>
    vTurfWorldPos = worldPosition.xyz;`,
  );

  shader.fragmentShader =
    TURF_GLSL +
    shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      varying vec3 vTurfWorldPos;
      uniform float uTurfRepeat;
      uniform float uTurfBump;`,
    );

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <color_fragment>',
    `#include <color_fragment>
    vec2 tuv = vTurfWorldPos.xz * uTurfRepeat;
    float tf = turfField(tuv);
    vec3 turfDark = vec3(0.062, 0.068, 0.032);
    vec3 turfMid = vec3(0.082, 0.09, 0.042);
    vec3 turfLite = vec3(0.102, 0.112, 0.052);
    diffuseColor.rgb = mix(turfDark, mix(turfMid, turfLite, smoothstep(0.3, 0.85, tf) * 0.32), 0.96);
    diffuseColor.rgb *= 0.75 + 0.06 * turfNoise(tuv * 18.0);`,
  );

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <output_fragment>',
    `#include <output_fragment>
    gl_FragColor.rgb *= 0.8;`,
  );

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <normal_fragment_maps>',
    `#include <normal_fragment_maps>
    {
      vec2 tuv = vTurfWorldPos.xz * uTurfRepeat;
      float ex = uTurfRepeat * 0.4;
      float h0 = turfField(tuv);
      float hx = turfField(tuv + vec2(ex, 0.0)) - h0;
      float hz = turfField(tuv + vec2(0.0, ex)) - h0;
      normal = normalize(vec3(
        normal.x - hx * uTurfBump,
        normal.y,
        normal.z - hz * uTurfBump
      ));
    }`,
  );
};
