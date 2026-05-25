import { CylinderCollider, interactionGroups, RigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  ARENA_PILLAR,
  getArenaCornerPillarLayouts,
} from './arenaPillars';
import { arenaBlackMetalMaterial, arenaPillarMaterial } from './arenaMaterials';
import { getArenaPillarShake } from './visualShake';

const PILLAR_LIGHT_INSET = 2.4;
const PILLAR_LIGHT_SIZE = 0.58;
const PILLAR_LIGHT_DEPTH = 0.14;
const PILLAR_BAND_HEIGHT = 0.55;
/** Mid-column disc band — 6% smaller diameter than prior */
const PILLAR_BAND_RADIUS_SCALE = 1.05 * 0.94;
const PILLAR_CAP_HEIGHT = 1.16;
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
  const visualRef = useRef<THREE.Group>(null);
  const yCenter = ARENA_PILLAR.height / 2;
  const halfH = ARENA_PILLAR.height / 2;
  const bandRadius =
    Math.max(ARENA_PILLAR.radiusTop, ARENA_PILLAR.radiusBase) *
    PILLAR_BAND_RADIUS_SCALE;
  const topLightY = halfH - PILLAR_LIGHT_INSET;
  const bottomLightY = -halfH + PILLAR_LIGHT_INSET;

  useFrame(() => {
    const visual = visualRef.current;
    if (!visual) return;
    const { tiltX, tiltZ } = getArenaPillarShake(x, z);
    visual.rotation.set(tiltX, 0, tiltZ);
  });

  return (
    <group position={[x, ARENA_PILLAR.floorY, z]}>
      <RigidBody type="fixed" colliders={false} position={[0, yCenter, 0]}>
        <CylinderCollider
          args={[ARENA_PILLAR.height / 2, ARENA_PILLAR.colliderRadius]}
          friction={0.32}
          restitution={ARENA_PILLAR.bounceRestitution}
          collisionGroups={interactionGroups(2, [0, 1, 2])}
        />
        <group ref={visualRef}>
        <mesh castShadow={false} receiveShadow material={arenaPillarMaterial}>
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
          position={[0, 0, 0]}
          castShadow={false}
          receiveShadow
          material={arenaBlackMetalMaterial}
        >
          <cylinderGeometry
            args={[bandRadius, bandRadius, PILLAR_BAND_HEIGHT, 20]}
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
      </RigidBody>
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
