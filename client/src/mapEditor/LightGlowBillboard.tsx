import { Billboard } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  applyMapLightGlowBlend,
  MAP_LIGHT_GLOW_DEFAULT_OPACITY,
  MAP_LIGHT_GLOW_PROXIMITY_FADE_FT,
} from '../game/mapLightGlowBlend';
import {
  isLightGlowProximityAnchorActive,
  mapLightGlowProximityOpacity,
} from '../game/lightGlowProximityAnchor';
import { reportLightGlowProximity } from '../game/lightGlowProximityDebug';
import { graphicsStore } from '../game/graphicsStore';

type LightGlowBillboardProps = {
  color: string;
  size?: number;
};

/** Default play-mode glow billboard diameter (m). */
export const LIGHT_GLOW_DEFAULT_SIZE = 49.5;

const RECT_GLOW_SIZE_MUL = 9;

const _worldPos = new THREE.Vector3();
const FT_PER_M = 1 / 0.3048;

/**
 * Camera-facing radial glow for map lights in play mode.
 * Fades out near the player using distance to the glow disk edge (not just the light center).
 */
export function LightGlowBillboard({
  color,
  size = LIGHT_GLOW_DEFAULT_SIZE,
}: LightGlowBillboardProps) {
  const worldRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: MAP_LIGHT_GLOW_DEFAULT_OPACITY },
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
    applyMapLightGlowBlend(mat, 'normal');
    return mat;
  }, [color]);

  useEffect(() => {
    material.uniforms.uColor.value.set(color);
  }, [color, material]);

  useFrame((state) => {
    const root = worldRef.current;
    if (!root) return;

    const gfx = graphicsStore.getState();
    const peakOpacity = gfx.mapLightGlowOpacity ?? MAP_LIGHT_GLOW_DEFAULT_OPACITY;
    const sizeScale = gfx.mapLightGlowSizeScale ?? 1;
    const fadeFt = gfx.mapLightGlowProximityFadeFt ?? MAP_LIGHT_GLOW_PROXIMITY_FADE_FT;
    const glowDiameter = size * sizeScale;

    root.getWorldPosition(_worldPos);
    const { effectiveDistM, factor, opacity } = mapLightGlowProximityOpacity(
      _worldPos,
      glowDiameter,
      camera.position,
      peakOpacity,
      fadeFt,
    );

    material.uniforms.uOpacity.value = opacity;

    const blend = gfx.mapLightGlowBlendMode ?? 'normal';
    if (material.userData.glowBlend !== blend) {
      applyMapLightGlowBlend(material, blend);
      material.userData.glowBlend = blend;
    }

    const mesh = meshRef.current;
    if (mesh) {
      mesh.scale.set(glowDiameter, glowDiameter, 1);
    }

    if (gfx.mapLightGlowProximityDebug) {
      reportLightGlowProximity(
        Math.floor(state.clock.elapsedTime * 60),
        effectiveDistM * FT_PER_M,
        factor,
        opacity,
        isLightGlowProximityAnchorActive(),
      );
    }
  });

  return (
    <group ref={worldRef}>
      <Billboard renderOrder={180}>
        <mesh
          ref={meshRef}
          geometry={geometry}
          material={material}
          frustumCulled={false}
        />
      </Billboard>
    </group>
  );
}

export function lightGlowSizeForRect(width: number, height: number): number {
  return Math.max(width, height) * RECT_GLOW_SIZE_MUL;
}
