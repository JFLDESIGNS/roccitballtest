import { Billboard } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { applyMapLightGlowBlend, MAP_LIGHT_GLOW_DEFAULT_OPACITY } from '../game/mapLightGlowBlend';
import { ARENA } from '../shared/Constants';
import {
  MAP_LIGHT_GLOW_GROUND_FADE_M,
} from '../game/mapLightGlowSettings';
import {
  ALPHA_HOLE_NOISE_GLSL,
  ALPHA_HOLE_UNIFORM_DECLS_GLSL,
  GLSL_ALPHA_HOLE_MASK_FUNC,
  alphaHoleNoiseUniforms,
} from '../game/alphaHoleNoiseShader';
import {
  isLightGlowProximityAnchorActive,
  mapLightGlowProximityOpacity,
} from '../game/lightGlowProximityAnchor';
import { reportLightGlowProximity } from '../game/lightGlowProximityDebug';
import { graphicsStore } from '../game/graphicsStore';

type LightGlowBillboardProps = {
  color: string;
  size?: number;
  /** Map editor — show full glow without player proximity fade */
  editorPreview?: boolean;
};

/** Default play-mode glow billboard diameter (m). */
export const LIGHT_GLOW_DEFAULT_SIZE = 49.5;

const RECT_GLOW_SIZE_MUL = 9;

const _worldPos = new THREE.Vector3();
const FT_PER_M = 1 / 0.3048;

/**
 * Camera-facing radial glow for map lights in play mode.
 * Fades out only when the player/camera is right on the lamp (small core), not across the whole halo.
 */
export function LightGlowBillboard({
  color,
  size = LIGHT_GLOW_DEFAULT_SIZE,
  editorPreview = false,
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
        ...alphaHoleNoiseUniforms(),
        uFloorY: { value: ARENA.floorY },
        uGroundFadeM: { value: MAP_LIGHT_GLOW_GROUND_FADE_M },
        uEditorPreview: { value: editorPreview ? 1 : 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        uniform vec3 uColor;
        uniform float uOpacity;
        ${ALPHA_HOLE_UNIFORM_DECLS_GLSL}
        uniform float uFloorY;
        uniform float uGroundFadeM;
        uniform float uEditorPreview;

        ${ALPHA_HOLE_NOISE_GLSL}
        ${GLSL_ALPHA_HOLE_MASK_FUNC}

        void main() {
          vec2 c = vUv - 0.5;
          float d = length(c) * 2.0;
          if (d > 1.0) discard;

          float radial = 1.0 - smoothstep(0.0, 1.0, d);
          radial = pow(radial, 2.05);

          vec2 nUv = vUv * uNoiseScale + c * 0.28;
          float holeMask = alphaHoleMask(nUv);
          float alpha = radial * uOpacity;
          alpha *= mix(1.0, holeMask, uHoleStrength);

          float aboveFloor = mix(
            smoothstep(uFloorY, uFloorY + uGroundFadeM, vWorldPos.y),
            1.0,
            uEditorPreview
          );
          alpha *= aboveFloor;

          float edgeBreak = smoothstep(0.72, 0.98, d);
          alpha *= mix(1.0, holeMask, edgeBreak * 0.45);

          if (alpha < 0.004) discard;

          vec3 rgb = uColor * (0.24 + radial * 0.76);
          gl_FragColor = vec4(rgb * alpha, alpha);
        }
      `,
    });
    applyMapLightGlowBlend(mat, 'normal');
    return mat;
  }, [color]);

  useEffect(() => {
    material.uniforms.uColor.value.set(color);
    material.uniforms.uEditorPreview.value = editorPreview ? 1 : 0;
  }, [color, editorPreview, material]);

  useFrame((state) => {
    const root = worldRef.current;
    if (!root) return;

    const gfx = graphicsStore.getState();
    const peakOpacity = gfx.mapLightGlowOpacity ?? MAP_LIGHT_GLOW_DEFAULT_OPACITY;
    const sizeScale = gfx.mapLightGlowSizeScale ?? 1;
    const fadeFt = gfx.mapLightGlowProximityFadeFt;
    const glowDiameter = size * sizeScale;

    root.getWorldPosition(_worldPos);
    let effectiveDistM = 0;
    let factor = 1;
    let opacity = peakOpacity;
    if (editorPreview) {
      opacity = peakOpacity;
    } else {
      const prox = mapLightGlowProximityOpacity(
        _worldPos,
        glowDiameter,
        camera.position,
        peakOpacity,
        fadeFt,
      );
      effectiveDistM = prox.effectiveDistM;
      factor = prox.factor;
      opacity = prox.opacity;
    }

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
