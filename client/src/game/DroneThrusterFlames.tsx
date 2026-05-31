import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { MOVEMENT } from '../shared/Constants';
import type { Team } from '../shared/Types';

const FT = 0.3048;
const INCH = FT / 12;

const capHalfH = MOVEMENT.capsuleHeight / 2 - MOVEMENT.capsuleRadius;
const capCenterY = capHalfH + MOVEMENT.capsuleRadius;
const FOOT_Y = -capCenterY;

/** Rear thrusters — drone forward = local −Z (positive Z is aft) */
const THRUSTER_UP_IN = 10;
const THRUSTER_FORWARD_IN = 3;

function thrusterPositions(offsetUpIn = 0, offsetBackIn = 0): [number, number, number][] {
  const y = FOOT_Y + 0.1 + (THRUSTER_UP_IN + offsetUpIn) * INCH;
  const z = 0.28 - THRUSTER_FORWARD_IN * INCH + offsetBackIn * INCH;
  return [
    [-0.4, y, z],
    [0.4, y, z],
  ];
}

const CONE_SIZE_MULT = 1.3 * 1.15;
const CONE_H = 0.4 * CONE_SIZE_MULT;
const CONE_R = 0.13 * CONE_SIZE_MULT;
const DEFAULT_FLAME_FORWARD_PITCH_DEG = 20;
const BOT_FLAME_FORWARD_PITCH_DEG = -42;
const PLAYER_FLAME_FORWARD_PITCH_DEG = -42;

function flameRotation(pitchDeg: number): [number, number, number] {
  const pitch = (pitchDeg * Math.PI) / 180;
  return [Math.PI - 0.14 + pitch, 0, 0];
}

/** Bot / alignment preview nozzle offsets (inches) */
export const BOT_THRUSTER_OFFSET_UP_IN = 4;
export const BOT_THRUSTER_OFFSET_BACK_IN = 8;
/** Flame cone scale for bots — pivots at nozzle (y = 0) so the disc stays put */
export const BOT_THRUSTER_SIZE_SCALE = 1.5;

export { BOT_FLAME_FORWARD_PITCH_DEG, PLAYER_FLAME_FORWARD_PITCH_DEG };

const TEAM_FLAME: Record<
  Team,
  { core: string; glow: string; light: string }
> = {
  blue: { core: '#55ddff', glow: '#1888ff', light: '#66ccff' },
  red: { core: '#ff8866', glow: '#ff3311', light: '#ff6644' },
};

type DroneThrusterFlamesProps = {
  team: Team;
  /** 0 = idle, 1 = full sprint — scales glow and rear lights */
  throttleRef?: React.RefObject<number>;
  /** 0–1 burst on jump — decays in Player.tsx */
  jumpBoostRef?: React.RefObject<number>;
  /** Extra lift on bot thrusters (inches) */
  offsetUpIn?: number;
  /** Shift aft along +Z (inches) — “back” on the drone */
  offsetBackIn?: number;
  /** Pitch cone toward drone forward (−Z), degrees */
  forwardPitchDeg?: number;
  /** Scales flame from nozzle; base/disc stays at attach point (y = 0) */
  sizeScale?: number;
  /** Optional idle dimming for player thrusters; throttle fades back to full strength. */
  idleOpacityScale?: number;
};

/** Glowing flame cones at drone foot thrusters */
export function DroneThrusterFlames({
  team,
  throttleRef,
  jumpBoostRef,
  offsetUpIn = 0,
  offsetBackIn = 0,
  forwardPitchDeg = DEFAULT_FLAME_FORWARD_PITCH_DEG,
  sizeScale = 1,
  idleOpacityScale = 1,
}: DroneThrusterFlamesProps) {
  const colors = TEAM_FLAME[team];
  const groupRef = useRef<THREE.Group>(null);
  const pulseRefs = useRef<THREE.Mesh[]>([]);
  const lightRefs = useRef<THREE.PointLight[]>([]);
  const positions = useMemo(
    () => thrusterPositions(offsetUpIn, offsetBackIn),
    [offsetUpIn, offsetBackIn],
  );
  const flameRot = useMemo(
    () => flameRotation(forwardPitchDeg),
    [forwardPitchDeg],
  );

  const coneGeo = useMemo(() => {
    const geo = new THREE.ConeGeometry(CONE_R, CONE_H, 8, 1, false);
    geo.translate(0, CONE_H / 2, 0);
    return geo;
  }, []);

  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: colors.core,
        transparent: true,
        opacity: 0.48,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [colors.core],
  );

  const glowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: colors.glow,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [colors.glow],
  );

  useFrame(({ clock }) => {
    const throttle = THREE.MathUtils.clamp(throttleRef?.current ?? 0, 0, 1);
    const jumpBoost = THREE.MathUtils.clamp(jumpBoostRef?.current ?? 0, 0, 1);
    const t = clock.elapsedTime;
    const pulse = 0.82 + Math.sin(t * 14) * 0.12;
    const glowPulse = 0.22 + Math.sin(t * 11) * 0.07;
    const jumpGlow = 1 + jumpBoost * 2.4;
    const idleFade = THREE.MathUtils.lerp(
      THREE.MathUtils.clamp(idleOpacityScale, 0, 1),
      1,
      throttle,
    );
    mat.opacity = pulse * 0.52 * (1 + throttle * 0.42) * jumpGlow * idleFade;
    glowMat.opacity =
      glowPulse * 0.48 * (1 + throttle * 0.5) * (1 + jumpBoost * 1.8) * idleFade;
    for (let i = 0; i < pulseRefs.current.length; i++) {
      const m = pulseRefs.current[i];
      if (m) {
        const s =
          (0.92 + Math.sin(t * 18 + i * 1.7) * 0.12 + throttle * 0.22) *
          (1 + jumpBoost * 0.35);
        m.scale.setScalar(s * sizeScale);
      }
    }
    const lightIntensity = (8 + throttle * 14) * (1 + jumpBoost * 2.2) * idleFade;
    const lightReach = (5.5 + throttle * 2.5) * (1 + jumpBoost * 0.35);
    for (let i = 0; i < lightRefs.current.length; i++) {
      const light = lightRefs.current[i];
      if (light) {
        light.intensity = lightIntensity;
        light.distance = lightReach;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {positions.map((pos, i) => (
        <group key={`thruster-${i}`} position={pos}>
          <mesh
            geometry={coneGeo}
            material={glowMat}
            rotation={flameRot}
            scale={[1.5 * sizeScale, sizeScale, 1.5 * sizeScale]}
            renderOrder={104}
          />
          <mesh
            ref={(el) => {
              if (el) pulseRefs.current[i] = el;
            }}
            geometry={coneGeo}
            material={mat}
            rotation={flameRot}
            renderOrder={105}
          />
          <pointLight
            ref={(el) => {
              if (el) lightRefs.current[i] = el;
            }}
            color={colors.light}
            intensity={8}
            distance={5.5}
            decay={2}
            position={[0, 0, 0.06]}
          />
        </group>
      ))}
    </group>
  );
}
