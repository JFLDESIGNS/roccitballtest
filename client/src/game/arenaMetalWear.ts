import * as THREE from 'three';

/** Fragment-only — never inject fwidth helpers into the vertex shader */
const METAL_FRAG_GLSL = /* glsl */ `
vec2 metalHash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

float metalNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = metalHash2(i).x;
  float b = metalHash2(i + vec2(1.0, 0.0)).x;
  float c = metalHash2(i + vec2(0.0, 1.0)).x;
  float d = metalHash2(i + vec2(1.0, 1.0)).x;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float metalScratchField(vec3 worldPos) {
  vec2 uv = worldPos.xz * 0.85 + worldPos.y * 0.12;
  float n = metalNoise(uv * 6.0);
  n += metalNoise(uv * 14.0 + 2.1) * 0.45;
  float streak = metalNoise(vec2(uv.x * 22.0 + uv.y * 3.0, uv.y * 1.5));
  streak = smoothstep(0.72, 0.92, streak);
  return n * 0.55 + streak * 0.35;
}

float metalEdgeWear(vec3 worldNormal) {
  vec3 n = normalize(worldNormal);
  float rim = 1.0 - abs(dot(n, vec3(0.0, 1.0, 0.0)));
  return clamp(rim * 0.55, 0.0, 1.0);
}
`;

const METAL_CACHE_KEY = 'arena_metal_wear_v3';

/** Edge distress + micro-scratches on arena metal (fragment-safe) */
export function applyArenaMetalWearShader(
  material: THREE.MeshStandardMaterial,
  opts?: { scratchStrength?: number; wearStrength?: number },
): void {
  const scratchStrength = opts?.scratchStrength ?? 1;
  const wearStrength = opts?.wearStrength ?? 1;

  material.envMapIntensity = Math.max(material.envMapIntensity ?? 0, 0.85);
  material.customProgramCacheKey = () => METAL_CACHE_KEY;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uScratchStrength = { value: 0.22 * scratchStrength };
    shader.uniforms.uWearStrength = { value: 0.38 * wearStrength };

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      varying vec3 vMetalWorldPos;
      varying vec3 vMetalWorldNormal;`,
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
      vMetalWorldPos = worldPosition.xyz;
      vMetalWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`,
    );

    shader.fragmentShader =
      METAL_FRAG_GLSL +
      shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
        varying vec3 vMetalWorldPos;
        varying vec3 vMetalWorldNormal;
        uniform float uScratchStrength;
        uniform float uWearStrength;`,
      );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
      {
        float scratch = metalScratchField(vMetalWorldPos);
        roughnessFactor = clamp(roughnessFactor + scratch * uScratchStrength, 0.04, 1.0);
      }`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      {
        float wear = metalEdgeWear(vMetalWorldNormal) * uWearStrength;
        float scratch = metalScratchField(vMetalWorldPos);
        wear += scratch * uScratchStrength * 0.4;
        diffuseColor.rgb *= 1.0 - wear * 0.22;
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          diffuseColor.rgb * vec3(0.72, 0.7, 0.68),
          scratch * uScratchStrength * 0.35
        );
      }`,
    );
  };
}
