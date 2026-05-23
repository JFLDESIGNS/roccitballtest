import { CuboidCollider, interactionGroups, RigidBody } from '@react-three/rapier';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ARENA, BALL, RENDER } from '../shared/Constants';
import {
  ARENA_GOALS,
  goalWallPositions,
  goalScoreHoleRadius,
  ringTiltX,
  ringTube,
  stackedRingCenters,
  teamGoalColor,
} from './goals';
import { GOAL_RINGS } from '../shared/Constants';
import type { Team } from '../shared/Types';
import {
  buildHexWallSegments,
  createHexShape,
  hexCornerPositions,
  hexVertices,
  isMidMapWallCorner,
} from './arenaHex';
import { ArenaCornerPillars } from './ArenaCornerPillars';
import { BallDrop } from './BallDrop';
import { OctagonPlatform } from './OctagonPlatform';
import { ShootZones } from './ShootZones';
import { BackWallEscapeZones } from './BackWallEscapeZones';
import {
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
        friction={0.32}
        restitution={BALL.restitution}
        collisionGroups={interactionGroups(2, [0, 1, 2])}
      />
      <mesh castShadow receiveShadow material={arenaWallMaterial}>
        <boxGeometry args={[length, wallHeight, wallThickness]} />
      </mesh>
    </RigidBody>
  );
}

function GoalRing({
  center,
  ringRadius,
  team,
  size,
}: {
  center: { x: number; y: number; z: number };
  ringRadius: number;
  team: Team;
  size: import('../shared/Types').GoalSize;
}) {
  const color = teamGoalColor(team, size);
  const tube = ringTube(ringRadius);
  const glowTube = tube * GOAL_RINGS.glowTubeScale;
  const scoreHalf = goalScoreHoleRadius(ringRadius);
  const tiltX = ringTiltX(team, size);
  const radial = GOAL_RINGS.torusRadialSegments;
  const tubular = GOAL_RINGS.torusTubularSegments;

  const torusGeo = useMemo(
    () => new THREE.TorusGeometry(ringRadius, tube, radial, tubular),
    [ringRadius, tube, radial, tubular],
  );
  const glowGeo = useMemo(
    () => new THREE.TorusGeometry(ringRadius, glowTube, 14, 28),
    [ringRadius, glowTube],
  );

  return (
    <group position={[center.x, center.y, center.z]}>
      <group rotation={[0, Math.PI / 2, 0]}>
        <group rotation={[tiltX, 0, 0]}>
          <mesh geometry={glowGeo}>
            <meshBasicMaterial
              color={color}
              transparent
              opacity={GOAL_RINGS.glowOpacity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh geometry={torusGeo} castShadow>
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={GOAL_RINGS.emissiveIntensity}
              toneMapped={false}
              metalness={0.15}
              roughness={0.35}
            />
          </mesh>
          <mesh>
            <ringGeometry
              args={[scoreHalf * 0.75, scoreHalf * 1.05, 16]}
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
          <CuboidCollider
            sensor
            args={[GOAL_RINGS.sensorDepth / 2, scoreHalf, scoreHalf]}
            collisionGroups={interactionGroups(2)}
          />
        </group>
      </group>
    </group>
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
  const geo = useMemo(() => new THREE.CircleGeometry(2.1, 6), []);
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
    const colA = new THREE.Color('#3d4a5c');
    const colB = new THREE.Color('#354050');
    for (let i = 0; i < tileData.length; i++) {
      const t = tileData[i];
      dummy.position.set(t.x, 0.03, t.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, t.even ? colA : colB);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
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

export function Arena() {
  const floorShape = useMemo(() => createHexShape(hexRadius), []);
  const floorGeo = useMemo(
    () => new THREE.ExtrudeGeometry(floorShape, { depth: 0.2, bevelEnabled: false }),
    [floorShape],
  );
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
      <ShootZones />
      <BackWallEscapeZones />

      {wallSegments.map((w, i) => (
        <PerimeterWall
          key={i}
          x={w.x}
          z={w.z}
          y={w.y}
          yaw={w.yaw}
          length={w.length}
        />
      ))}

      <ArenaCornerPillars />

      {/* Ceiling collider — stop ball / player flying out the top */}
      <RigidBody type="fixed" colliders={false} position={[0, wallHeight + 0.25, 0]}>
        <CuboidCollider
          args={[hexRadius, 0.25, hexRadius]}
          collisionGroups={interactionGroups(2, [0, 1, 2])}
        />
      </RigidBody>
      <mesh position={[0, wallHeight + 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <shapeGeometry args={[floorShape]} />
        <primitive object={arenaCeilingMaterial} attach="material" />
      </mesh>

      <GoalWallAccentLights />

      {ARENA_GOALS.map((g) => (
        <GoalRing
          key={g.id}
          center={g.center}
          ringRadius={g.ringRadius}
          team={g.team}
          size={g.size}
        />
      ))}
    </group>
  );
}
