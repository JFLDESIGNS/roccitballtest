import * as THREE from 'three';
import { ARENA, BOT } from '../shared/Constants';
import { ARENA_GOALS, goalScoringCenter } from './goals';
import type { Team } from '../shared/Types';

const FT = 0.3048;
const _center = new THREE.Vector3();

function defendTeam(attackingTeam: Team): Team {
  return attackingTeam === 'red' ? 'blue' : 'red';
}

/** Cylinder around the enemy net — bots inside always shoot at goal. */
export function getShootZoneParams(attackingTeam: Team): {
  center: { x: number; y: number; z: number };
  radius: number;
  halfHeight: number;
} {
  const c = getShootZoneCenter(attackingTeam);
  const halfHeight = BOT.shootZoneHeightM * 0.5;
  return {
    center: { x: c.x, y: halfHeight, z: c.z },
    radius: BOT.shootZoneRadiusM,
    halfHeight,
  };
}

export function getShootZoneCenter(attackingTeam: Team, out = _center): THREE.Vector3 {
  const defendTeam: Team = attackingTeam === 'red' ? 'blue' : 'red';
  const goals = ARENA_GOALS.filter((g) => g.team === defendTeam);
  const mid = goals.find((g) => g.size === 'medium') ?? goals[0];
  const towardField = attackingTeam === 'red' ? -1 : 1;
  return out.set(
    mid.center.x + towardField * BOT.shootZoneInsetFromWall,
    mid.center.y,
    mid.center.z,
  );
}

export function isInsideShootZone(
  x: number,
  z: number,
  attackingTeam: Team,
): boolean {
  const c = getShootZoneCenter(attackingTeam);
  const dx = x - c.x;
  const dz = z - c.z;
  const r = BOT.shootZoneRadiusM;
  return dx * dx + dz * dz <= r * r;
}

/** Center of the tight finish cylinder — bottom (large) ring mouth */
export function getNetFinishZoneCenter(
  attackingTeam: Team,
  out = _center,
): THREE.Vector3 {
  const goal = ARENA_GOALS.find(
    (g) => g.team === defendTeam(attackingTeam) && g.size === 'large',
  );
  if (!goal) return getShootZoneCenter(attackingTeam, out);
  const c = goalScoringCenter(goal);
  const towardField = attackingTeam === 'red' ? -1 : 1;
  return out.set(
    c.x + towardField * (BOT.netFinishZoneCourtOffsetFt * FT),
    c.y,
    c.z,
  );
}

function netFinishZoneVerticalBounds(): { floorY: number; ceilingY: number } {
  return { floorY: ARENA.floorY, ceilingY: ARENA.wallHeight };
}

export function getNetFinishZoneParams(attackingTeam: Team): {
  center: { x: number; y: number; z: number };
  radius: number;
  halfHeight: number;
  floorY: number;
  ceilingY: number;
} {
  const c = getNetFinishZoneCenter(attackingTeam);
  const { floorY, ceilingY } = netFinishZoneVerticalBounds();
  const halfHeight = (ceilingY - floorY) * 0.5;
  return {
    center: { x: c.x, y: (floorY + ceilingY) * 0.5, z: c.z },
    radius: BOT.netFinishZoneRadiusFt * FT,
    halfHeight,
    floorY,
    ceilingY,
  };
}

/** Finish cylinder at the net — bots with the ball must shoot here */
export function isInsideNetFinishZone(
  x: number,
  y: number,
  z: number,
  attackingTeam: Team,
): boolean {
  const c = getNetFinishZoneCenter(attackingTeam);
  const r = BOT.netFinishZoneRadiusFt * FT;
  const dx = x - c.x;
  const dz = z - c.z;
  if (dx * dx + dz * dz > r * r) return false;
  const { floorY, ceilingY } = netFinishZoneVerticalBounds();
  return y >= floorY && y <= ceilingY;
}
