import { Billboard } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import {
  applyMapLightGlowBlend,
  MAP_LIGHT_GLOW_DEFAULT_OPACITY,
  mapLightGlowProximityFactor,
} from '../game/mapLightGlowBlend';
import { graphicsStore } from '../game/graphicsStore';

type LightGlowBillboardProps = {
  color: string;
  size?: number;
};

/** Default play-mode glow billboard diameter (m). */
export const LIGHT_GLOW_DEFAULT_SIZE = 49.5;

const RECT_GLOW_SIZE_MUL = 9;

const _worldPos = new THREE.Vector3();

/**
 * Camera-facing radial glow for map lights in play mode.
 * Fades out within 20 ft of the camera so blobs do not wash the view up close.
 */
export function LightGlowBillboard({
  color,
  size = LIGHT_GLOW_DEFAULT_SIZE,
}: LightGlowBillboardProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const gfx = useSyncExternalStore(
    graphicsStore.subscribe,
    graphicsStore.getState,
  );

  const glowOpacity = gfx.mapLightGlowOpacity ?? MAP_LIGHT_GLOW_DEFAULT_OPACITY;
  const glowSizeScale = gfx.mapLightGlowSizeScale ?? 1;
  const glowBlend = gfx.mapLightGlowBlendMode ?? 'normal';
  const scaledSize = size * glowSizeScale;

  const geometry = useMemo(
    () => new THREE.PlaneGeometry(scaledSize, scaledSize),
    [scaledSize],
  );

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: glowOpacity },
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

        void main() {
          vec2 c = vUv - 0.5;
          float d = length(c) * 2.0;
          if (d > 1.0) discard;

          float glow = 1.0 - smoothstep(0.0, 1.0, d);
          glow = pow(glow, 2.05);
          float alpha = glow * uOpacity;
          if (alpha < 0.004) discard;

          vec3 rgb = uColor * (0.25 + glow * 0.75);
          gl_FragColor = vec4(rgb * alpha, alpha);
        }
      `,
    });
    applyMapLightGlowBlend(mat, glowBlend);
    return mat;
  }, []);

  useEffect(() => {
    material.uniforms.uColor.value.set(color);
  }, [color, material]);

  useEffect(() => {
    applyMapLightGlowBlend(material, glowBlend);
  }, [glowBlend, material]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.getWorldPosition(_worldPos);
    const dx = camera.position.x - _worldPos.x;
    const dz = camera.position.z - _worldPos.z;
    const distHoriz = Math.hypot(dx, dz);
    const proximity = mapLightGlowProximityFactor(distHoriz);
    material.uniforms.uOpacity.value = glowOpacity * proximity;
  });

  return (
    <Billboard renderOrder={180}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        frustumCulled={false}
      />
    </Billboard>
  );
}

export function lightGlowSizeForRect(width: number, height: number): number {
  return Math.max(width, height) * RECT_GLOW_SIZE_MUL;
}
