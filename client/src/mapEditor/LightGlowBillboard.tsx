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
import {
  getLightGlowPunchUniforms,
  lightGlowPunchNowSec,
  LIGHT_GLOW_MAX_PUNCHES,
} from '../game/lightGlowHoles';
import { registerLightGlowScreen } from '../game/lightGlowScreenRegistry';

type LightGlowBillboardProps = {
  /** Stable id (map light id) for rocket punch-hole mask */
  glowId: string;
  color: string;
  size?: number;
  /** Map editor — show full glow without player proximity fade */
  editorPreview?: boolean;
};

/** Default play-mode glow billboard diameter (m). */
export const LIGHT_GLOW_DEFAULT_SIZE = 49.5;

const RECT_GLOW_SIZE_MUL = 9;

const _worldPos = new THREE.Vector3();
const _billboardNormal = new THREE.Vector3();
const FT_PER_M = 1 / 0.3048;

const LIGHT_GLOW_PUNCH_GLSL = /* glsl */ `
  uniform int uPunchCount;
  uniform vec3 uPunchCenters[${LIGHT_GLOW_MAX_PUNCHES}];
  uniform float uPunchRadii[${LIGHT_GLOW_MAX_PUNCHES}];
  uniform float uPunchStrengths[${LIGHT_GLOW_MAX_PUNCHES}];
  uniform vec3 uBillboardNormal;

  float lightGlowRocketPunchVisibility(vec3 worldPos) {
    float vis = 1.0;
    for (int i = 0; i < ${LIGHT_GLOW_MAX_PUNCHES}; i++) {
      if (i >= uPunchCount) break;
      vec3 delta = worldPos - uPunchCenters[i];
      float dist = length(delta - uBillboardNormal * dot(delta, uBillboardNormal));
      float r = uPunchRadii[i];
      float keep = smoothstep(r * 0.028, r * 1.12, dist);
      vis *= mix(1.0, keep, uPunchStrengths[i]);
    }
    return vis;
  }

  float lightGlowPunchPool(vec3 worldPos) {
    float pool = 0.0;
    for (int i = 0; i < ${LIGHT_GLOW_MAX_PUNCHES}; i++) {
      if (i >= uPunchCount) break;
      vec3 delta = worldPos - uPunchCenters[i];
      float dist = length(delta - uBillboardNormal * dot(delta, uBillboardNormal));
      float r = uPunchRadii[i];
      float inner = smoothstep(r * 0.62, r * 0.96, dist);
      float outer = 1.0 - smoothstep(r * 0.98, r * 1.72, dist);
      pool = max(pool, inner * outer * uPunchStrengths[i]);
    }
    return pool;
  }
`;

/**
 * Camera-facing radial glow for map lights in play mode.
 * Fades out only when the player/camera is right on the lamp (small core), not across the whole halo.
 */
export function LightGlowBillboard({
  glowId,
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
        uPunchCount: { value: 0 },
        uPunchCenters: {
          value: Array.from(
            { length: LIGHT_GLOW_MAX_PUNCHES },
            () => new THREE.Vector3(),
          ),
        },
        uPunchRadii: { value: new Float32Array(LIGHT_GLOW_MAX_PUNCHES) },
        uPunchStrengths: { value: new Float32Array(LIGHT_GLOW_MAX_PUNCHES) },
        uBillboardNormal: { value: new THREE.Vector3(0, 0, 1) },
        ...alphaHoleNoiseUniforms(),
        uFloorY: { value: ARENA.floorY },
        uGroundFadeM: { value: MAP_LIGHT_GLOW_GROUND_FADE_M },
        uEditorPreview: { value: editorPreview ? 1 : 0 },
        uTime: { value: 0 },
        uWobbleStrength: { value: 0 },
        uProximityFade: { value: 1 },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uWobbleStrength;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec3 pos = position;
          float spin = uTime * 0.009 * uWobbleStrength;
          float cs = cos(spin);
          float sn = sin(spin);
          vec2 p = pos.xy;
          vec2 spun = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y);
          pos.xy = mix(p, spun, 0.32 * uWobbleStrength);
          float breathe = sin(length(p) * 11.0 - uTime * 0.48) * 0.01 * uWobbleStrength;
          pos.xy *= 1.0 + breathe;
          vec4 world = modelMatrix * vec4(pos, 1.0);
          vWorldPos = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
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
        uniform float uTime;
        uniform float uWobbleStrength;
        uniform float uProximityFade;

        ${LIGHT_GLOW_PUNCH_GLSL}
        ${ALPHA_HOLE_NOISE_GLSL}
        ${GLSL_ALPHA_HOLE_MASK_FUNC}

        vec2 rotateUv(vec2 uv, vec2 center, float angle) {
          vec2 p = uv - center;
          float c = cos(angle);
          float s = sin(angle);
          return vec2(c * p.x - s * p.y, s * p.x + c * p.y) + center;
        }

        void main() {
          vec2 c = vUv - 0.5;
          float spin = uTime * 0.012 * uWobbleStrength;
          // Always-on slow upward drift on smoke noise (single direction).
          vec2 noiseScroll = vec2(0.0, uTime * 0.0372);
          vec2 scrollUv = vUv + noiseScroll;

          vec2 spinUvA = rotateUv(scrollUv, vec2(0.5), spin);
          vec2 spinUvB = rotateUv(scrollUv, vec2(0.5), -spin * 0.72 + 0.35);
          float smokeA = fbm(spinUvA * 4.2);
          float smokeB = fbm(spinUvB * 7.5);
          vec2 smokeWarp = (vec2(smokeA, smokeB) * 2.0 - 1.0) * 0.09 * uWobbleStrength;

          float ang = atan(c.y, c.x);
          float len = length(c);
          float wobblePulse =
            sin(ang * 4.0 + uTime * 0.42) * cos(ang * 2.5 - uTime * 0.34);
          float rippleRing = sin(ang * 7.0 - uTime * 0.38) * 0.35 + 0.65;
          vec2 ripple =
            vec2(cos(ang), sin(ang)) *
            wobblePulse *
            rippleRing *
            0.062 *
            uWobbleStrength *
            len;

          c += smokeWarp + ripple;

          float edgeRipple =
            (fbm(rotateUv(scrollUv, vec2(0.5), spin * 0.45) * 10.0) - 0.5) *
            0.26 * uWobbleStrength;
          float d = length(c) * 2.0 - edgeRipple;
          if (d > 1.0) discard;

          float radial = 1.0 - smoothstep(0.0, 1.0, d);
          radial = pow(radial, 2.05);

          vec2 nUv =
            rotateUv(scrollUv, vec2(0.5), spin * 0.35) * uNoiseScale +
            c * 0.28 +
            smokeWarp * 0.65;
          float holeMask = alphaHoleMask(nUv);
          float rocketPunch = lightGlowRocketPunchVisibility(vWorldPos);
          float punchPool = lightGlowPunchPool(vWorldPos);
          float alpha = radial * uOpacity;
          float holeStr = mix(uHoleStrength, 1.0, (1.0 - uProximityFade) * 0.55);
          alpha *= mix(1.0, holeMask, holeStr);
          alpha *= rocketPunch;
          alpha += punchPool * radial * uOpacity * 0.95;

          float coreDist = length(vUv - 0.5) * 2.0;
          float dissolve = 1.0 - clamp(uProximityFade, 0.0, 1.0);
          if (dissolve > 0.0005) {
            float dissolve2 = dissolve * dissolve;
            vec2 dUv =
              rotateUv(scrollUv, vec2(0.5), spin * 0.1) * 6.8 +
              vec2(dissolve * 2.4, dissolve * 1.1);
            float nCore = fbm(dUv);
            float nRing = fbm(dUv * 1.65 + vec2(4.9, 2.2));

            float front =
              dissolve * mix(0.12, 1.08, dissolve) +
              (nCore - 0.5) * 0.24 * dissolve;
            float r =
              coreDist +
              (nCore - 0.5) * 0.28 * dissolve +
              (nRing - 0.5) * 0.12 * dissolve;

            float eaten = smoothstep(front + 0.14, front - 0.2, r);
            float pit = smoothstep(0.34 * dissolve + nCore * 0.07, 0.0, coreDist);
            float speckle = min(holeMask, mix(nCore, nRing, 0.42));

            float centerBand = 1.0 - smoothstep(0.05, 0.34, abs(vUv.x - 0.5) * 2.0);
            float nVert = fbm(
              vec2(scrollUv.x * 14.0, scrollUv.y * 9.0) +
              vec2(dissolve * 1.8, uTime * 0.03)
            );
            float riseFront =
              dissolve * mix(0.06, 1.02, dissolve) +
              (nVert - 0.5) * 0.2 * dissolve;
            float bottomY = vUv.y + (nVert - 0.5) * 0.1 * dissolve;
            float bottomEaten =
              (1.0 - smoothstep(riseFront - 0.16, riseFront + 0.12, bottomY)) *
              centerBand;
            float columnPit =
              (1.0 - smoothstep(0.04, 0.32 * dissolve + nVert * 0.1, vUv.y)) *
              centerBand;

            float combinedEaten =
              1.0 - (1.0 - eaten) * (1.0 - bottomEaten * 0.96);

            alpha *= mix(1.0, speckle, combinedEaten * (0.62 + dissolve2 * 0.38));
            alpha *= mix(
              1.0,
              min(nCore, speckle) * 0.18 + 0.03,
              max(pit, columnPit) * dissolve
            );
            alpha *= mix(
              1.0,
              holeMask,
              smoothstep(front, front + 0.4, r) * dissolve2 * 0.58
            );
            alpha *= mix(
              1.0,
              min(nVert, speckle),
              smoothstep(riseFront, riseFront + 0.35, bottomY) *
                centerBand *
                dissolve2 *
                0.52
            );
          }

          float aboveFloor = mix(
            smoothstep(uFloorY, uFloorY + uGroundFadeM, vWorldPos.y),
            1.0,
            uEditorPreview
          );
          alpha *= aboveFloor;

          float edgeBreak = smoothstep(0.72, 0.98, d);
          alpha *= mix(1.0, holeMask, edgeBreak * 0.45);
          alpha *= 1.0 + wobblePulse * rippleRing * 0.32 * uWobbleStrength;
          alpha *= mix(1.0, smokeA * 0.55 + smokeB * 0.45 + 0.35, uWobbleStrength * 0.4);

          if (alpha < 0.004) discard;

          vec3 rgb = uColor * (0.24 + radial * 0.76);
          rgb += uColor * (0.18 * uWobbleStrength * (0.4 + wobblePulse * rippleRing * 0.6));
          rgb = mix(rgb, rgb * (0.82 + smokeA * 0.28), uWobbleStrength * 0.32);
          rgb = mix(rgb, vec3(1.0), punchPool * 0.62);
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

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    return registerLightGlowScreen({
      glowId,
      mesh,
      color: material.uniforms.uColor.value as THREE.Color,
    });
  }, [glowId, material]);

  useFrame((state) => {
    const root = worldRef.current;
    if (!root) return;

    const gfx = graphicsStore.getState();
    const mesh = meshRef.current;
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

    const proxFade = editorPreview ? 1 : factor;
    const dissolve = 1 - proxFade;

    material.uniforms.uOpacity.value = opacity;
    material.uniforms.uProximityFade.value = proxFade;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uWobbleStrength.value = 0;
    material.uniforms.uHoleStrength.value =
      MAP_LIGHT_GLOW_ALPHA_HOLE_STRENGTH +
      dissolve * (1 - MAP_LIGHT_GLOW_ALPHA_HOLE_STRENGTH) * 0.95;
    material.uniforms.uHoleCutoff.value =
      MAP_LIGHT_GLOW_ALPHA_HOLE_CUTOFF + dissolve * 0.22;
    material.uniforms.uHoleSoft.value =
      MAP_LIGHT_GLOW_ALPHA_HOLE_SOFT + dissolve * 0.14;
    material.uniforms.uNoiseScale.value = MAP_LIGHT_GLOW_NOISE_SCALE;

    const blend = gfx.mapLightGlowBlendMode ?? 'normal';
    if (material.userData.glowBlend !== blend) {
      applyMapLightGlowBlend(material, blend);
      material.userData.glowBlend = blend;
    }

    if (mesh) {
      mesh.scale.set(glowDiameter, glowDiameter, 1);
      mesh.updateWorldMatrix(true, false);
      _billboardNormal.set(0, 0, 1).transformDirection(mesh.matrixWorld).normalize();
      material.uniforms.uBillboardNormal.value.copy(_billboardNormal);
    }

    const punch = getLightGlowPunchUniforms(glowId, lightGlowPunchNowSec());
    material.uniforms.uPunchCount.value = punch.count;
    const centerUniforms = material.uniforms.uPunchCenters.value as THREE.Vector3[];
    const radiiUniform = material.uniforms.uPunchRadii.value as Float32Array;
    const strengthUniform = material.uniforms.uPunchStrengths.value as Float32Array;
    for (let i = 0; i < LIGHT_GLOW_MAX_PUNCHES; i++) {
      centerUniforms[i].copy(punch.centers[i]);
      radiiUniform[i] = punch.radii[i] ?? 0;
      strengthUniform[i] = punch.strengths[i] ?? 0;
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
