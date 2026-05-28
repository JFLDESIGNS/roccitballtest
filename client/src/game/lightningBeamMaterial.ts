import * as THREE from 'three';

const vertexShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    float warp = sin(uv.y * 24.0 - uTime * 14.0 + position.x * 3.0) * 0.08;
    vec3 pos = position + normal * warp;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uColor;
  uniform vec3 uCoreColor;
  varying vec2 vUv;
  varying vec3 vWorldPos;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    float scroll = vUv.y * 28.0 - uTime * 22.0;
    float bolt = abs(sin(scroll * 3.5 + noise(vec2(scroll * 0.5, uTime * 6.0)) * 6.0));
    bolt = pow(max(0.0, 1.0 - bolt), 3.0);

    float arc = noise(vec2(vUv.x * 10.0 + uTime * 8.0, scroll * 0.3));
    float rim = smoothstep(0.35, 0.0, abs(vUv.x - 0.5) * 2.0);
    float pulse = 0.65 + 0.35 * sin(uTime * 18.0 + vUv.y * 40.0);

    float core = bolt * (0.55 + arc * 0.45) * rim * pulse;
    vec3 col = mix(uColor, uCoreColor, bolt);
    col *= 1.0 + arc * 0.8;

    float alpha = core * uOpacity;
    if (alpha < 0.03) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

export function createLightningBeamMaterial(): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uColor: { value: new THREE.Color('#2288ff') },
      uCoreColor: { value: new THREE.Color('#aaf0ff') },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  material.name = 'LightningBeam';
  return material;
}
