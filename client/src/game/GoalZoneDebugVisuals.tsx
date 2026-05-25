import { useMemo } from 'react';
import { useSyncExternalStore } from 'react';
import * as THREE from 'three';
import {
  ARENA_GOALS,
  GOAL_SCORING_CYLINDER_ROTATION,
  goalScoringCenter,
  goalScoringCylinderParams,
  ringTiltX,
} from './goals';
import { BOT } from '../shared/Constants';
import {
  getNetFinishZoneParams,
  getShootZoneParams,
} from './botShootZone';
import { gameStore } from './gameStore';
import type { GoalDef, Team } from '../shared/Types';

const TEAM_COLORS: Record<Team, { fill: string; edge: string }> = {
  red: { fill: '#ff5544', edge: '#ffaa88' },
  blue: { fill: '#4488ff', edge: '#88ccff' },
};

function DebugZoneCylinder({
  center,
  radius,
  halfHeight,
  fillOpacity,
  edgeOpacity,
  color,
  rotation,
}: {
  center: { x: number; y: number; z: number };
  radius: number;
  halfHeight: number;
  fillOpacity: number;
  edgeOpacity: number;
  color: Team;
  rotation?: [number, number, number];
}) {
  const height = halfHeight * 2;
  const c = TEAM_COLORS[color];

  const fillMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: c.fill,
        transparent: true,
        opacity: fillOpacity,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [c.fill, fillOpacity],
  );

  const edgeGeo = useMemo(() => {
    const cyl = new THREE.CylinderGeometry(radius, radius, height, 40, 1, true);
    return new THREE.EdgesGeometry(cyl);
  }, [radius, height]);

  const edgeMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: c.edge,
        transparent: true,
        opacity: edgeOpacity,
        depthWrite: false,
        toneMapped: false,
      }),
    [c.edge, edgeOpacity],
  );

  const capGeo = useMemo(
    () => new THREE.RingGeometry(radius * 0.92, radius, 40),
    [radius],
  );

  const inner = (
    <>
      <mesh material={fillMat} renderOrder={8}>
        <cylinderGeometry args={[radius, radius, height, 40, 1, true]} />
      </mesh>
      <lineSegments geometry={edgeGeo} material={edgeMat} renderOrder={9} />
      <mesh
        geometry={capGeo}
        material={fillMat}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, halfHeight, 0]}
        renderOrder={8}
      />
      <mesh
        geometry={capGeo}
        material={fillMat}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, -halfHeight, 0]}
        renderOrder={8}
      />
    </>
  );

  if (rotation) {
    return (
      <group position={[center.x, center.y, center.z]} rotation={rotation}>
        {inner}
      </group>
    );
  }

  return <group position={[center.x, center.y, center.z]}>{inner}</group>;
}

function NetFinishZoneMarker({ attackingTeam }: { attackingTeam: Team }) {
  const { center, radius, halfHeight } = useMemo(
    () => getNetFinishZoneParams(attackingTeam),
    [attackingTeam],
  );
  return (
    <DebugZoneCylinder
      center={center}
      radius={radius}
      halfHeight={halfHeight}
      fillOpacity={BOT.netFinishZoneVisualOpacity}
      edgeOpacity={BOT.netFinishZoneEdgeOpacity}
      color={attackingTeam}
    />
  );
}

function ShootZoneMarker({ attackingTeam }: { attackingTeam: Team }) {
  const { center, radius, halfHeight } = useMemo(
    () => getShootZoneParams(attackingTeam),
    [attackingTeam],
  );
  return (
    <DebugZoneCylinder
      center={center}
      radius={radius}
      halfHeight={halfHeight}
      fillOpacity={BOT.shootZoneVisualOpacity}
      edgeOpacity={BOT.shootZoneEdgeOpacity}
      color={attackingTeam}
    />
  );
}

function GoalScoringVolumeMarker({ goal }: { goal: GoalDef }) {
  const { center, radius, halfHeight, tiltX } = useMemo(() => {
    const c = goalScoringCenter(goal);
    const { radius: r, halfHeight: h } = goalScoringCylinderParams(goal);
    return {
      center: c,
      radius: r,
      halfHeight: h,
      tiltX: ringTiltX(goal.team, goal.size),
    };
  }, [goal]);

  return (
    <group position={[center.x, center.y, center.z]}>
      <group rotation={[0, Math.PI / 2, 0]}>
        <group rotation={[tiltX, 0, 0]}>
          <group rotation={GOAL_SCORING_CYLINDER_ROTATION}>
            <DebugZoneCylinder
              center={{ x: 0, y: 0, z: 0 }}
              radius={radius}
              halfHeight={halfHeight}
              fillOpacity={BOT.goalScoringVolumeVisualOpacity}
              edgeOpacity={BOT.goalScoringVolumeEdgeOpacity}
              color={goal.team}
            />
          </group>
        </group>
      </group>
    </group>
  );
}

/** Scoring, shoot, and net-finish zones — hidden unless enabled in tuning menu */
export function GoalZoneDebugVisuals() {
  const visible = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().showGoalZoneDebug,
  );

  if (!visible) return null;

  return (
    <group name="goal-zone-debug">
      <ShootZoneMarker attackingTeam="red" />
      <ShootZoneMarker attackingTeam="blue" />
      <NetFinishZoneMarker attackingTeam="red" />
      <NetFinishZoneMarker attackingTeam="blue" />
      {ARENA_GOALS.map((g) => (
        <GoalScoringVolumeMarker key={`score-vol-${g.id}`} goal={g} />
      ))}
    </group>
  );
}
