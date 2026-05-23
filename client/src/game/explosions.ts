import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { ARENA, BALL, BOT, ROCKET } from '../shared/Constants';
import { releaseBallPhysics } from './ballAttach';
import { hexBoundaryNormal, isInsideHex } from './arenaHex';
import { tuningStore } from './tuningStore';
import { splashDamageFactor } from './rocketSystem';

export type ExplosionHit = {
  x: number;
  y: number;
  z: number;
  radius: number;
  /** Rocket travel direction on direct ball hits */
  rocketVx?: number;
  rocketVy?: number;
  rocketVz?: number;
};

const _dir = new THREE.Vector3();
const _impulse = new THREE.Vector3();
const _knockDir = new THREE.Vector3();

/** If knock points into the hex wall, reflect horizontal so pinned balls still fly off */
function reflectBallKnockOffArenaWall(
  ballX: number,
  ballZ: number,
  knockDir: THREE.Vector3,
): void {
  const playR = ARENA.hexRadius - 2;
  if (isInsideHex(ballX, ballZ, playR - 1.2)) return;

  const n = hexBoundaryNormal(ballX, ballZ, playR);
  const intoWall = knockDir.x * n.x + knockDir.z * n.y;
  if (intoWall <= 0.05) return;

  knockDir.x -= 2 * intoWall * n.x;
  knockDir.z -= 2 * intoWall * n.y;
  if (knockDir.lengthSq() > 1e-6) knockDir.normalize();
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
): boolean {
  const dx = ballX - ex;
  const dy = ballY - ey;
  const dz = ballZ - ez;
  const dist = Math.hypot(dx, dy, dz);
  if (dist >= radius) return false;

  if (wasHeld) releaseBallPhysics(ball);

  const knock = tuningStore.getState().ballKnockStrength;
  const falloff = Math.max(ROCKET.ballSplashMinFalloff, 1 - dist / radius);
  const heightAboveFloor = ballY - ARENA.floorY - BALL.radius;
  const inAir = heightAboveFloor > ROCKET.ballAirMinHeight;
  const airMult = inAir ? ROCKET.ballAirKnockMult : 1;
  const hasRocket =
    rocketVx !== undefined && rocketVy !== undefined && rocketVz !== undefined;
  const rocketSpeed = hasRocket
    ? Math.hypot(rocketVx!, rocketVy!, rocketVz!)
    : 0;
  const directRocket =
    hasRocket && rocketSpeed > 6 && dist < radius * 0.9;

  const lv = ball.linvel();
  const upScale =
    (inAir ? ROCKET.ballAirUpMult : 1) * (inAir ? 0.9 : 0.7);

  if (directRocket) {
    _dir.set(rocketVx!, rocketVy!, rocketVz!).normalize();
    reflectBallKnockOffArenaWall(ballX, ballZ, _dir);
    const transfer =
      rocketSpeed *
      ROCKET.ballRocketMomentumTransfer *
      falloff *
      knock *
      airMult;
    let tx = lv.x + _dir.x * transfer;
    let ty = lv.y + _dir.y * transfer;
    let tz = lv.z + _dir.z * transfer;
    ty += ROCKET.ballUpBoost * falloff * knock * upScale * 0.4;

    _knockDir.copy(_dir);
    const along = tx * _knockDir.x + ty * _knockDir.y + tz * _knockDir.z;
    const minKnock = ROCKET.ballMinKnockSpeed * falloff * knock * airMult;
    if (along < minKnock) {
      const boost = (minKnock - along) * 0.92;
      tx += _knockDir.x * boost;
      ty += _knockDir.y * boost;
      tz += _knockDir.z * boost;
    }

    const blend = Math.min(1, ROCKET.ballKnockBlend * knock);
    ball.setLinvel(
      {
        x: lv.x + (tx - lv.x) * blend,
        y: lv.y + (ty - lv.y) * blend,
        z: lv.z + (tz - lv.z) * blend,
      },
      true,
    );
    return true;
  }

  _dir.set(dx, dy, dz);
  if (_dir.lengthSq() < 0.5 && hasRocket) {
    if (rocketSpeed > 4) _dir.set(rocketVx!, rocketVy!, rocketVz!);
  }
  if (_dir.lengthSq() < 0.01) _dir.set(0, 0.35, 0);
  _dir.normalize();
  reflectBallKnockOffArenaWall(ballX, ballZ, _dir);

  const inheritScale =
    ROCKET.ballVelocityInherit *
    (inAir ? ROCKET.ballAirVelocityInheritMult : 1);
  const force = ROCKET.ballForce * falloff * knock * airMult;
  _impulse.copy(_dir).multiplyScalar(force);
  if (hasRocket) {
    _impulse.x += rocketVx! * inheritScale * falloff * knock * airMult;
    _impulse.y += rocketVy! * inheritScale * falloff * knock * airMult;
    _impulse.z += rocketVz! * inheritScale * falloff * knock * airMult;
  }

  let tx = lv.x + _impulse.x;
  let ty = lv.y + _impulse.y + ROCKET.ballUpBoost * falloff * knock * upScale;
  let tz = lv.z + _impulse.z;

  _knockDir.copy(_impulse);
  if (_knockDir.lengthSq() < 1e-6) _knockDir.set(0, 0.35, 1);
  _knockDir.normalize();

  const along = tx * _knockDir.x + ty * _knockDir.y + tz * _knockDir.z;
  const minKnock = ROCKET.ballMinKnockSpeed * falloff * knock * airMult;
  if (along < minKnock) {
    const boost = (minKnock - along) * 0.92;
    tx += _knockDir.x * boost;
    ty += _knockDir.y * boost;
    tz += _knockDir.z * boost;
  }

  let blend = ROCKET.ballKnockBlend * Math.min(1, falloff * 1.15) * knock;
  if (inAir) blend = Math.min(1, blend * 1.06);
  const x = lv.x + (tx - lv.x) * blend;
  const y = lv.y + (ty - lv.y) * blend;
  const z = lv.z + (tz - lv.z) * blend;

  ball.setLinvel({ x, y, z }, true);
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
  const dx = px - ex;
  const dy = py - ey;
  const dz = pz - ez;
  const dist = Math.hypot(dx, dy, dz);
  if (dist >= radius) return { damage: 0, rocketJump: false };

  if (dx * dx + dy * dy + dz * dz < 0.01) _dir.set(0, 1, 0);
  else _dir.set(dx, dy, dz).normalize();

  const falloff = Math.max(ROCKET.ballSplashMinFalloff, 1 - dist / radius);
  const hForce = ROCKET.playerForce * falloff * forceScale;
  const upBoost = ROCKET.rocketJumpUp * falloff * forceScale;
  const linvel = player.linvel();

  let vx = linvel.x + _dir.x * hForce;
  let vy = Math.max(linvel.y + _dir.y * hForce * 0.5, 0) + upBoost;
  let vz = linvel.z + _dir.z * hForce;

  if (
    rocketVx !== undefined &&
    rocketVy !== undefined &&
    rocketVz !== undefined
  ) {
    vx += rocketVx * ROCKET.velocityInherit * 0.35 * falloff * forceScale;
    vy += rocketVy * 0.2 * falloff * forceScale;
    vz += rocketVz * ROCKET.velocityInherit * 0.35 * falloff * forceScale;
  }

  player.setLinvel({ x: vx, y: vy, z: vz }, true);

  return {
    damage: splashDamageFactor(dist),
    rocketJump: upBoost > 2,
  };
}

/** Blast or direct rocket knockback on a bot capsule */
export function applyExplosionToBot(
  bot: RapierRigidBody,
  bx: number,
  by: number,
  bz: number,
  ex: number,
  ey: number,
  ez: number,
  radius: number,
  rocketVx?: number,
  rocketVy?: number,
  rocketVz?: number,
): boolean {
  const dx = bx - ex;
  const dy = by - ey;
  const dz = bz - ez;
  const dist = Math.hypot(dx, dy, dz);
  if (dist >= radius + BOT.rocketHitRadius) return false;

  const falloff = Math.max(0.25, 1 - dist / radius);
  const hasRocket =
    rocketVx !== undefined && rocketVy !== undefined && rocketVz !== undefined;

  if (dx * dx + dy * dy + dz * dz < 0.01) {
    if (hasRocket) _dir.set(rocketVx!, rocketVy!, rocketVz!).normalize();
    else _dir.set(0, 0.4, 1);
  } else {
    _dir.set(dx, dy, dz).normalize();
  }

  const hForce = BOT.rocketKnockForce * falloff;
  const upBoost = BOT.rocketKnockUp * falloff;
  const lv = bot.linvel();

  let x = lv.x + _dir.x * hForce;
  let y = Math.max(lv.y, 0) + _dir.y * hForce * 0.35 + upBoost;
  let z = lv.z + _dir.z * hForce;

  if (hasRocket) {
    x += rocketVx! * 0.35 * falloff;
    y += rocketVy! * 0.2 * falloff;
    z += rocketVz! * 0.35 * falloff;
  }

  bot.setLinvel({ x, y, z }, true);
  return true;
}

/** Direct rocket body hit (before explosion) */
export function applyDirectRocketToBot(
  bot: RapierRigidBody,
  rocketVx: number,
  rocketVy: number,
  rocketVz: number,
): void {
  const lv = bot.linvel();
  bot.setLinvel(
    {
      x: lv.x + rocketVx * 0.45 + rocketVx / (Math.hypot(rocketVx, rocketVz) + 0.01) * 10,
      y: Math.max(lv.y, 0) + rocketVy * 0.25 + BOT.rocketKnockUp * 0.65,
      z: lv.z + rocketVz * 0.45 + rocketVz / (Math.hypot(rocketVx, rocketVz) + 0.01) * 10,
    },
    true,
  );
}
