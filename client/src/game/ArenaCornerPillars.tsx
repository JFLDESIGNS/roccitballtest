import { CylinderCollider, interactionGroups, RigidBody } from '@react-three/rapier';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  ARENA_PILLAR,
  getArenaCornerPillarLayouts,
} from './arenaPillars';
import { arenaBlackMetalMaterial, arenaPillarMaterial } from './arenaMaterials';
import { useArenaVisualOnly } from './arenaVisualOnly';
import { useArenaPillarShake } from './useArenaPillarShake';

const PILLAR_LIGHT_INSET = 2.4;
const PILLAR_LIGHT_SIZE = 0.58;
const PILLAR_LIGHT_DEPTH = 0.14;
const PILLAR_CAP_HEIGHT = ARENA_PILLAR.capHeight;
const PILLAR_CAP_RADIUS_SCALE = 1.14;

function PillarSquareLight({
  y,
  pillarX,
  pillarZ,
}: {
  y: number;
  pillarX: number;
  pillarZ: number;
}) {
  const faceYaw = useMemo(
    () => Math.atan2(-pillarX, -pillarZ),
    [pillarX, pillarZ],
  );
  const surfaceR = useMemo(() => {
    const t =
      (y + ARENA_PILLAR.height / 2) / Math.max(ARENA_PILLAR.height, 0.001);
    return THREE.MathUtils.lerp(
      ARENA_PILLAR.radiusBase,
      ARENA_PILLAR.radiusTop,
      t,
    );
  }, [y]);
  const outward = useMemo(() => {
    const len = Math.hypot(pillarX, pillarZ) || 1;
    return new THREE.Vector3(
      (-pillarX / len) * (surfaceR + PILLAR_LIGHT_DEPTH * 0.35),
      y,
      (-pillarZ / len) * (surfaceR + PILLAR_LIGHT_DEPTH * 0.35),
    );
  }, [pillarX, pillarZ, surfaceR, y]);

  return (
    <mesh position={outward} rotation={[0, faceYaw, 0]} castShadow={false}>
      <boxGeometry args={[PILLAR_LIGHT_SIZE, PILLAR_LIGHT_SIZE, PILLAR_LIGHT_DEPTH]} />
      <meshStandardMaterial
        color="#f0f8ff"
        emissive="#9ad4ff"
        emissiveIntensity={3.2}
        toneMapped={false}
        metalness={0.1}
        roughness={0.25}
      />
    </mesh>
  );
}

function CornerPillar({ x, z }: { x: number; z: number }) {
  const visualOnly = useArenaVisualOnly();
  const visualRef = useRef<THREE.Group>(null);
  const yCenter = ARENA_PILLAR.height / 2;
  const halfH = ARENA_PILLAR.height / 2;
  const topLightY = halfH - PILLAR_LIGHT_INSET;
  const bottomLightY = -halfH + PILLAR_LIGHT_INSET;

  useArenaPillarShake(visualRef, x, z, yCenter);

  return (
    <group
      position={[x, ARENA_PILLAR.floorY, z]}
      userData={{ arenaPillarX: x, arenaPillarZ: z }}
    >
      {!visualOnly && (
        <RigidBody
          type="fixed"
          colliders={false}
          position={[0, yCenter, 0]}
          userData={{ arenaPillarX: x, arenaPillarZ: z }}
        >
          <CylinderCollider
            args={[ARENA_PILLAR.height / 2, ARENA_PILLAR.colliderRadius]}
            friction={0.32}
            restitution={ARENA_PILLAR.bounceRestitution}
            collisionGroups={interactionGroups(2, [0, 1, 2])}
          />
        </RigidBody>
      )}
      <group ref={visualRef} position={[0, yCenter, 0]}>
        <mesh castShadow receiveShadow material={arenaPillarMaterial}>
          <cylinderGeometry
            args={[
              ARENA_PILLAR.radiusTop,
              ARENA_PILLAR.radiusBase,
              ARENA_PILLAR.height,
              16,
            ]}
          />
        </mesh>
        <mesh
          position={[0, halfH + PILLAR_CAP_HEIGHT / 2, 0]}
          castShadow={false}
          receiveShadow={false}
          material={arenaBlackMetalMaterial}
        >
          <cylinderGeometry
            args={[
              ARENA_PILLAR.radiusTop * PILLAR_CAP_RADIUS_SCALE,
              ARENA_PILLAR.radiusTop * PILLAR_CAP_RADIUS_SCALE * 0.96,
              PILLAR_CAP_HEIGHT,
              18,
            ]}
          />
        </mesh>
        <PillarSquareLight y={topLightY} pillarX={x} pillarZ={z} />
        <PillarSquareLight y={bottomLightY} pillarX={x} pillarZ={z} />
      </group>
    </group>
  );
}

export function ArenaCornerPillars({ hiddenIndices = [] }: { hiddenIndices?: number[] } = {}) {
  const corners = useMemo(() => getArenaCornerPillarLayouts(), []);

  return (
    <group>
      {corners.map((c, i) =>
        hiddenIndices.includes(i) ? null : (
          <CornerPillar key={`${c.x}-${c.z}`} x={c.x} z={c.z} />
        ),
      )}
    </group>
  );
}
