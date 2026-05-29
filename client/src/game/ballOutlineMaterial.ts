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
uniform float uBlurPx;
uniform float uSmoothingPx;
varying vec3 vNormalVS;
varying vec3 vViewPosVS;

void main() {
  vec3 n = normalize(vNormalVS);
  vec3 v = normalize(-vViewPosVS);
  float rim = 1.0 - abs(dot(n, v));

  float line = max(uLineWidthPx, 0.1) * 0.018;
  float feather = max(uBlurPx + uSmoothingPx, 0.1) * 0.012;
  float inner = max(0.0, 1.0 - line - feather);
  float outer = max(inner + 0.001, 1.0 - line * 0.22);
  float alpha = smoothstep(inner, outer, rim) * 0.46;

  if (alpha < 0.01) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`;

export function createBallOutlineMaterial(
  lineWidthPx = 2,
  blurPx = 2,
  smoothingPx = 2,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0xffffff) },
      uLineWidthPx: { value: lineWidthPx },
      uBlurPx: { value: blurPx },
      uSmoothingPx: { value: smoothingPx },
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
