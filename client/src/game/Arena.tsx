import { CuboidCollider, CylinderCollider, TrimeshCollider, interactionGroups } from '@react-three/rapier';
import { MaybeRigidBody } from './maybeRigid';
import { useMemo } from 'react';
import * as THREE from 'three';
import { ARENA, BALL } from '../shared/Constants';
import {
  ARENA_GOALS,
  goalBackCapArenaNudgeM,
  goalBackRingCenterX,
  goalScoringCenter,
  goalScoringCylinderParams,
  GOAL_SCORING_CYLINDER_ROTATION,
  goalWallPositions,
  goalScoreHoleRadius,
  buildTorusTrimesh,
  ringTiltX,
  ringTube,
  stackedRingCenters,
  teamGoalColor,
} from './goals';
import { GOAL_RINGS } from '../shared/Constants';
import type { GoalDef, GoalSize, Team } from '../shared/Types';
import {
  buildHexWallSegments,
  createArenaHexFloorGeometry,
  isGoalHexEdge,
} from './arenaHex';
import { SplitPerimeterWallWithFans } from './ArenaBillboardFans';
import { ArenaCornerPillars } from './ArenaCornerPillars';
import { ArenaCeilingStrip } from './ArenaCeilingStrip';
import { ArenaCeilingImpactWall } from './ArenaCeilingImpactWall';
import { ArenaRetractableRoof } from './ArenaRetractableRoof';
import { ArenaRoofLightBlocker } from './ArenaRoofLightBlocker';
import { WallTopTrim } from './arenaWallTrim';
import { BallDrop } from './BallDrop';
import { OctagonPlatform } from './OctagonPlatform';
import { listOctagonPlatformPlacements } from './arenaOctagonPlatforms';
import { ArenaGoalGroundShadows } from './ArenaGoalGroundShadows';
import { ArenaPlatformGroundShadows } from './ArenaPlatformGroundShadows';
import { RocccitLogoStamp } from './RocccitLogoStamp';
import { BackWallEscapeZones } from './BackWallEscapeZones';
import { GoalNetBackstop } from './GoalNetBackstop';
import { ArenaInteractables } from './ArenaInteractables';
import { GoalZoneDebugVisuals } from './GoalZoneDebugVisuals';
import {
  createMeterTiledBoxGeometry,
} from './arenaConcreteTexture';
import {
  goalBackRingMaterial,
  arenaHexFloorMaterial,
  arenaWallMaterial,
} from './arenaMaterials';

const { hexRadius, wallHeight, wallThickness } = ARENA;

function PerimeterWall({
  x,
  z,
  y,
  yaw,
  length,
}: {
  x: number;
  z: number;
  y: number;
  yaw: number;
  length: number;
}) {
  const h = wallHeight / 2;
  const t = wallThickness / 2;
  const wallGeo = useMemo(
    () => createMeterTiledBoxGeometry(length, wallHeight, wallThickness),
    [length],
  );

  return (
    <MaybeRigidBody
      type="fixed"
      colliders={false}
      position={[x, y, z]}
      rotation={[0, yaw, 0]}
    >
      <CuboidCollider
        args={[length / 2, h, t]}
        friction={0.2}
        restitution={BALL.restitution}
        collisionGroups={interactionGroups(2, [0, 1, 2])}
      />
      <mesh
        castShadow
        receiveShadow
        material={arenaWallMaterial}
        geometry={wallGeo}
      />
      <WallTopTrim length={length} thickness={wallThickness} />
    </MaybeRigidBody>
  );
}

/** Lit goal ring — ball only; players/bots walk through the torus */
const GOAL_LIT_RING_COLLISION = interactionGroups(2, [1, 2]);
/** Black back ring — ball only */
const GOAL_BLACK_RING_COLLISION = interactionGroups(2, [1, 2]);
/** Black hole disc — blocks players/bots; ball passes through */
const GOAL_BACK_CAP_COLLISION = interactionGroups(2, [0, 2]);
const GOAL_RING_RESTITUTION = BALL.restitution * 0.92;
const GOAL_RING_FRICTION = 0.42;

/** Square backup collider behind the hole disc (visible in physics debug). */
function GoalRingBackCapCollider({
  capRadius,
}: {
  capRadius: number;
}) {
  return (
    <CuboidCollider
      args={[capRadius, capRadius, 0.05]}
      friction={0.2}
      restitution={0.82}
      collisionGroups={GOAL_BACK_CAP_COLLISION}
    />
  );
}

/** Scoring slab in front of ring mesh / backplate — matches checkGoalScore volume */
function GoalScoringVolume({
  goal,
}: {
  goal: Pick<GoalDef, 'center' | 'team' | 'size' | 'ringRadius'>;
}) {
  const center = goalScoringCenter(goal);
  const { radius, halfHeight } = goalScoringCylinderParams(goal);
  const tiltX = ringTiltX(goal.team, goal.size);

  return (
    <MaybeRigidBody
      type="fixed"
      colliders={false}
      position={[center.x, center.y, center.z]}
    >
      <group rotation={[0, Math.PI / 2, 0]}>
        <group rotation={[tiltX, 0, 0]}>
          <group rotation={GOAL_SCORING_CYLINDER_ROTATION}>
            <CylinderCollider
              sensor
              args={[halfHeight, radius]}
              collisionGroups={interactionGroups(2, [0, 1])}
            />
          </group>
        </group>
      </group>
    </MaybeRigidBody>
  );
}

/** Black backing ring + center cap behind the lit goal ring */
function GoalRingBackplate({
  goalId: _goalId,
  center,
  ringRadius,
  team,
  size,
}: {
  goalId: string;
  center: { x: number; y: number; z: number };
  ringRadius: number;
  team: Team;
  size: GoalSize;
}) {
  const backRadius = ringRadius * GOAL_RINGS.backRingScale;
  const tube = ringTube(backRadius) * GOAL_RINGS.backRingTubeScale;
  const tiltX = ringTiltX(team, size);
  const backX = goalBackRingCenterX({ center, team, size });
  const capRadius =
    Math.max(backRadius - tube * 0.92, goalScoreHoleRadius(ringRadius, size) * 0.88) *
    GOAL_RINGS.backRingCapScale;
  const capColliderR = goalScoreHoleRadius(ringRadius, size) * 0.38;
  const radial = GOAL_RINGS.torusRadialSegments;
  const tubular = GOAL_RINGS.torusTubularSegments;

  const torusGeo = useMemo(
    () => new THREE.TorusGeometry(backRadius, tube, radial, tubular),
    [backRadius, tube, radial, tubular],
  );
  const backTorusCollider = useMemo(
    () => buildTorusTrimesh(backRadius, tube, radial, tubular),
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

  const capArenaNudge = goalBackCapArenaNudgeM(team, size);
  const capTiltX =
    size === 'medium' ? 0.2 : size === 'small' ? ringTiltX(team, size) * 0.35 : 0;

  return (
    <MaybeRigidBody
      type="fixed"
      colliders={false}
      position={[backX, center.y, center.z]}
    >
      <group rotation={[0, Math.PI / 2, 0]}>
        <group rotation={[tiltX, 0, 0]}>
          <group position={[capArenaNudge, 0, 0]}>
            <GoalRingBackCapCollider capRadius={capColliderR} />
          </group>
          <TrimeshCollider
            args={[backTorusCollider.vertices, backTorusCollider.indices]}
            friction={GOAL_RING_FRICTION}
            restitution={GOAL_RING_RESTITUTION}
            collisionGroups={GOAL_BLACK_RING_COLLISION}
          />
          <mesh
            geometry={torusGeo}
            castShadow={false}
            receiveShadow
            material={goalBackRingMaterial}
            renderOrder={0}
          />
          <mesh
            geometry={capGeo}
            castShadow={false}
            receiveShadow
            material={capMat}
            position={[capArenaNudge, 0, 0]}
            rotation={[capTiltX, 0, 0]}
            renderOrder={1}
          />
        </group>
      </group>
    </MaybeRigidBody>
  );
}

function GoalRing({
  goalId,
  center,
  ringRadius,
  team,
  size,
}: {
  goalId: string;
  center: { x: number; y: number; z: number };
  ringRadius: number;
  team: Team;
  size: GoalSize;
}) {
  const color = teamGoalColor(team, size);
  const tube = ringTube(ringRadius);
  const glowTube = tube * GOAL_RINGS.glowTubeScale;
  const scoreHalf = goalScoreHoleRadius(ringRadius, size);
  const tiltX = ringTiltX(team, size);
  const radial = GOAL_RINGS.torusRadialSegments;
  const tubular = GOAL_RINGS.torusTubularSegments;

  const torusGeo = useMemo(
    () => new THREE.TorusGeometry(ringRadius, tube, radial, tubular),
    [ringRadius, tube, radial, tubular],
  );
  const litTorusCollider = useMemo(
    () => buildTorusTrimesh(ringRadius, tube, radial, tubular),
    [ringRadius, tube, radial, tubular],
  );
  const glowGeo = useMemo(
    () =>
      new THREE.TorusGeometry(
        ringRadius,
        glowTube,
        GOAL_RINGS.torusRadialSegments,
        GOAL_RINGS.torusTubularSegments,
      ),
    [ringRadius, glowTube],
  );

  return (
    <>
      <GoalRingBackplate
        goalId={goalId}
        center={center}
        ringRadius={ringRadius}
        team={team}
        size={size}
      />
      <MaybeRigidBody
        type="fixed"
        colliders={false}
        position={[center.x, center.y, center.z]}
      >
        <group rotation={[0, Math.PI / 2, 0]}>
          <group rotation={[tiltX, 0, 0]}>
            <group>
              <TrimeshCollider
                args={[litTorusCollider.vertices, litTorusCollider.indices]}
                friction={GOAL_RING_FRICTION}
                restitution={GOAL_RING_RESTITUTION}
                collisionGroups={GOAL_LIT_RING_COLLISION}
              />
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
              <mesh geometry={torusGeo} castShadow={false} renderOrder={3}>
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
        </group>
      </MaybeRigidBody>
    </>
  );
}

/** Fill lights on each goal end wall */
function GoalWallAccentLights() {
  const { red: redX, blue: blueX } = goalWallPositions();
  const { midY } = stackedRingCenters();
  return (
    <>
      <pointLight
        position={[redX + 3, midY, 0]}
        color="#ff8866"
        intensity={22}
        distance={36}
        decay={2}
      />
      <pointLight
        position={[blueX - 3, midY, 0]}
        color="#8a9098"
        intensity={10}
        distance={28}
        decay={2}
      />
    </>
  );
}

export function Arena({
  hiddenGoalIds = [],
  hiddenPillarIndices = [],
  hiddenPlatformIndices = [],
}: {
  hiddenGoalIds?: string[];
  hiddenPillarIndices?: number[];
  hiddenPlatformIndices?: number[];
} = {}) {
  const floorGeo = useMemo(
    () => createArenaHexFloorGeometry(hexRadius),
    [hexRadius],
  );
  const wallSegments = useMemo(
    () => buildHexWallSegments(hexRadius, wallThickness),
    [],
  );
  const platformPlacements = useMemo(
    () =>
      listOctagonPlatformPlacements().filter(
        (_, i) => !hiddenPlatformIndices.includes(i),
      ),
    [hexRadius, hiddenPlatformIndices],
  );
  return (
    <group>
      <MaybeRigidBody type="fixed" colliders={false} position={[0, 0, 0]}>
        <CuboidCollider
          args={[hexRadius * 0.87, 0.25, hexRadius * 0.87]}
          position={[0, 0.12, 0]}
          friction={0.5}
          restitution={BALL.restitution}
          collisionGroups={interactionGroups(2, [0, 1, 2])}
        />
        <mesh
          geometry={floorGeo}
          receiveShadow
          castShadow={false}
          material={arenaHexFloorMaterial}
        />
      </MaybeRigidBody>
      <ArenaPlatformGroundShadows />
      <ArenaGoalGroundShadows />

      {platformPlacements.map((placement, i) => (
        <group key={`arena-platform-${placement.x}-${placement.z}-${i}`}>
          <OctagonPlatform
            x={placement.x}
            z={placement.z}
            sizeScale={placement.sizeScale}
          />
          {placement.x === 0 && placement.z === 0 && (
            <group
              position={[0, ARENA.platformTopHeight + 0.04, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <RocccitLogoStamp size={16} maxWidth={18} maxHeight={9} />
            </group>
          )}
        </group>
      ))}
      <BallDrop />
      <GoalZoneDebugVisuals />
      <BackWallEscapeZones />
      <ArenaInteractables />

      {wallSegments.map((w, i) =>
        isGoalHexEdge(w.edgeIndex) ? (
          <PerimeterWall
            key={i}
            x={w.x}
            z={w.z}
            y={w.y}
            yaw={w.yaw}
            length={w.length}
          />
        ) : (
          <SplitPerimeterWallWithFans
            key={i}
            x={w.x}
            z={w.z}
            y={w.y}
            yaw={w.yaw}
            length={w.length}
            edgeIndex={w.edgeIndex}
          />
        ),
      )}

      <ArenaCornerPillars hiddenIndices={hiddenPillarIndices} />

      <ArenaRetractableRoof />
      <ArenaRoofLightBlocker />
      <ArenaCeilingStrip />
      <ArenaCeilingImpactWall />

      <GoalWallAccentLights />

      <GoalNetBackstop />

      {ARENA_GOALS.filter((g) => !hiddenGoalIds.includes(g.id)).map((g) => (
        <GoalRing
          key={g.id}
          goalId={g.id}
          center={g.center}
          ringRadius={g.ringRadius}
          team={g.team}
          size={g.size}
        />
      ))}
      {ARENA_GOALS.filter((g) => !hiddenGoalIds.includes(g.id)).map((g) => (
        <GoalScoringVolume key={`${g.id}-score`} goal={g} />
      ))}
    </group>
  );
}
