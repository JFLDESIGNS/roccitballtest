import { Billboard } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { applyMapLightGlowBlend, MAP_LIGHT_GLOW_DEFAULT_OPACITY } from '../game/mapLightGlowBlend';
import { ARENA } from '../shared/Constants';
import {
  MAP_LIGHT_GLOW_ALPHA_HOLE_CUTOFF,
  MAP_LIGHT_GLOW_ALPHA_HOLE_SOFT,
  MAP_LIGHT_GLOW_ALPHA_HOLE_STRENGTH,
  MAP_LIGHT_GLOW_GROUND_FADE_M,
  MAP_LIGHT_GLOW_NOISE_SCALE,
} from '../game/mapLightGlowSettings';
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
        uNoiseScale: { value: MAP_LIGHT_GLOW_NOISE_SCALE },
        uHoleStrength: { value: MAP_LIGHT_GLOW_ALPHA_HOLE_STRENGTH },
        uHoleCutoff: { value: MAP_LIGHT_GLOW_ALPHA_HOLE_CUTOFF },
        uHoleSoft: { value: MAP_LIGHT_GLOW_ALPHA_HOLE_SOFT },
        uFloorY: { value: ARENA.floorY },
        uGroundFadeM: { value: MAP_LIGHT_GLOW_GROUND_FADE_M },
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
        uniform float uNoiseScale;
        uniform float uHoleStrength;
        uniform float uHoleCutoff;
        uniform float uHoleSoft;
        uniform float uFloorY;
        uniform float uGroundFadeM;

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
          float amp = 0.55;
          mat2 rot = mat2(0.877, 0.48, -0.48, 0.877);
          for (int i = 0; i < 4; i++) {
            v += amp * noise(p);
            p = rot * p * 2.02 + vec2(1.6, 4.1);
            amp *= 0.5;
          }
          return v;
        }

        void main() {
          vec2 c = vUv - 0.5;
          float d = length(c) * 2.0;
          if (d > 1.0) discard;

          float radial = 1.0 - smoothstep(0.0, 1.0, d);
          radial = pow(radial, 2.05);

          vec2 nUv = vUv * uNoiseScale + c * 0.28;
          float nCoarse = fbm(nUv);
          float nFine = fbm(nUv * 3.6 + vec2(17.3, 4.7));
          float nSpeck = fbm(nUv * 9.5 + vec2(4.2, 11.1));
          float bw = nCoarse * 0.58 + nFine * 0.32 + nSpeck * 0.1;

          float holeLo = uHoleCutoff - uHoleSoft;
          float holeHi = uHoleCutoff + uHoleSoft;
          float holeMask = smoothstep(holeLo, holeHi, bw);
          float alpha = radial * uOpacity;
          alpha *= mix(1.0, holeMask, uHoleStrength);

          float aboveFloor = smoothstep(uFloorY, uFloorY + uGroundFadeM, vWorldPos.y);
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
  }, [color, material]);

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
