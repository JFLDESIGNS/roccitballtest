import * as THREE from 'three';
import { BOT } from '../shared/Constants';
import { ARENA_GOALS } from './goals';
import type { Team } from '../shared/Types';

const _center = new THREE.Vector3();

/** Cylinder around the enemy net — bots inside always shoot at goal. */
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
