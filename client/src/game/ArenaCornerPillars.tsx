import { CylinderCollider, interactionGroups, RigidBody } from '@react-three/rapier';
import { useMemo } from 'react';
import * as THREE from 'three';
import {
  ARENA_PILLAR,
  getArenaCornerPillarLayouts,
} from './arenaPillars';
import { arenaWallMaterial } from './arenaMaterials';

const RING_COLORS = [
  '#55aaff',
  '#ff6644',
  '#66ddff',
  '#ff8855',
  '#77bbff',
  '#ff5533',
] as const;

function CornerPillar({ x, z, colorIndex }: { x: number; z: number; colorIndex: number }) {
  const ringY = ARENA_PILLAR.height * 0.42;
  const yCenter = ARENA_PILLAR.height / 2;
  const color = RING_COLORS[colorIndex % RING_COLORS.length];

  const ringMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 2.8,
        toneMapped: false,
        metalness: 0.35,
        roughness: 0.25,
      }),
    [color],
  );

  const glowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [color],
  );

  return (
    <group position={[x, ARENA_PILLAR.floorY, z]}>
      <RigidBody type="fixed" colliders={false} position={[0, yCenter, 0]}>
        <CylinderCollider
          args={[ARENA_PILLAR.height / 2, ARENA_PILLAR.colliderRadius]}
          friction={0.32}
          restitution={ARENA_PILLAR.bounceRestitution}
          collisionGroups={interactionGroups(2, [0, 1, 2])}
        />
        <mesh castShadow receiveShadow material={arenaWallMaterial}>
          <cylinderGeometry
            args={[
              ARENA_PILLAR.radiusTop,
              ARENA_PILLAR.radiusBase,
              ARENA_PILLAR.height,
              16,
            ]}
          />
        </mesh>
      </RigidBody>

      <mesh position={[0, ringY, 0]} rotation={[Math.PI / 2, 0, 0]} material={ringMat}>
        <torusGeometry
          args={[
            ARENA_PILLAR.ringMajor,
            ARENA_PILLAR.ringTube,
            8,
            20,
          ]}
        />
      </mesh>
      <mesh
        position={[0, ringY, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        material={glowMat}
      >
        <torusGeometry
          args={[
            ARENA_PILLAR.ringMajor * ARENA_PILLAR.ringGlowScale,
            ARENA_PILLAR.ringTube * 1.6,
            6,
            16,
          ]}
        />
      </mesh>

      <pointLight
        position={[0, ringY, 0]}
        color={color}
        intensity={42}
        distance={26}
        decay={2}
      />
    </group>
  );
}

export function ArenaCornerPillars() {
  const corners = useMemo(() => getArenaCornerPillarLayouts(), []);

  return (
    <group>
      {corners.map((c) => (
        <CornerPillar
          key={`${c.x}-${c.z}`}
          x={c.x}
          z={c.z}
          colorIndex={c.colorIndex}
        />
      ))}
    </group>
  );
}
