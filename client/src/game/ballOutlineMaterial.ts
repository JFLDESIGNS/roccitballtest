import * as THREE from 'three';

/** Draw on top of scene geometry; still respects ball scale from parent. */
export const BALL_OUTLINE_RENDER_ORDER = 9500;

const OUTLINE_VERTEX = /* glsl */ `
varying vec3 vNormalVS;
varying vec3 vViewPosVS;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosVS = mvPosition.xyz;
  vNormalVS = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const OUTLINE_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uLineWidthPx;
varying vec3 vNormalVS;
varying vec3 vViewPosVS;

void main() {
  vec3 n = normalize(vNormalVS);
  vec3 v = normalize(-vViewPosVS);
  float rim = 1.0 - abs(dot(n, v));

  float w = max(uLineWidthPx * length(vec2(dFdx(rim), dFdy(rim))), 1e-5);
  float alpha = smoothstep(1.0 - w * 1.35, 1.0, rim);

  if (alpha < 0.02) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`;

export function createBallOutlineMaterial(
  lineWidthPx = 2,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0xffffff) },
      uLineWidthPx: { value: lineWidthPx },
    },
    vertexShader: OUTLINE_VERTEX,
    fragmentShader: OUTLINE_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    side: THREE.FrontSide,
  });
}
