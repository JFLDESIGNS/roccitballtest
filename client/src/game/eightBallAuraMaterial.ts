import * as THREE from 'three';
import type { Team } from '../shared/Types';

const AURA_VERTEX = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vViewDirW;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDirW = normalize(cameraPosition - worldPos.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const AURA_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uFresnelPower;
uniform float uOpacity;

varying vec3 vNormalW;
varying vec3 vViewDirW;

void main() {
  float ndv = max(dot(normalize(vNormalW), normalize(vViewDirW)), 0.0);
  float rim = pow(1.0 - ndv, uFresnelPower);
  float a = rim * uIntensity * uOpacity;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor * rim * uIntensity, a);
}
`;

export const EIGHT_BALL_AURA_NAME = 'EightBallAura';

export function createEightBallAuraMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'EightBallAura',
    uniforms: {
      uColor: { value: new THREE.Color(0xffffff) },
      uIntensity: { value: 0.62 },
      uFresnelPower: { value: 3.1 },
      uOpacity: { value: 1 },
    },
    vertexShader: AURA_VERTEX,
    fragmentShader: AURA_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

export type EightBallAuraGlowOpts = {
  held: boolean;
  holderTeam: Team | null;
  immunity: boolean;
  pulse: number;
  beamContested: boolean;
  beamColor: THREE.Color;
};

export function applyEightBallAuraGlow(
  root: THREE.Object3D | null,
  opts: EightBallAuraGlowOpts,
): void {
  const mesh = root?.getObjectByName(EIGHT_BALL_AURA_NAME) as THREE.Mesh | undefined;
  const mat = mesh?.material;
  if (!(mat instanceof THREE.ShaderMaterial)) return;

  const { held, holderTeam, immunity, pulse, beamContested, beamColor } = opts;
  let color = new THREE.Color(0xffffff);
  let intensity = 0.58;

  if (held && holderTeam) {
    intensity = pulse;
    if (holderTeam === 'red') {
      color.set(immunity ? '#ff8877' : '#ff5544');
    } else {
      color.set(immunity ? '#88ccff' : '#55aaff');
    }
  } else if (beamContested) {
    color.copy(beamColor);
    intensity = 0.48;
  } else {
    color.set(0xffffff);
    intensity = 0.62;
  }

  mat.uniforms.uColor.value.copy(color);
  mat.uniforms.uIntensity.value = intensity;
}

export function setEightBallAuraAlpha(
  root: THREE.Object3D | null,
  alpha: number,
): void {
  const mesh = root?.getObjectByName(EIGHT_BALL_AURA_NAME) as THREE.Mesh | undefined;
  const mat = mesh?.material;
  if (!(mat instanceof THREE.ShaderMaterial)) return;
  mat.uniforms.uOpacity.value = alpha;
  mat.transparent = alpha < 0.999;
}
