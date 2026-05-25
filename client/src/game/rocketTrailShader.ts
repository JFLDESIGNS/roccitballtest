import * as THREE from 'three';

const vertexShader = /* glsl */ `
attribute vec3 color;
varying vec3 vTrailColor;
void main() {
  vTrailColor = color;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
varying vec3 vTrailColor;
uniform float uOpacity;

void main() {
  vec3 c = vTrailColor;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, vec3(lum) * vec3(0.62, 0.61, 0.6), 0.42);
  c = min(c, vec3(0.58));
  float a = clamp(lum * 1.35, 0.08, 0.92) * uOpacity;
  if (a < 0.03) discard;
  gl_FragColor = vec4(c, a);
}
`;

export type RocketTrailShaderMaterial = THREE.ShaderMaterial & {
  uniforms: {
    uOpacity: { value: number };
  };
};

export function createRocketTrailShaderMaterial(): RocketTrailShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 1 } },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: true,
    vertexColors: true,
  }) as RocketTrailShaderMaterial;
}
