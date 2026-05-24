import { CuboidCollider, CylinderCollider, TrimeshCollider, interactionGroups, RigidBody } from '@react-three/rapier';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ARENA, BALL, RENDER } from '../shared/Constants';
import {
  ARENA_GOALS,
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
  createHexShape,
  hexCornerPositions,
  hexVertices,
  isGoalHexEdge,
  isMidMapWallCorner,
} from './arenaHex';
import { SplitPerimeterWallWithFans } from './ArenaBillboardFans';
import { ArenaCornerPillars } from './ArenaCornerPillars';
import { ArenaCeilingStrip } from './ArenaCeilingStrip';
import { BallDrop } from './BallDrop';
import { OctagonPlatform } from './OctagonPlatform';
import { RocccitLogoStamp } from './RocccitLogoStamp';
import { BackWallEscapeZones } from './BackWallEscapeZones';
import { GoalNetBackstop } from './GoalNetBackstop';
import { ArenaInteractables } from './ArenaInteractables';
import './arenaConcreteTexture';
import { applyPlanarTileUVs } from './arenaConcreteTexture';
import {
  arenaBlackMetalMaterial,
  arenaCeilingMaterial,
  arenaFloorMaterial,
  arenaFloorTileMaterial,
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

  return (
    <RigidBody
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
      <mesh castShadow receiveShadow material={arenaWallMaterial}>
        <boxGeometry args={[length, wallHeight, wallThickness]} />
      </mesh>
    </RigidBody>
  );
}

const GOAL_ENV_COLLISION = interactionGroups(2, [0, 1, 2]);
/** Back-cap square — blocks players/bots in the hole; ball passes through (group 1 excluded). */
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
    <RigidBody
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
    </RigidBody>
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
    () => new THREE.CircleGeometry(capRadius, 32),
    [capRadius],
  );
  const capMat = useMemo(() => {
    const m = arenaBlackMetalMaterial.clone();
    m.side = THREE.DoubleSide;
    return m;
  }, []);

  const capNudgeScale = size === 'medium' ? 0.22 : 0.15;
  const capWallNudgeFt =
    size === 'medium' ? GOAL_RINGS.midRingCapWallOffsetFt : 0;
  const capArenaNudge =
    (team === 'red' ? 1 : -1) *
    (GOAL_RINGS.backRingWallOffsetM * capNudgeScale + capWallNudgeFt * 0.3048);
  const capTiltX =
    size === 'medium' ? 0.2 : size === 'small' ? ringTiltX(team, size) * 0.35 : 0;

  return (
    <RigidBody
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
            collisionGroups={GOAL_ENV_COLLISION}
          />
          <mesh
            geometry={torusGeo}
            castShadow
            receiveShadow
            material={arenaBlackMetalMaterial}
            renderOrder={0}
          />
          <mesh
            geometry={capGeo}
            castShadow
            receiveShadow
            material={capMat}
            position={[capArenaNudge, 0, 0]}
            rotation={[capTiltX, 0, 0]}
            renderOrder={1}
          />
        </group>
      </group>
    </RigidBody>
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
    () => new THREE.TorusGeometry(ringRadius, glowTube, 14, 28),
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
      <RigidBody
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
                collisionGroups={GOAL_ENV_COLLISION}
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
                <ringGeometry args={[scoreHalf * 0.75, scoreHalf * 1.05, 16]} />
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
      </RigidBody>
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
        color="#ff6644"
        intensity={90}
        distance={50}
        decay={2}
      />
      <pointLight
        position={[blueX - 3, midY, 0]}
        color="#4488ff"
        intensity={90}
        distance={50}
        decay={2}
      />
    </>
  );
}

function TeamHalfFloorTint() {
  const { red: redX, blue: blueX } = goalWallPositions();
  return (
    <group position={[0, 0.04, 0]}>
      <mesh
        position={[(redX + 8) / 2, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[hexRadius * 0.9, hexRadius * 1.05]} />
        <meshStandardMaterial
          color="#552218"
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>
      <mesh
        position={[(blueX - 8) / 2, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[hexRadius * 0.9, hexRadius * 1.05]} />
        <meshStandardMaterial
          color="#182a55"
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function HexFloorTiles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const g = new THREE.CircleGeometry(2.1, 6);
    applyPlanarTileUVs(g);
    return g;
  }, []);
  const tileData = useMemo(() => {
    const step = RENDER.hexFloorTileStep;
    const limit = hexRadius - 4;
    const verts = hexVertices(hexRadius - 1);
    const items: { x: number; z: number; even: boolean }[] = [];
    for (let x = -limit; x <= limit; x += step) {
      for (let z = -limit; z <= limit; z += step) {
        if (!isPointInHex(x, z, verts)) continue;
        const even = (Math.round(x / step) + Math.round(z / step)) % 2 === 0;
        items.push({ x, z, even });
      }
    }
    return items;
  }, []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < tileData.length; i++) {
      const t = tileData[i];
      dummy.position.set(t.x, 0.03, t.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [tileData]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, arenaFloorTileMaterial, tileData.length]}
      frustumCulled
    />
  );
}

function isPointInHex(x: number, z: number, verts: THREE.Vector2[]): boolean {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const xi = verts[i].x;
    const zi = verts[i].y;
    const xj = verts[j].x;
    const zj = verts[j].y;
    if (
      zi > z !== zj > z &&
      x < ((xj - xi) * (z - zi)) / (zj - zi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export function Arena({
  hiddenGoalIds = [],
  hiddenPillarIndices = [],
}: {
  hiddenGoalIds?: string[];
  hiddenPillarIndices?: number[];
} = {}) {
  const floorShape = useMemo(() => createHexShape(hexRadius), []);
  const floorGeo = useMemo(() => {
    const geo = new THREE.ExtrudeGeometry(floorShape, {
      depth: 0.2,
      bevelEnabled: false,
    });
    applyPlanarTileUVs(geo);
    return geo;
  }, [floorShape]);
  const wallSegments = useMemo(
    () => buildHexWallSegments(hexRadius, wallThickness),
    [],
  );
  const cornerPlatforms = useMemo(
    () => hexCornerPositions(hexRadius),
    [hexRadius],
  );
  return (
    <group>
      <RigidBody type="fixed" colliders={false} position={[0, 0, 0]}>
        <CuboidCollider
          args={[hexRadius * 0.87, 0.25, hexRadius * 0.87]}
          position={[0, 0.12, 0]}
          friction={0.5}
          restitution={BALL.restitution}
          collisionGroups={interactionGroups(2, [0, 1, 2])}
        />
        <mesh
          geometry={floorGeo}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
          material={arenaFloorMaterial}
        />
      </RigidBody>

      <TeamHalfFloorTint />
      <HexFloorTiles />

      <OctagonPlatform />
      <group
        position={[0, ARENA.platformTopHeight + 0.04, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <RocccitLogoStamp size={16} maxWidth={18} maxHeight={9} />
      </group>
      {cornerPlatforms.map((corner, i) => (
        <OctagonPlatform
          key={`corner-platform-${i}`}
          x={corner.x}
          z={corner.z}
          sizeScale={
            isMidMapWallCorner(corner.x)
              ? ARENA.midWallOctagonSizeScale
              : 1
          }
        />
      ))}
      <BallDrop />
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

      {/* Ceiling collider — stop ball / player flying out the top */}
      <RigidBody type="fixed" colliders={false} position={[0, wallHeight + ARENA.ceilingOverlapM + 0.12, 0]}>
        <CuboidCollider
          args={[hexRadius, 0.25, hexRadius]}
          collisionGroups={interactionGroups(2, [0, 1, 2])}
        />
      </RigidBody>
      <mesh position={[0, wallHeight + ARENA.ceilingOverlapM, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <shapeGeometry args={[floorShape]} />
        <primitive object={arenaCeilingMaterial} attach="material" />
      </mesh>

      <ArenaCeilingStrip />

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
