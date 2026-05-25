import * as THREE from 'three';

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D crackMap;
uniform float uOpacity;
uniform float uTime;
uniform vec3 uCamPos;
uniform vec3 uWorldPos;
uniform vec3 uNormal;
uniform vec2 uShimmer;

varying vec2 vUv;

vec3 hsl2rgb(float h, float s, float l) {
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
  float m = l - c * 0.5;
  vec3 rgb;
  if (h < 1.0 / 6.0) rgb = vec3(c, x, 0.0);
  else if (h < 2.0 / 6.0) rgb = vec3(x, c, 0.0);
  else if (h < 3.0 / 6.0) rgb = vec3(0.0, c, x);
  else if (h < 4.0 / 6.0) rgb = vec3(0.0, x, c);
  else if (h < 5.0 / 6.0) rgb = vec3(x, 0.0, c);
  else rgb = vec3(c, 0.0, x);
  return rgb + m;
}

/** Crack lines from luminance — avoids solid white quads when alpha channel is wrong */
float crackMask(vec4 tex) {
  float lum = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
  float fromLum = smoothstep(0.18, 0.72, lum);
  float fromAlpha = smoothstep(0.04, 0.35, tex.a);
  return max(fromLum * fromAlpha, fromLum * 0.92);
}

void main() {
  vec4 crack = texture2D(crackMap, vUv);
  float mask = crackMask(crack);
  if (mask < 0.02) discard;

  vec3 viewDir = normalize(uCamPos - uWorldPos);
  float fresnel = pow(1.0 - max(dot(viewDir, uNormal), 0.0), 2.2);
  float hue = fract(
    vUv.x * 0.38 + vUv.y * 0.31 + uShimmer.x * 0.42 + uShimmer.y * 0.28
    + uTime * 0.11 + fresnel * 0.22
  );
  vec3 rainbow = hsl2rgb(hue, 0.28, 0.96);

  float bandA = smoothstep(0.42, 0.0, abs(vUv.x - 0.22 - uShimmer.x * 0.35));
  float bandB = smoothstep(0.38, 0.0, abs(vUv.x - 0.72 - uShimmer.y * 0.32));
  float shimmer = (bandA + bandB * 0.85) * (0.28 + fresnel * 0.4);

  vec3 base = vec3(0.94, 0.96, 1.0);
  vec3 col = mix(base, rainbow, shimmer * 0.65);
  col = mix(col, rainbow, mask * 0.22);
  col *= mask;

  float a = mask * uOpacity;
  gl_FragColor = vec4(col, a);
}
`;

export type FanGlassCrackShaderMaterial = THREE.ShaderMaterial & {
  uniforms: {
    crackMap: { value: THREE.Texture };
    uOpacity: { value: number };
    uTime: { value: number };
    uCamPos: { value: THREE.Vector3 };
    uWorldPos: { value: THREE.Vector3 };
    uNormal: { value: THREE.Vector3 };
    uShimmer: { value: THREE.Vector2 };
  };
};

export function createFanGlassCrackMaterial(
  crackTex: THREE.Texture,
): FanGlassCrackShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      crackMap: { value: crackTex },
      uOpacity: { value: 0.2 },
      uTime: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
      uWorldPos: { value: new THREE.Vector3() },
      uNormal: { value: new THREE.Vector3(0, 0, 1) },
      uShimmer: { value: new THREE.Vector2() },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  }) as FanGlassCrackShaderMaterial;
}
