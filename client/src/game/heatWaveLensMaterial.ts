import * as THREE from 'three';

export type HeatLensUniforms = {
  tScene: { value: THREE.Texture | null };
  resolution: { value: THREE.Vector2 };
  screenCenter: { value: THREE.Vector2 };
  opacity: { value: number };
  bulge: { value: number };
};

const vertexShader = /* glsl */ `
varying float vFacing;

void main() {
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPos;
  vec3 viewN = normalize(normalMatrix * normal);
  vec3 viewDir = normalize(-mvPos.xyz);
  vFacing = pow(clamp(dot(viewN, viewDir), 0.0, 1.0), 0.38);
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 resolution;
uniform vec2 screenCenter;
uniform float opacity;
uniform float bulge;

varying float vFacing;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  vec2 toCenter = uv - screenCenter;
  float dist = length(toCenter);
  float lens = smoothstep(0.98, 0.04, dist);
  float punch = lens * lens * (0.55 + lens * 0.45);
  vec2 sampleUv = uv + toCenter * punch * bulge;
  vec3 behind = texture2D(tScene, sampleUv).rgb;
  float alpha = punch * vFacing * opacity;
  if (alpha < 0.008) discard;
  gl_FragColor = vec4(behind, alpha);
}
`;

export function createHeatLensMaterial(outer: boolean): THREE.ShaderMaterial {
  const uniforms: HeatLensUniforms = {
    tScene: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    screenCenter: { value: new THREE.Vector2(0.5, 0.5) },
    opacity: { value: outer ? 0.92 : 0.78 },
    bulge: { value: outer ? 0.52 : 0.38 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  material.name = outer ? 'HeatLensOuter' : 'HeatLensInner';
  return material;
}
