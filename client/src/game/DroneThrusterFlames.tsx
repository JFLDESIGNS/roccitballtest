import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { MOVEMENT } from '../shared/Constants';
import type { Team } from '../shared/Types';

const capHalfH = MOVEMENT.capsuleHeight / 2 - MOVEMENT.capsuleRadius;
const capCenterY = capHalfH + MOVEMENT.capsuleRadius;
const FOOT_Y = -capCenterY;

/** Rear thrusters (arena forward = local −Z, exhaust points +Z / down) */
const THRUSTER_LOCAL: [number, number, number][] = [
  [-0.4, FOOT_Y + 0.1, 0.34],
  [0.4, FOOT_Y + 0.1, 0.34],
];

/** Cone tip aims aft (+Z) with slight downward tilt */
const FLAME_ROTATION: [number, number, number] = [-Math.PI / 2 - 0.12, Math.PI, 0];
const FLAME_OFFSET: [number, number, number] = [0, -0.06, 0.22];

const TEAM_FLAME: Record<
  Team,
  { core: string; glow: string; light: string }
> = {
  blue: { core: '#55ddff', glow: '#1888ff', light: '#66ccff' },
  red: { core: '#ff8866', glow: '#ff3311', light: '#ff6644' },
};

type DroneThrusterFlamesProps = {
  team: Team;
};

/** Glowing flame cones at drone foot thrusters */
export function DroneThrusterFlames({ team }: DroneThrusterFlamesProps) {
  const colors = TEAM_FLAME[team];
  const pulseRefs = useRef<THREE.Mesh[]>([]);

  const coneGeo = useMemo(
    () => new THREE.ConeGeometry(0.14, 0.42, 8, 1, true),
    [],
  );

  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: colors.core,
        transparent: true,
        opacity: 0.88,
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
        opacity: 0.38,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [colors.glow],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pulse = 0.82 + Math.sin(t * 14) * 0.18;
    mat.opacity = pulse;
    glowMat.opacity = 0.28 + Math.sin(t * 11) * 0.1;
    for (let i = 0; i < pulseRefs.current.length; i++) {
      const m = pulseRefs.current[i];
      if (m) m.scale.setScalar(0.92 + Math.sin(t * 18 + i * 1.7) * 0.12);
    }
  });

  return (
    <group>
      {THRUSTER_LOCAL.map((pos, i) => (
        <group key={`thruster-${i}`} position={pos}>
          <mesh
            geometry={coneGeo}
            material={glowMat}
            rotation={FLAME_ROTATION}
            position={FLAME_OFFSET}
            scale={[1.55, 1.15, 1.55]}
            renderOrder={104}
          />
          <mesh
            ref={(el) => {
              if (el) pulseRefs.current[i] = el;
            }}
            geometry={coneGeo}
            material={mat}
            rotation={FLAME_ROTATION}
            position={FLAME_OFFSET}
            renderOrder={105}
          />
          <pointLight
            color={colors.light}
            intensity={16}
            distance={5.5}
            decay={2}
            position={[0, -0.04, 0.14]}
          />
        </group>
      ))}
    </group>
  );
}
