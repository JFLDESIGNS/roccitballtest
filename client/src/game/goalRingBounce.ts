import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { BALL, GOAL_RINGS, MOVEMENT } from '../shared/Constants';
import type { BotCombatState } from './botCombat';
import { applyGoalEjectKnockback } from './goalCharacterEject';
import type { KnockStunKind } from './rocketKnockStun';
import {
  ARENA_GOALS,
  ballToGoalRingLocal,
  goalBackCapColliderRadius,
  goalBackCapDiscCenter,
  goalBackRingCenterX,
  goalScoreHoleRadius,
  goalScoringSensorDepth,
  ringTube,
} from './goals';

export type GoalRimContact = {
  outwardX: number;
  goalId: string;
  point: THREE.Vector3;
};

export type GoalRimBallBounceResult = {
  goalId: string;
  impactSpeed: number;
  point: THREE.Vector3;
};

const _sample = new THREE.Vector3();

/** Lit + black torus — ball / rocket swept hits only */
function testGoalTorusRimHit(
  x: number,
  y: number,
  z: number,
  entityRadius: number,
): GoalRimContact | null {
  for (const goal of ARENA_GOALS) {
    const backX = goalBackRingCenterX(goal);
    const { planeDist: litPlane, holeDist } = ballToGoalRingLocal({ x, y, z }, goal);
    const scoringLocal = ballToGoalRingLocal({ x, y, z }, goal, { scoring: true });
    const depth = goalScoringSensorDepth(goal.size);
    const planeDist = Math.min(litPlane, Math.abs(x - backX));
    if (planeDist > depth + entityRadius + 1.2) continue;

    const holeR = goalScoreHoleRadius(goal.ringRadius, goal.size);
    if (scoringLocal.holeDist < holeR + entityRadius * 0.92) continue;

    const litTube = ringTube(goal.ringRadius);
    if (Math.abs(holeDist - goal.ringRadius) <= litTube + entityRadius + 0.2) {
      return {
        outwardX: goal.team === 'red' ? 1 : -1,
        goalId: goal.id,
        point: new THREE.Vector3(x, y, z),
      };
    }

    const backRadius = goal.ringRadius * GOAL_RINGS.backRingScale;
    const backTube = ringTube(backRadius) * GOAL_RINGS.backRingTubeScale;
    if (Math.abs(holeDist - backRadius) <= backTube + entityRadius + 0.25) {
      return {
        outwardX: goal.team === 'red' ? 1 : -1,
        goalId: goal.id,
        point: new THREE.Vector3(x, y, z),
      };
    }
  }
  return null;
}

/** Black back cap disc — player / bot trampoline only */
export function findGoalBackCapDiscHit(
  x: number,
  y: number,
  z: number,
  entityRadius: number,
): GoalRimContact | null {
  for (const goal of ARENA_GOALS) {
    const discCenter = goalBackCapDiscCenter(goal);
    const capR = goalBackCapColliderRadius(goal);
    const depth = goalScoringSensorDepth(goal.size);
    const discLoc = ballToGoalRingLocal({ x, y, z }, { ...goal, center: discCenter });
    const mouthLoc = ballToGoalRingLocal({ x, y, z }, goal);

    if (mouthLoc.planeDist > depth + entityRadius + 1.1) continue;
    if (discLoc.planeDist > 0.62 + entityRadius) continue;
    if (discLoc.holeDist > capR + entityRadius + 0.12) continue;

    return {
      outwardX: goal.team === 'red' ? 1 : -1,
      goalId: goal.id,
      point: new THREE.Vector3(x, y, z),
    };
  }
  return null;
}

/** @deprecated use findGoalBackCapDiscHit for characters */
export function findGoalRimHit(
  x: number,
  y: number,
  z: number,
  entityRadius: number,
): GoalRimContact | null {
  return testGoalTorusRimHit(x, y, z, entityRadius);
}

/** @deprecated use findGoalRimHit */
export function findGoalRimContact(
  x: number,
  y: number,
  z: number,
  entityRadius: number,
): GoalRimContact | null {
  return findGoalRimHit(x, y, z, entityRadius);
}

export function findGoalRimSegmentHit(
  from: THREE.Vector3,
  to: THREE.Vector3,
  entityRadius = 0.45,
): string | null {
  const contact = findGoalRimSegmentContact(from, to, entityRadius);
  return contact?.goalId ?? null;
}

export function findGoalRimSegmentContact(
  from: THREE.Vector3,
  to: THREE.Vector3,
  entityRadius = 0.45,
): GoalRimContact | null {
  const end = findGoalRimHit(to.x, to.y, to.z, entityRadius);
  if (end) return end;

  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    _sample.lerpVectors(from, to, i / steps);
    const hit = findGoalRimHit(_sample.x, _sample.y, _sample.z, entityRadius);
    if (hit) return hit;
  }
  return null;
}

/** Swept rim bounce for fast ball shots (backup to torus trimesh colliders). */
export function tickGoalRimBallBounce(
  body: RapierRigidBody,
  from: THREE.Vector3,
  to: THREE.Vector3,
  cooldownSec: { current: number },
  dt: number,
) : GoalRimBallBounceResult | null {
  cooldownSec.current = Math.max(0, cooldownSec.current - dt);
  if (cooldownSec.current > 0) return null;

  const rim = findGoalRimSegmentContact(from, to, BALL.radius);
  if (!rim) return null;

  const v = body.linvel();
  const impactSpeed = Math.hypot(v.x, v.y, v.z);
  const outward = rim.outwardX;
  const vDot = v.x * outward;
  const rest = GOAL_RINGS.rimBounceRestitution;
  if (vDot < 0) {
    body.setLinvel(
      {
        x: v.x - 2 * vDot * outward * rest,
        y: Math.abs(v.y) * rest * 0.55 + 1.8,
        z: v.z * 0.82,
      },
      true,
    );
  }
  const tr = body.translation();
  body.setTranslation(
    { x: tr.x + outward * 0.35, y: tr.y, z: tr.z },
    true,
  );
  cooldownSec.current = GOAL_RINGS.rimBounceCooldownSec;
  return { goalId: rim.goalId, impactSpeed, point: rim.point };
}

export function goalRimLaunchSpeeds(gravity: number): { vx: number; vy: number } {
  const h = GOAL_RINGS.rimBounceHeightFt * 0.3048;
  const g = Math.abs(gravity);
  const vy = Math.sqrt(2 * g * h);
  const vx = GOAL_RINGS.rimOutwardSpeed;
  return { vx, vy };
}

/** Rocket-style launch away from the goal wall (player / bot). */
export function applyGoalRimLaunchToCharacter(
  body: RapierRigidBody,
  contact: GoalRimContact,
  kind: KnockStunKind,
  combat?: BotCombatState,
): void {
  const tr = body.translation();
  applyGoalEjectKnockback(body, contact.outwardX, tr.z, undefined, kind, combat);
}

export const PLAYER_RIM_PROBE_RADIUS = MOVEMENT.capsuleRadius;

/** Player / bot — bounce only off the black back cap disc (not lit rings). */
export function tickGoalRimCharacterBounce(
  body: RapierRigidBody,
  x: number,
  y: number,
  z: number,
  entityRadius: number,
  cooldownSec: { current: number },
  dt: number,
  kind: KnockStunKind,
  combat?: BotCombatState,
): boolean {
  cooldownSec.current = Math.max(0, cooldownSec.current - dt);
  if (cooldownSec.current > 0) return false;

  const disc = findGoalBackCapDiscHit(x, y, z, entityRadius);
  if (!disc) return false;

  applyGoalRimLaunchToCharacter(body, disc, kind, combat);
  cooldownSec.current = GOAL_RINGS.rimBounceCooldownSec;
  return true;
}
