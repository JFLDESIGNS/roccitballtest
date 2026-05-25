import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { BEAM, BOT } from '../shared/Constants';
import type { FxFollowAnchor, FxWorldPos } from './explosionSplashPool';
import type { Team } from '../shared/Types';
import { playBotHit } from './audio';
import { clearBotKnockStun } from './rocketKnockStun';
import { snapRigidBodyUpright } from './characterVisual';
import type { BotId } from './gameStore';
import type { SafePosition } from './fallRecovery';

export type BotMarkerPhase = 'full' | 'half' | 'hidden';

export type BotCombatState = {
  hitCount: number;
  lastHitAtMs: number;
  lastRegisteredHitMs: number;
  isRagdoll: boolean;
  ragdollUntilMs: number;
  /** Brief rocket knock tumble — not full ragdoll */
  knockStunUntilMs: number;
  /** Goal eject — no bot locomotion (momentum only) */
  goalEjectMoveLockUntilMs: number;
};

export function createBotCombatState(): BotCombatState {
  return {
    hitCount: 0,
    lastHitAtMs: 0,
    lastRegisteredHitMs: 0,
    isRagdoll: false,
    ragdollUntilMs: 0,
    knockStunUntilMs: 0,
    goalEjectMoveLockUntilMs: 0,
  };
}

export function getBotMarkerPhase(combat: BotCombatState): BotMarkerPhase {
  if (combat.isRagdoll) return 'hidden';
  if (combat.hitCount >= 1) {
    const elapsed = performance.now() - combat.lastHitAtMs;
    if (elapsed <= BOT.hitWindowSec * 1000) return 'half';
  }
  return 'full';
}

export type BotCombatTarget = {
  id: BotId;
  team: Team;
  combat: BotCombatState;
  holdingBall: boolean;
  spawn: SafePosition;
  beamLockUntil: number;
  ballDenyUntil: number;
  onRecovered: () => void;
  onRagdollBurst?: (
    anchor: FxWorldPos,
    follow: FxFollowAnchor,
    team: Team,
  ) => void;
};

const _spin = new THREE.Vector3();

function applyRagdollSpin(body: RapierRigidBody): void {
  _spin.set(
    (Math.random() - 0.5) * BOT.ragdollSpinRad,
    (Math.random() - 0.5) * BOT.ragdollSpinRad,
    (Math.random() - 0.5) * BOT.ragdollSpinRad,
  );
  const av = body.angvel();
  body.setAngvel(
    { x: av.x + _spin.x, y: av.y + _spin.y, z: av.z + _spin.z },
    true,
  );
}

export function enterBotRagdoll(body: RapierRigidBody, bot: BotCombatTarget): void {
  const now = performance.now();
  clearBotKnockStun(body, bot.combat);
  bot.combat.isRagdoll = true;
  bot.combat.hitCount = 0;
  bot.combat.lastHitAtMs = 0;
  bot.combat.lastRegisteredHitMs = 0;
  bot.combat.ragdollUntilMs = now + BOT.ragdollDurationSec * 1000;

  body.setEnabledRotations(true, true, true, true);
  body.setGravityScale(BOT.ragdollGravityScale, true);
  body.setAngularDamping(BOT.ragdollAngularDamping);
  body.setLinearDamping(BOT.ragdollLinearDamping);
  applyRagdollSpin(body);

  const t = body.translation();
  const chestOffset = BEAM.chestHeight;
  bot.onRagdollBurst?.(
    { x: t.x, y: t.y + chestOffset, z: t.z },
    () => {
      const tr = body.translation();
      return { x: tr.x, y: tr.y + chestOffset, z: tr.z };
    },
    bot.team,
  );
  playBotHit();

  const denyUntil = now / 1000 + BOT.rocketBallDenySec;
  bot.beamLockUntil = denyUntil;
  bot.ballDenyUntil = denyUntil;
}

export function respawnBotFromRagdoll(
  body: RapierRigidBody,
  bot: BotCombatTarget,
): void {
  bot.combat.isRagdoll = false;
  bot.combat.hitCount = 0;
  bot.combat.lastHitAtMs = 0;
  bot.combat.lastRegisteredHitMs = 0;
  bot.combat.ragdollUntilMs = 0;
  bot.combat.knockStunUntilMs = 0;
  bot.combat.goalEjectMoveLockUntilMs = 0;
  bot.holdingBall = false;

  body.setTranslation(
    { x: bot.spawn.x, y: bot.spawn.y, z: bot.spawn.z },
    true,
  );
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  snapRigidBodyUpright(body);
  body.setGravityScale(0, true);
  body.setAngularDamping(0.2);
  body.setLinearDamping(0);

  bot.onRecovered();
}

/** Local-player hit on an active bot — returns true if bot entered ragdoll */
export function registerPlayerHitOnBot(
  bot: BotCombatTarget,
  body: RapierRigidBody,
): boolean {
  if (bot.combat.isRagdoll) return false;

  const now = performance.now();
  if (now - bot.combat.lastRegisteredHitMs < BOT.hitRegisterCooldownMs) {
    return false;
  }

  const windowMs = BOT.hitWindowSec * 1000;
  if (now - bot.combat.lastHitAtMs > windowMs) {
    bot.combat.hitCount = 0;
  }

  bot.combat.hitCount += 1;
  bot.combat.lastHitAtMs = now;
  bot.combat.lastRegisteredHitMs = now;

  if (bot.combat.hitCount >= BOT.hitsToRagdoll) {
    enterBotRagdoll(body, bot);
    return true;
  }
  return false;
}

/** @returns true while still ragdolling */
export function tickBotRagdoll(
  bot: BotCombatTarget,
  body: RapierRigidBody,
): boolean {
  if (!bot.combat.isRagdoll) return false;
  if (performance.now() < bot.combat.ragdollUntilMs) return true;
  respawnBotFromRagdoll(body, bot);
  return false;
}
