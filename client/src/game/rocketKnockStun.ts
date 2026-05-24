import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { snapRigidBodyUpright } from './characterVisual';
import { BOT, ROCKET } from '../shared/Constants';
import type { BotCombatState } from './botCombat';
import { gameStore } from './gameStore';

const _flatDir = new THREE.Vector3();

export type KnockStunKind = 'player' | 'bot';
export type KnockStunTick = 'idle' | 'active' | 'ended';

function flattenKnockDirection(dir: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  out.copy(dir);
  out.y *= ROCKET.knockStunVerticalScale;
  const horiz = Math.hypot(out.x, out.z);
  if (horiz < 0.12) {
    out.set(dir.x || 0, out.y, dir.z || 1);
    const h2 = Math.hypot(out.x, out.z);
    if (h2 < 0.12) out.set(0, 0, 1);
    else out.multiplyScalar(1 / h2);
    out.y = Math.min(out.y, 0.12);
  } else {
    out.normalize();
  }
  return out;
}

/** Knockback tumble is visual-only — keep the physics capsule upright */
export function enterRocketKnockStun(
  body: RapierRigidBody,
  kind: KnockStunKind,
): void {
  const linearDamping =
    kind === 'bot' ? BOT.knockStunLinearDamping : ROCKET.knockStunLinearDamping;

  snapRigidBodyUpright(body);
  body.setGravityScale(ROCKET.knockStunGravityScale, true);
  body.setLinearDamping(linearDamping);
  body.setAngularDamping(
    kind === 'bot' ? BOT.knockStunAngularDamping : ROCKET.knockStunAngularDamping,
  );
}

/** Restore damping / gravity after tumble */
export function exitRocketKnockStunPhysics(
  body: RapierRigidBody,
  kind: KnockStunKind,
): void {
  body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  body.setGravityScale(0, true);
  if (kind === 'player') {
    body.setLinearDamping(0.5);
    body.setAngularDamping(0.2);
  } else {
    body.setLinearDamping(0);
    body.setAngularDamping(0.2);
  }
}

/** Snap capsule upright and lock rotations — mesh yaw handled on visual group */
export function exitRocketKnockStunCharacter(
  body: RapierRigidBody,
  kind: KnockStunKind,
): void {
  exitRocketKnockStunPhysics(body, kind);
  snapRigidBodyUpright(body);
}

/** Impulse + brief tumble — mostly horizontal, minimal pop-up */
export function applyRocketKnockStun(
  body: RapierRigidBody,
  dir: THREE.Vector3,
  knockForce: number,
  kind: KnockStunKind,
  inherit?: { x: number; y: number; z: number },
  inheritScale = 0,
): void {
  flattenKnockDirection(dir, _flatDir);
  const lv = body.linvel();
  const impulse = ROCKET.knockStunImpulseScale;
  const f = knockForce * ROCKET.knockStunHorizontalScale * impulse;

  let vx = lv.x + _flatDir.x * f;
  let vz = lv.z + _flatDir.z * f;
  let vy = lv.y + _flatDir.y * f * 0.5;

  if (inherit && inheritScale > 0) {
    vx += inherit.x * inheritScale * impulse;
    vy +=
      inherit.y *
      inheritScale *
      ROCKET.knockStunInheritVerticalScale *
      impulse;
    vz += inherit.z * inheritScale * impulse;
  }

  body.setLinvel({ x: vx, y: vy, z: vz }, true);
  enterRocketKnockStun(body, kind);
}

export function armPlayerRocketKnockStun(): void {
  const until = performance.now() + ROCKET.knockStunSec * 1000;
  const prev = gameStore.getState().playerKnockStunUntilMs;
  gameStore.armPlayerKnockStun(Math.max(until, prev));
}

export type PlayerKnockStunMoveInput = {
  wishX: number;
  wishZ: number;
  walkSpeed: number;
  grounded: boolean;
  dt: number;
};

export function blendPlayerKnockStunMovement(
  body: RapierRigidBody,
  velocity: THREE.Vector3,
  input: PlayerKnockStunMoveInput,
): void {
  const lv = body.linvel();
  velocity.set(lv.x, lv.y, lv.z);

  const wishLen = Math.hypot(input.wishX, input.wishZ);
  if (wishLen > 0.01) {
    const nx = input.wishX / wishLen;
    const nz = input.wishZ / wishLen;
    const blend = input.grounded
      ? ROCKET.knockStunMoveBlend
      : ROCKET.knockStunAirMoveBlend;
    const steerSpeed = input.walkSpeed * blend;
    const targetX = nx * steerSpeed;
    const targetZ = nz * steerSpeed;
    const keep = 1 - blend * 0.5;
    const t = Math.min(1, ROCKET.knockStunSteerAccel * input.dt);
    velocity.x = THREE.MathUtils.lerp(
      velocity.x,
      velocity.x * keep + targetX,
      t,
    );
    velocity.z = THREE.MathUtils.lerp(
      velocity.z,
      velocity.z * keep + targetZ,
      t,
    );
  }

  body.setLinvel(
    { x: velocity.x, y: velocity.y, z: velocity.z },
    true,
  );
}

export function tickPlayerKnockStun(body: RapierRigidBody): KnockStunTick {
  const until = gameStore.getState().playerKnockStunUntilMs;
  if (until <= 0) return 'idle';
  if (performance.now() < until) return 'active';
  gameStore.clearPlayerKnockStun();
  exitRocketKnockStunCharacter(body, 'player');
  return 'ended';
}

export function armBotRocketKnockStun(combat: BotCombatState): void {
  const until = performance.now() + ROCKET.knockStunSec * 1000;
  combat.knockStunUntilMs = Math.max(until, combat.knockStunUntilMs);
}

export function isBotKnockStunActive(combat: BotCombatState): boolean {
  return (
    combat.knockStunUntilMs > 0 &&
    performance.now() < combat.knockStunUntilMs
  );
}

export function isPlayerKnockStunActive(): boolean {
  const until = gameStore.getState().playerKnockStunUntilMs;
  return until > 0 && performance.now() < until;
}

export function tickBotKnockStun(
  body: RapierRigidBody,
  combat: BotCombatState,
): KnockStunTick {
  if (combat.knockStunUntilMs <= 0) return 'idle';
  if (performance.now() < combat.knockStunUntilMs) return 'active';
  combat.knockStunUntilMs = 0;
  exitRocketKnockStunCharacter(body, 'bot');
  return 'ended';
}

export function clearBotKnockStun(
  body: RapierRigidBody,
  combat: BotCombatState,
): void {
  if (combat.knockStunUntilMs <= 0) return;
  combat.knockStunUntilMs = 0;
  exitRocketKnockStunCharacter(body, 'bot');
}
