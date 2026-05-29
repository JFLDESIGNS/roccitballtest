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

  float px = max(length(vec2(dFdx(rim), dFdy(rim))), 1e-5);
  float line = uLineWidthPx * px;
  float feather = (uBlurPx + uSmoothingPx) * px;
  float soft = smoothstep(1.0 - line - feather, 1.0, rim);
  float core = smoothstep(1.0 - line * 0.85, 1.0, rim);
  float glow = smoothstep(1.0 - line - feather * 1.65, 1.0 - line * 0.25, rim);
  float alpha = max(core * 0.74, glow * 0.36) + soft * 0.18;
  alpha = min(alpha, 0.92);

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
