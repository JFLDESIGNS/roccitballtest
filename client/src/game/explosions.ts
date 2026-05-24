import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { BOT, ROCKET, SUPERBALL } from '../shared/Constants';
import { releaseBallPhysics } from './ballAttach';
import { canKnockLooseHeldBall } from './ballHoldImmunity';
import { wakeBallBody } from './ballPhysics';
import {
  applyRocketKnockStun,
  armBotRocketKnockStun,
  armPlayerRocketKnockStun,
} from './rocketKnockStun';
import type { BotCombatState } from './botCombat';
import {
  ballRocketKnockDirection,
  superballCenterHitFactor,
} from './ballRocketKnock';
import { tuningStore } from './tuningStore';
import { splashDamageFactor } from './rocketSystem';

export type ExplosionHit = {
  x: number;
  y: number;
  z: number;
  radius: number;
  rocketVx?: number;
  rocketVy?: number;
  rocketVz?: number;
  /** Outward surface normal at ball contact (superball billiards knock) */
  ballImpactNx?: number;
  ballImpactNy?: number;
  ballImpactNz?: number;
  /** Rocket owner when the blast came from a projectile */
  fromOwnerId?: string;
};

const _dir = new THREE.Vector3();
const _inherit = new THREE.Vector3();

/** Prefer rocket travel axis; otherwise push target away from blast center. */
function knockDirection(
  tx: number,
  ty: number,
  tz: number,
  ex: number,
  ey: number,
  ez: number,
  rocketVx?: number,
  rocketVy?: number,
  rocketVz?: number,
): THREE.Vector3 {
  return ballRocketKnockDirection(
    'original',
    tx,
    ty,
    tz,
    ex,
    ey,
    ez,
    rocketVx,
    rocketVy,
    rocketVz,
  );
}

export function applyExplosionToBall(
  ball: RapierRigidBody,
  ballX: number,
  ballY: number,
  ballZ: number,
  ex: number,
  ey: number,
  ez: number,
  radius: number,
  wasHeld: boolean,
  rocketVx?: number,
  rocketVy?: number,
  rocketVz?: number,
  ballImpactNx?: number,
  ballImpactNy?: number,
  ballImpactNz?: number,
): boolean {
  const dx = ballX - ex;
  const dy = ballY - ey;
  const dz = ballZ - ez;
  const dist = Math.hypot(dx, dy, dz);
  if (dist >= radius) return false;

  if (wasHeld && canKnockLooseHeldBall()) releaseBallPhysics(ball);
  else if (wasHeld) return false;

  const tune = tuningStore.getState();
  const knock = tune.ballKnockStrength;

  if (tune.ballType === 'superball') {
    const falloff = Math.max(SUPERBALL.knockMinFalloff, 1 - dist / radius);
    const directT =
      dist < SUPERBALL.directHitDist
        ? 1 - dist / SUPERBALL.directHitDist
        : 0;
    const directBoost = 1 + directT * 0.95;

    const dir = ballRocketKnockDirection(
      'superball',
      ballX,
      ballY,
      ballZ,
      ex,
      ey,
      ez,
      rocketVx,
      rocketVy,
      rocketVz,
      ballImpactNx,
      ballImpactNy,
      ballImpactNz,
    );

    const hasRocket =
      rocketVx !== undefined &&
      rocketVy !== undefined &&
      rocketVz !== undefined;
    const rocketSpeed = hasRocket
      ? Math.hypot(rocketVx!, rocketVy!, rocketVz!)
      : 0;

    let deltaV =
      SUPERBALL.hitImpulse *
      falloff *
      knock *
      directBoost *
      SUPERBALL.knockScale;

    if (hasRocket && rocketSpeed > 1) {
      const centerFactor = superballCenterHitFactor(
        ballImpactNx,
        ballImpactNy,
        ballImpactNz,
        rocketVx,
        rocketVy,
        rocketVz,
      );
      deltaV += rocketSpeed * SUPERBALL.rocketSpeedInherit * falloff * centerFactor;
    }

    const lv = ball.linvel();
    let nx = lv.x + dir.x * deltaV;
    let ny = lv.y + dir.y * deltaV;
    let nz = lv.z + dir.z * deltaV;
    const spd = Math.hypot(nx, ny, nz);
    if (spd > SUPERBALL.maxSpeed) {
      const s = SUPERBALL.maxSpeed / spd;
      nx *= s;
      ny *= s;
      nz *= s;
    }
    ball.setLinvel({ x: nx, y: ny, z: nz }, true);
  } else {
    const falloff = Math.max(0.2, 1 - dist / radius);
    const mass = ball.mass();
    const dir = ballRocketKnockDirection(
      'original',
      ballX,
      ballY,
      ballZ,
      ex,
      ey,
      ez,
      rocketVx,
      rocketVy,
      rocketVz,
    );
    const deltaV = ROCKET.ballHitImpulse * falloff * knock;
    ball.applyImpulse(
      {
        x: dir.x * deltaV * mass,
        y: dir.y * deltaV * mass,
        z: dir.z * deltaV * mass,
      },
      true,
    );
  }

  wakeBallBody(ball);
  return true;
}

export function applyExplosionToPlayer(
  player: RapierRigidBody,
  px: number,
  py: number,
  pz: number,
  ex: number,
  ey: number,
  ez: number,
  radius: number,
  forceScale = 1,
  rocketVx?: number,
  rocketVy?: number,
  rocketVz?: number,
): { damage: number; rocketJump: boolean } {
  const dist = Math.hypot(px - ex, py - ey, pz - ez);
  if (dist >= radius) return { damage: 0, rocketJump: false };

  const falloff = Math.max(ROCKET.ballSplashMinFalloff, 1 - dist / radius);
  const knock = ROCKET.playerForce * falloff * forceScale;

  const dir = knockDirection(px, py, pz, ex, ey, ez, rocketVx, rocketVy, rocketVz);

  const inheritScale = ROCKET.velocityInherit * 0.38 * falloff * forceScale;
  if (rocketVx !== undefined) {
    _inherit.set(rocketVx, rocketVy ?? 0, rocketVz ?? 0);
  }

  applyRocketKnockStun(
    player,
    dir,
    knock,
    'player',
    rocketVx !== undefined ? _inherit : undefined,
    inheritScale,
  );
  armPlayerRocketKnockStun();

  return {
    damage: splashDamageFactor(dist),
    rocketJump: true,
  };
}

export function applyExplosionToBot(
  bot: RapierRigidBody,
  bx: number,
  by: number,
  bz: number,
  ex: number,
  ey: number,
  ez: number,
  radius: number,
  combat: BotCombatState,
  rocketVx?: number,
  rocketVy?: number,
  rocketVz?: number,
): boolean {
  const dist = Math.hypot(bx - ex, by - ey, bz - ez);
  if (dist >= radius + BOT.rocketHitRadius) return false;

  const falloff = Math.max(0.25, 1 - dist / radius);
  const knock = BOT.rocketKnockForce * falloff;

  const dir = knockDirection(bx, by, bz, ex, ey, ez, rocketVx, rocketVy, rocketVz);

  const inheritScale = 0.32 * falloff;
  if (rocketVx !== undefined) {
    _inherit.set(rocketVx, rocketVy ?? 0, rocketVz ?? 0);
  }

  applyRocketKnockStun(
    bot,
    dir,
    knock,
    'bot',
    rocketVx !== undefined ? _inherit : undefined,
    inheritScale,
  );
  armBotRocketKnockStun(combat);
  return true;
}

export function applyDirectRocketToBot(
  bot: RapierRigidBody,
  rocketVx: number,
  rocketVy: number,
  rocketVz: number,
  combat: BotCombatState,
): void {
  const speed = Math.hypot(rocketVx, rocketVy, rocketVz) || 1;
  _dir.set(rocketVx / speed, rocketVy / speed, rocketVz / speed);
  applyRocketKnockStun(
    bot,
    _dir,
    BOT.rocketKnockForce * 0.82,
    'bot',
    { x: rocketVx, y: rocketVy, z: rocketVz },
    0.28,
  );
  armBotRocketKnockStun(combat);
}

export function applyDirectRocketToPlayer(
  player: RapierRigidBody,
  rocketVx: number,
  rocketVy: number,
  rocketVz: number,
): { damage: number; rocketJump: boolean } {
  const speed = Math.hypot(rocketVx, rocketVy, rocketVz) || 1;
  _dir.set(rocketVx / speed, rocketVy / speed, rocketVz / speed);
  applyRocketKnockStun(
    player,
    _dir,
    ROCKET.playerDirectKnock,
    'player',
    { x: rocketVx, y: rocketVy, z: rocketVz },
    0.32,
  );
  armPlayerRocketKnockStun();
  return { damage: ROCKET.energyDamageDirect, rocketJump: true };
}
