import * as THREE from 'three';

export type CeilingGridShaderMaterial = THREE.ShaderMaterial & {
  uniforms: {
    uPulse: { value: number };
    uTime: { value: number };
    uGridCells: { value: number };
  };
};

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uPulse;
  uniform float uTime;
  uniform float uGridCells;

  void main() {
    if (uPulse < 0.001) discard;

    vec2 uv = vUv;
    vec2 gv = fract(uv * uGridCells);
    float lineW = 0.028;
    float ax = smoothstep(lineW, 0.0, gv.x) + smoothstep(1.0 - lineW, 1.0, gv.x);
    float az = smoothstep(lineW, 0.0, gv.y) + smoothstep(1.0 - lineW, 1.0, gv.y);
    float grid = clamp(ax + az, 0.0, 1.0);

    float pulse = uPulse * (0.88 + 0.12 * sin(uTime * 14.0));
    float shimmer = 0.92 + 0.08 * sin(uTime * 9.0 + uv.x * 24.0 + uv.y * 18.0);
    vec3 green = vec3(0.18, 1.0, 0.42);
    float alpha = grid * pulse * shimmer * 0.5;
    gl_FragColor = vec4(green * alpha * 1.35, alpha);
  }
`;

export function createCeilingGridShaderMaterial(): CeilingGridShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uPulse: { value: 0 },
      uTime: { value: 0 },
      uGridCells: { value: 28 },
    },
    vertexShader,
    fragmentShader,
  }) as CeilingGridShaderMaterial;
}
