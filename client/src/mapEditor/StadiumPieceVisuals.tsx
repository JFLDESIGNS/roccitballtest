import { useMemo } from 'react';
import * as THREE from 'three';
import { GOAL_RINGS } from '../shared/Constants';
import type { GoalDef } from '../shared/Types';
import { ARENA_PILLAR } from '../game/arenaPillars';
import {
  goalBackCapArenaNudgeM,
  goalBackRingCenterX,
  goalScoreHoleRadius,
  ringTiltX,
  ringTube,
  teamGoalColor,
} from '../game/goals';
import { arenaBlackMetalMaterial, arenaPillarMaterial, goalBackRingMaterial } from '../game/arenaMaterials';

const PILLAR_BAND_HEIGHT = 0.55;
const PILLAR_BAND_RADIUS_SCALE = 1.05;
const PILLAR_LIGHT_INSET = 2.4;
const PILLAR_LIGHT_SIZE = 0.58;
const PILLAR_LIGHT_DEPTH = 0.14;

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

export function StadiumPillarVisual({ pillarX, pillarZ }: { pillarX: number; pillarZ: number }) {
  const yCenter = ARENA_PILLAR.height / 2;
  const halfH = ARENA_PILLAR.height / 2;
  const bandRadius =
    Math.max(ARENA_PILLAR.radiusTop, ARENA_PILLAR.radiusBase) *
    PILLAR_BAND_RADIUS_SCALE;
  const topLightY = halfH - PILLAR_LIGHT_INSET;
  const bottomLightY = -halfH + PILLAR_LIGHT_INSET;

  return (
    <group position={[0, yCenter, 0]}>
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
      <mesh castShadow receiveShadow material={arenaBlackMetalMaterial}>
        <cylinderGeometry args={[bandRadius, bandRadius, PILLAR_BAND_HEIGHT, 20]} />
      </mesh>
      <PillarSquareLight y={topLightY} pillarX={pillarX} pillarZ={pillarZ} />
      <PillarSquareLight y={bottomLightY} pillarX={pillarX} pillarZ={pillarZ} />
    </group>
  );
}

function GoalRingBackplateVisual({
  goal,
}: {
  goal: Pick<GoalDef, 'center' | 'team' | 'size' | 'ringRadius'>;
}) {
  const backRadius = goal.ringRadius * GOAL_RINGS.backRingScale;
  const tube = ringTube(backRadius) * GOAL_RINGS.backRingTubeScale;
  const tiltX = ringTiltX(goal.team, goal.size);
  const backX = goalBackRingCenterX(goal) - goal.center.x;
  const capRadius =
    Math.max(backRadius - tube * 0.92, goalScoreHoleRadius(goal.ringRadius, goal.size) * 0.88) *
    GOAL_RINGS.backRingCapScale;
  const radial = GOAL_RINGS.torusRadialSegments;
  const tubular = GOAL_RINGS.torusTubularSegments;

  const torusGeo = useMemo(
    () => new THREE.TorusGeometry(backRadius, tube, radial, tubular),
    [backRadius, tube, radial, tubular],
  );
  const capGeo = useMemo(
    () => new THREE.CircleGeometry(capRadius, GOAL_RINGS.ringCapSegments),
    [capRadius],
  );
  const capMat = useMemo(() => {
    const m = goalBackRingMaterial.clone();
    m.side = THREE.DoubleSide;
    return m;
  }, []);

  const capArenaNudge = goalBackCapArenaNudgeM(goal.team, goal.size);
  const capTiltX =
    goal.size === 'medium'
      ? 0.2
      : goal.size === 'small'
        ? ringTiltX(goal.team, goal.size) * 0.35
        : 0;

  return (
    <group position={[backX, 0, 0]}>
      <group rotation={[0, Math.PI / 2, 0]}>
        <group rotation={[tiltX, 0, 0]}>
          <mesh geometry={torusGeo} castShadow receiveShadow material={goalBackRingMaterial} />
          <mesh
            geometry={capGeo}
            castShadow
            receiveShadow
            material={capMat}
            position={[capArenaNudge, 0, 0]}
            rotation={[capTiltX, 0, 0]}
          />
        </group>
      </group>
    </group>
  );
}

export function StadiumGoalVisual({ goal }: { goal: GoalDef }) {
  const color = teamGoalColor(goal.team, goal.size);
  const tube = ringTube(goal.ringRadius);
  const glowTube = tube * GOAL_RINGS.glowTubeScale;
  const scoreHalf = goalScoreHoleRadius(goal.ringRadius, goal.size);
  const tiltX = ringTiltX(goal.team, goal.size);
  const radial = GOAL_RINGS.torusRadialSegments;
  const tubular = GOAL_RINGS.torusTubularSegments;

  const torusGeo = useMemo(
    () => new THREE.TorusGeometry(goal.ringRadius, tube, radial, tubular),
    [goal.ringRadius, tube, radial, tubular],
  );
  const glowGeo = useMemo(
    () =>
      new THREE.TorusGeometry(
        goal.ringRadius,
        glowTube,
        GOAL_RINGS.torusRadialSegments,
        GOAL_RINGS.torusTubularSegments,
      ),
    [goal.ringRadius, glowTube],
  );

  return (
    <>
      <GoalRingBackplateVisual goal={goal} />
      <group rotation={[0, Math.PI / 2, 0]}>
        <group rotation={[tiltX, 0, 0]}>
          <mesh geometry={glowGeo} renderOrder={2}>
            <meshBasicMaterial
              color={color}
              transparent
              opacity={GOAL_RINGS.glowOpacity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh geometry={torusGeo} castShadow renderOrder={3}>
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={GOAL_RINGS.emissiveIntensity}
              toneMapped={false}
              metalness={0.15}
              roughness={0.35}
            />
          </mesh>
          <mesh renderOrder={2}>
            <ringGeometry
              args={[
                scoreHalf * 0.75,
                scoreHalf * 1.05,
                GOAL_RINGS.ringCapSegments,
              ]}
            />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.5}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      </group>
    </>
  );
}
