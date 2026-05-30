import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { MATCH } from '../shared/Constants';
import type { Team } from '../shared/Types';
import { teamGoalColor } from './goals';
import { gameStore } from './gameStore';
import { isBallDropShaking } from './visualShake';
import {
  ALPHA_HOLE_NOISE_GLSL,
  ALPHA_HOLE_UNIFORM_DECLS_GLSL,
  GLSL_ALPHA_HOLE_MASK_FUNC,
  SPOTLIGHT_CONE_NOISE_WORLD_MUL,
  alphaHoleNoiseUniforms,
} from './alphaHoleNoiseShader';

const DEFAULT_CORE = new THREE.Color('#8ec8ff');
const DEFAULT_GLOW = new THREE.Color('#5aa8e8');
const DEFAULT_LAMP = new THREE.Color('#7ec8ff');

const SWEEP_IDLE = 0.55;
const SWEEP_SCORE = 3.1;
/** Multiplier on cone shader uStrength (0.608 ≈ 24% more transparent than prior 0.8) */
const CONE_BEAM_OPACITY_MUL = 0.608;

type BallDropSpotlightConesProps = {
  /** Half-extent of jumbotron cube (local Y up at structure center) */
  cubeHalf: number;
};

let ballDropSpotFrenzyUntilMs = 0;

/** Trigger when the ball drop spotlights get shot (3s flicker + sparks). */
export function triggerBallDropSpotlightFrenzy(durationMs = 3000): void {
  ballDropSpotFrenzyUntilMs = Math.max(
    ballDropSpotFrenzyUntilMs,
    performance.now() + durationMs,
  );
}

function makeConeFadeMaterial(
  coneH: number,
  tint: THREE.Color,
  baseStrength: number,
  fresnelPower: number,
) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uColor: { value: tint.clone() },
      uConeH: { value: coneH },
      uStrength: { value: baseStrength },
      uFresnelPower: { value: fresnelPower },
      ...alphaHoleNoiseUniforms(),
    },
    vertexShader: /* glsl */ `
      uniform float uConeH;

      varying vec3 vViewPos;
      varying vec3 vNormalV;
      varying float vHeightFade;
      varying vec3 vWorldPos;

      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mv.xyz;
        vNormalV = normalize(normalMatrix * normal);
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;

        float along = clamp(-position.y / uConeH, 0.0, 1.0);
        vHeightFade = 1.0 - along;

        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      uniform float uFresnelPower;
      ${ALPHA_HOLE_UNIFORM_DECLS_GLSL}

      varying vec3 vViewPos;
      varying vec3 vNormalV;
      varying float vHeightFade;
      varying vec3 vWorldPos;

      ${ALPHA_HOLE_NOISE_GLSL}
      ${GLSL_ALPHA_HOLE_MASK_FUNC}

      void main() {
        vec3 viewDir = normalize(vViewPos);
        float fresnel = pow(1.0 - abs(dot(vNormalV, viewDir)), uFresnelPower);

        float heightFade = mix(0.12, 1.0, vHeightFade);
        float rim = mix(0.5, 1.0, fresnel);
        float beam = heightFade * rim;

        vec2 nUv =
          vWorldPos.xz * (uNoiseScale * ${SPOTLIGHT_CONE_NOISE_WORLD_MUL.toFixed(4)}) +
          vec2(vHeightFade * 0.4, vHeightFade * 0.22);
        float holeMask = alphaHoleMask(nUv);

        float alpha = beam * uStrength;
        alpha *= mix(1.0, holeMask, uHoleStrength);

        float edgeBreak = smoothstep(0.15, 0.92, vHeightFade) * (1.0 - fresnel * 0.35);
        alpha *= mix(1.0, holeMask, edgeBreak * 0.45);

        if (alpha < 0.004) discard;

        vec3 col = uColor * beam * (0.85 + fresnel * 0.25);

        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  material.name = `BallDropSpotlightCone-${fresnelPower.toFixed(1)}`;
  return material;
}

function teamSpotColors(team: Team): {
  core: THREE.Color;
  glow: THREE.Color;
  lamp: THREE.Color;
} {
  const hex = teamGoalColor(team, 'medium');
  const core = new THREE.Color(hex);
  const glow = core.clone().multiplyScalar(0.72);
  const lamp = core.clone().lerp(new THREE.Color('#ffffff'), 0.35);
  return { core, glow, lamp };
}

/**
 * Emissive cone spotlights under cube corners ΓÇö sweep rig pivots on cone tip (apex).
 */
export function BallDropSpotlightCones({ cubeHalf }: BallDropSpotlightConesProps) {
  const rigs = useRef<(THREE.Group | null)[]>([]);
  const celebrateUntil = useRef(0);
  const lastCelebId = useRef(-1);
  const sparkPos = useRef<Float32Array>(new Float32Array(48 * 3));
  const sparkVel = useRef<Float32Array>(new Float32Array(48 * 3));
  const sparkLife = useRef<Float32Array>(new Float32Array(48));
  const sparkAttrRef = useRef<THREE.BufferAttribute | null>(null);
  const sparksRef = useRef<THREE.Points>(null);
  const wasShakingRef = useRef(false);

  const goalCelebration = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().goalCelebration,
  );
  const lastScoringTeam = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().lastScoringTeam,
  );

  const coneH = cubeHalf * 1.35 * 2;
  const coneR = cubeHalf * 0.42 * 2;

  const geometry = useMemo(() => {
    const geo = new THREE.ConeGeometry(coneR, coneH, 12, 1, true);
    geo.translate(0, -coneH / 2, 0);
    return geo;
  }, [coneR, coneH]);

  const { material, glowMat } = useMemo(() => {
    const core = makeConeFadeMaterial(
      coneH,
      DEFAULT_CORE,
      0.52 * CONE_BEAM_OPACITY_MUL,
      2.2,
    );
    const glow = makeConeFadeMaterial(
      coneH,
      DEFAULT_GLOW,
      0.28 * CONE_BEAM_OPACITY_MUL,
      1.5,
    );
    return { material: core, glowMat: glow };
  }, [coneH]);

  const cornerLampGeo = useMemo(() => new THREE.SphereGeometry(0.52, 14, 14), []);
  const cornerLampMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#2a4058',
        emissive: DEFAULT_LAMP,
        emissiveIntensity: 4.5,
        toneMapped: false,
        metalness: 0.35,
        roughness: 0.28,
      }),
    [],
  );

  const corners = useMemo(
    (): [number, number, number][] => [
      [cubeHalf, -cubeHalf, cubeHalf],
      [-cubeHalf, -cubeHalf, cubeHalf],
      [cubeHalf, -cubeHalf, -cubeHalf],
      [-cubeHalf, -cubeHalf, -cubeHalf],
    ],
    [cubeHalf],
  );

  const colorScratch = useMemo(
    () => ({
      core: new THREE.Color(),
      glow: new THREE.Color(),
      lamp: new THREE.Color(),
    }),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const frenzy = performance.now() < ballDropSpotFrenzyUntilMs;
    const shaking = isBallDropShaking();

    if (wasShakingRef.current && !shaking) {
      let cleared = false;
      for (let i = 0; i < 48; i++) {
        if (sparkLife.current[i] > 0) {
          sparkLife.current[i] = 0;
          cleared = true;
        }
      }
      if (cleared && sparkAttrRef.current) {
        sparkAttrRef.current.needsUpdate = true;
      }
    }
    wasShakingRef.current = shaking;
    if (sparksRef.current) sparksRef.current.visible = shaking;

    if (
      goalCelebration &&
      goalCelebration.id !== lastCelebId.current &&
      lastScoringTeam
    ) {
      lastCelebId.current = goalCelebration.id;
      celebrateUntil.current =
        t +
        MATCH.postScoreCountdownDelaySec +
        MATCH.resetCountdownSec +
        0.75;
    }

    const celebrating =
      lastScoringTeam != null && t < celebrateUntil.current;
    const teamColors = celebrating
      ? teamSpotColors(lastScoringTeam)
      : null;
    const blend = celebrating
      ? Math.min(1, 0.35 + Math.sin(t * 9) * 0.12)
      : 0;

    const targetCore = teamColors?.core ?? DEFAULT_CORE;
    const targetGlow = teamColors?.glow ?? DEFAULT_GLOW;
    const targetLamp = teamColors?.lamp ?? DEFAULT_LAMP;

    colorScratch.core.copy(DEFAULT_CORE).lerp(targetCore, blend);
    colorScratch.glow.copy(DEFAULT_GLOW).lerp(targetGlow, blend);
    colorScratch.lamp.copy(DEFAULT_LAMP).lerp(targetLamp, blend);

    material.uniforms.uColor.value.copy(colorScratch.core);
    glowMat.uniforms.uColor.value.copy(colorScratch.glow);
    cornerLampMat.emissive.copy(colorScratch.lamp);

    const sweepRate = celebrating || frenzy ? SWEEP_SCORE : SWEEP_IDLE;
    const pitchBase = celebrating ? -0.48 : -0.55;
    const pitchWobble = celebrating ? 0.32 : 0.22;

    rigs.current.forEach((rig, i) => {
      if (!rig) return;
      const phase = t * sweepRate + i * (Math.PI / 2);
      const yaw = Math.sin(phase) * (celebrating ? 0.95 : 0.72);
      const pitch =
        pitchBase + Math.sin(t * (celebrating ? 0.95 : 0.38) + i * 1.1) * pitchWobble;
      rig.rotation.set(pitch, yaw, 0, 'YXZ');
    });

    const pulse = celebrating
      ? 1.05 + Math.sin(t * 11) * 0.18
      : 0.9 + Math.sin(t * 2.4) * 0.1;
    const coreStr = celebrating ? 0.88 : 0.52;
    const glowStr = celebrating ? 0.48 : 0.28;
    material.uniforms.uStrength.value = coreStr * pulse * CONE_BEAM_OPACITY_MUL;
    glowMat.uniforms.uStrength.value = glowStr * pulse * CONE_BEAM_OPACITY_MUL;
    cornerLampMat.emissiveIntensity = celebrating ? 7.5 : 4.5;

    if (shaking) {
      for (let c = 0; c < 4; c++) {
        if (Math.random() > 0.45) continue;
        for (let k = 0; k < 2; k++) {
          let slot = -1;
          for (let i = 0; i < 48; i++) {
            if (sparkLife.current[i] <= 0) {
              slot = i;
              break;
            }
          }
          if (slot < 0) break;
          const base = slot * 3;
          sparkLife.current[slot] = 0.25 + Math.random() * 0.35;
          const cx = corners[c][0];
          const cy = corners[c][1];
          const cz = corners[c][2];
          sparkPos.current[base] = cx + (Math.random() - 0.5) * 0.9;
          sparkPos.current[base + 1] = cy + (Math.random() - 0.5) * 0.6;
          sparkPos.current[base + 2] = cz + (Math.random() - 0.5) * 0.9;
          sparkVel.current[base] = (Math.random() - 0.5) * 10;
          sparkVel.current[base + 1] = 7 + Math.random() * 10;
          sparkVel.current[base + 2] = (Math.random() - 0.5) * 10;
        }
      }
    }

    if (shaking) {
      let any = false;
      for (let i = 0; i < 48; i++) {
        const life = sparkLife.current[i];
        if (life <= 0) continue;
        any = true;
        const base = i * 3;
        sparkLife.current[i] = Math.max(0, life - 0.016);
        sparkVel.current[base + 1] -= 0.38;
        sparkPos.current[base] += sparkVel.current[base] * 0.016;
        sparkPos.current[base + 1] += sparkVel.current[base + 1] * 0.016;
        sparkPos.current[base + 2] += sparkVel.current[base + 2] * 0.016;
      }
      if (any && sparkAttrRef.current) {
        sparkAttrRef.current.needsUpdate = true;
      }
    }
  });

  return (
    <group renderOrder={12}>
      <points ref={sparksRef} renderOrder={14} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            ref={(a) => {
              sparkAttrRef.current = a;
            }}
            attach="attributes-position"
            args={[sparkPos.current, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#bff2ff"
          size={0.22}
          sizeAttenuation
          transparent
          opacity={0.9}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {corners.map((pos, i) => (
        <group key={`drop-cone-${i}`} position={pos}>
          <mesh
            geometry={cornerLampGeo}
            material={cornerLampMat}
            castShadow={false}
            receiveShadow={false}
          />
          <group
            ref={(el) => {
              rigs.current[i] = el;
            }}
          >
            <mesh
              geometry={geometry}
              material={glowMat}
              scale={[1.1, 1.02, 1.1]}
              renderOrder={12}
            />
            <mesh geometry={geometry} material={material} renderOrder={13} />
          </group>
        </group>
      ))}
    </group>
  );
}
