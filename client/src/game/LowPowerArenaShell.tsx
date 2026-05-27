import { useMemo } from 'react';
import * as THREE from 'three';
import { ARENA } from '../shared/Constants';
import {
  buildHexWallSegments,
  createArenaHexFloorGeometry,
  isGoalHexEdge,
} from './arenaHex';
import { listOctagonPlatformPlacements } from './arenaOctagonPlatforms';
import { getArenaCornerPillarLayouts } from './arenaPillars';
import { ARENA_PILLAR } from './arenaPillarConfig';

type LowPowerArenaShellProps = {
  hiddenPillarIndices?: number[];
  hiddenPlatformIndices?: number[];
};

const floorMat = new THREE.MeshBasicMaterial({
  color: '#46515d',
  side: THREE.DoubleSide,
  fog: false,
  toneMapped: false,
});

const wallMat = new THREE.MeshBasicMaterial({
  color: '#202932',
  fog: false,
  toneMapped: false,
});

const goalWallMat = new THREE.MeshBasicMaterial({
  color: '#121820',
  fog: false,
  toneMapped: false,
});

const platformMat = new THREE.MeshBasicMaterial({
  color: '#65717d',
  fog: false,
  toneMapped: false,
});

const pillarMat = new THREE.MeshBasicMaterial({
  color: '#7d8790',
  fog: false,
  toneMapped: false,
});

const trimMat = new THREE.MeshBasicMaterial({
  color: '#9fb8d2',
  fog: false,
  toneMapped: false,
});

function LowPowerWall({
  x,
  z,
  y,
  yaw,
  length,
  goal,
}: {
  x: number;
  z: number;
  y: number;
  yaw: number;
  length: number;
  goal: boolean;
}) {
  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]}>
      <mesh material={goal ? goalWallMat : wallMat} renderOrder={8}>
        <boxGeometry args={[length, ARENA.wallHeight, ARENA.wallThickness]} />
      </mesh>
      <mesh
        position={[0, ARENA.wallHeight / 2 + 0.08, 0]}
        material={trimMat}
        renderOrder={9}
      >
        <boxGeometry args={[length, 0.16, ARENA.wallThickness + 0.22]} />
      </mesh>
    </group>
  );
}

function LowPowerPlatform({
  x,
  z,
  sizeScale,
}: {
  x: number;
  z: number;
  sizeScale: number;
}) {
  const radius =
    ARENA.octagonTopRadius *
    ARENA.octagonPlatformSizeMul *
    sizeScale;
  return (
    <mesh
      position={[x, ARENA.platformTopHeight + 0.04, z]}
      rotation={[0, Math.PI / 8, 0]}
      material={platformMat}
      renderOrder={10}
    >
      <cylinderGeometry args={[radius, radius * 1.16, 0.28, 8]} />
    </mesh>
  );
}

function LowPowerPillar({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, ARENA_PILLAR.floorY + ARENA_PILLAR.height / 2, z]}>
      <mesh material={pillarMat} renderOrder={11}>
        <cylinderGeometry
          args={[
            ARENA_PILLAR.radiusTop,
            ARENA_PILLAR.radiusBase,
            ARENA_PILLAR.height,
            14,
          ]}
        />
      </mesh>
      <mesh
        position={[0, ARENA_PILLAR.height / 2 + ARENA_PILLAR.capHeight / 2, 0]}
        material={trimMat}
        renderOrder={12}
      >
        <cylinderGeometry
          args={[
            ARENA_PILLAR.radiusTop * 1.16,
            ARENA_PILLAR.radiusTop * 1.08,
            ARENA_PILLAR.capHeight,
            14,
          ]}
        />
      </mesh>
    </group>
  );
}

export function LowPowerArenaShell({
  hiddenPillarIndices = [],
  hiddenPlatformIndices = [],
}: LowPowerArenaShellProps) {
  const floorGeo = useMemo(
    () => createArenaHexFloorGeometry(ARENA.hexRadius),
    [],
  );
  const wallSegments = useMemo(
    () => buildHexWallSegments(ARENA.hexRadius, ARENA.wallThickness),
    [],
  );
  const platforms = useMemo(
    () =>
      listOctagonPlatformPlacements().filter(
        (_, i) => !hiddenPlatformIndices.includes(i),
      ),
    [hiddenPlatformIndices],
  );
  const pillars = useMemo(
    () =>
      getArenaCornerPillarLayouts().filter(
        (_, i) => !hiddenPillarIndices.includes(i),
      ),
    [hiddenPillarIndices],
  );

  return (
    <group renderOrder={7}>
      <mesh
        geometry={floorGeo}
        material={floorMat}
        position={[0, ARENA.floorY + 0.035, 0]}
        renderOrder={7}
      />
      {wallSegments.map((wall) => (
        <LowPowerWall
          key={`lp-wall-${wall.edgeIndex}`}
          x={wall.x}
          z={wall.z}
          y={wall.y}
          yaw={wall.yaw}
          length={wall.length}
          goal={isGoalHexEdge(wall.edgeIndex)}
        />
      ))}
      {platforms.map((platform, i) => (
        <LowPowerPlatform
          key={`lp-platform-${platform.x}-${platform.z}-${i}`}
          x={platform.x}
          z={platform.z}
          sizeScale={platform.sizeScale}
        />
      ))}
      {pillars.map((pillar, i) => (
        <LowPowerPillar
          key={`lp-pillar-${pillar.x}-${pillar.z}-${i}`}
          x={pillar.x}
          z={pillar.z}
        />
      ))}
    </group>
  );
}
