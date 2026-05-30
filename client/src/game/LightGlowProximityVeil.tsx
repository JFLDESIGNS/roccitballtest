import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  MAP_LIGHT_GLOW_VIEW_VEIL_FULL_FT,
  MAP_LIGHT_GLOW_VIEW_VEIL_START_FT,
} from './mapLightGlowSettings';
import { mapLightGlowListenerHorizontalDistanceM } from './lightGlowProximityAnchor';
import { getRegisteredLightGlowScreens } from './lightGlowScreenRegistry';

const FT_TO_M = 0.3048;
const START_M = MAP_LIGHT_GLOW_VIEW_VEIL_START_FT * FT_TO_M;
const FULL_M = MAP_LIGHT_GLOW_VIEW_VEIL_FULL_FT * FT_TO_M;

const _screenPos = new THREE.Vector3();
const _bestColor = new THREE.Color();
const _forward = new THREE.Vector3();

function veilFactor(distanceM: number): number {
  if (distanceM >= START_M) return 0;
  if (distanceM <= FULL_M) return 1;
  const t = (START_M - distanceM) / Math.max(0.001, START_M - FULL_M);
  return t * t * (3 - 2 * t);
}

function cameraPlaneSize(camera: THREE.Camera, aspect: number, distance: number) {
  if (camera instanceof THREE.PerspectiveCamera) {
    const height =
      2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5) * distance;
    return { width: height * aspect, height };
  }
  return { width: 10 * aspect, height: 10 };
}

export function LightGlowProximityVeil() {
  const meshRef = useRef<THREE.Mesh>(null);
  const driftRef = useRef(0);
  const { camera, size } = useThree();
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        uniforms: {
          uColor: { value: new THREE.Color('#bfeeff') },
          uOpacity: { value: 0 },
          uNoiseOffset: { value: 0 },
          uTime: { value: 0 },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          uniform vec3 uColor;
          uniform float uOpacity;
          uniform float uNoiseOffset;
          uniform float uTime;

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

          float fbm(vec2 p) {
            float v = 0.0;
            float amp = 0.54;
            mat2 rot = mat2(0.86, 0.51, -0.51, 0.86);
            for (int i = 0; i < 4; i++) {
              v += amp * noise(p);
              p = rot * p * 2.03 + vec2(2.7, 5.1);
              amp *= 0.5;
            }
            return v;
          }

          void main() {
            vec2 uv = vUv;
            vec2 center = uv - 0.5;
            float vignette = 1.0 - smoothstep(0.42, 0.78, length(center));
            vec2 scrollUv = uv * vec2(2.6, 1.7) + vec2(uTime * 0.018, -uNoiseOffset);
            float coarse = fbm(scrollUv);
            float fine = fbm(scrollUv * 3.2 + vec2(9.2, 1.7));
            float cloud = coarse * 0.72 + fine * 0.28;
            float mask = smoothstep(0.24, 0.82, cloud);
            float strands = smoothstep(0.28, 0.72, fbm(scrollUv * vec2(0.68, 2.9)));
            float alpha = uOpacity * vignette * mask * (0.38 + strands * 0.62);
            if (alpha < 0.002) discard;
            vec3 rgb = uColor * (0.7 + mask * 0.5);
            gl_FragColor = vec4(rgb * alpha, alpha);
          }
        `,
      }),
    [],
  );

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    let bestDist = Infinity;
    let bestColor: THREE.Color | undefined;
    for (const screen of getRegisteredLightGlowScreens()) {
      screen.mesh.updateWorldMatrix(true, false);
      screen.mesh.getWorldPosition(_screenPos);
      const dist = mapLightGlowListenerHorizontalDistanceM(
        _screenPos,
        camera.position,
      );
      if (dist >= bestDist) continue;
      bestDist = dist;
      bestColor = screen.color;
    }

    const factor = Number.isFinite(bestDist) ? veilFactor(bestDist) : 0;
    mesh.visible = factor > 0.01;
    material.uniforms.uOpacity.value = factor * 0.32;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    driftRef.current += delta * (0.24 + (1 - factor) * 0.18);
    material.uniforms.uNoiseOffset.value = driftRef.current;
    if (bestColor) {
      _bestColor.copy(bestColor);
      material.uniforms.uColor.value.copy(_bestColor);
    }

    const distance = 3.2;
    camera.getWorldDirection(_forward);
    mesh.position.copy(camera.position).addScaledVector(_forward, distance);
    mesh.quaternion.copy(camera.quaternion);
    const aspect = Math.max(0.1, size.width / Math.max(1, size.height));
    const planeSize = cameraPlaneSize(camera, aspect, distance);
    mesh.scale.set(planeSize.width * 1.12, planeSize.height * 1.12, 1);
  });

  return (
    <mesh
      ref={meshRef}
      material={material}
      renderOrder={240}
      frustumCulled={false}
      visible={false}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
