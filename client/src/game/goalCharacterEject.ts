import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { BOT, GOAL_RINGS } from '../shared/Constants';
import type { BotCombatState } from './botCombat';
import {
  applyRocketKnockStun,
  armBotGoalEjectMoveLock,
  armBotRocketKnockStun,
  armPlayerGoalEjectMoveLock,
  armPlayerRocketKnockStun,
  type KnockStunKind,
} from './rocketKnockStun';

const _dir = new THREE.Vector3();

function towardCenterZFromPos(z: number): number {
  if (Math.abs(z) < 0.35) return 0;
  return (
    -Math.sign(z) *
    Math.min(GOAL_RINGS.characterEjectCenterZ, Math.abs(z) * 0.5)
  );
}

function ejectKnockForce(kind: KnockStunKind): number {
  const base =
    kind === 'bot'
      ? BOT.rocketKnockForce * GOAL_RINGS.characterEjectBotForceScale
      : GOAL_RINGS.characterEjectForce;
  return base * GOAL_RINGS.characterEjectForceMultiplier;
}

/** Rocket-style launch out of the goal — mostly horizontal away from the wall */
export function applyGoalEjectKnockback(
  body: RapierRigidBody,
  outwardX: number,
  worldZ: number,
  towardCenterZ: number | undefined,
  kind: KnockStunKind,
  combat?: BotCombatState,
): void {
  const zPull = towardCenterZ ?? towardCenterZFromPos(worldZ);
  _dir.set(outwardX, GOAL_RINGS.characterEjectUpBias, zPull).normalize();

  applyRocketKnockStun(body, _dir, ejectKnockForce(kind), kind);

  if (kind === 'player') {
    armPlayerRocketKnockStun();
    armPlayerGoalEjectMoveLock();
  } else if (combat) {
    armBotRocketKnockStun(combat);
    armBotGoalEjectMoveLock(combat);
  }

  const tr = body.translation();
  const nudge = 0.55 * GOAL_RINGS.characterEjectForceMultiplier;
  body.setTranslation(
    { x: tr.x + outwardX * nudge, y: tr.y, z: tr.z },
    true,
  );
}
