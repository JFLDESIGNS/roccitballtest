import * as THREE from 'three';
import { ARENA, BOT } from '../shared/Constants';
import {
  clampToHex,
  hexBoundaryNormal,
  isInsideHex,
} from './arenaHex';
import { goalEndFaceX } from './goals';
import { isInsideShootZone } from './botShootZone';
import type { Team } from '../shared/Types';

export type BotStuckState = {
  sampleX: number;
  sampleZ: number;
  stuckSec: number;
  escapeCooldown: number;
};

export function createBotStuckState(x: number, z: number): BotStuckState {
  return { sampleX: x, sampleZ: z, stuckSec: 0, escapeCooldown: 0 };
}

const _normal = new THREE.Vector2();
const _escapeWish = new THREE.Vector3();

export type BackWallSide = 'red' | 'blue';

const _backWallCooldown = { red: 0, blue: 0 };

/** Goal back-wall steer box (flat face ±X, depth into the field). */
export function whichBackWallEscapeZone(
  x: number,
  z: number,
): BackWallSide | null {
  const face = goalEndFaceX();
  const depth = BOT.backWallEscapeDepthM;
  const zHalf = BOT.backWallEscapeHalfWidthZ;
  if (Math.abs(z) > zHalf) return null;

  const redWallX = -face;
  if (x >= redWallX && x <= redWallX + depth) return 'red';

  const blueWallX = face;
  if (x <= blueWallX && x >= blueWallX - depth) return 'blue';

  return null;
}

/** Soft push so bots do not hug the goal back wall (~15 ft buffer). */
export function tickBotBackWallKeepOut(
  pos: THREE.Vector3,
  wish: THREE.Vector3,
  attackingTeam: Team | null = null,
): void {
  if (attackingTeam && isInsideShootZone(pos.x, pos.z, attackingTeam)) {
    return;
  }
  const face = goalEndFaceX();
  const keep = BOT.backWallKeepOutFromWallM;
  const zHalf = BOT.backWallKeepOutHalfWidthZ;
  if (Math.abs(pos.z) > zHalf) return;

  const redFace = -face;
  if (pos.x < redFace + keep) {
    wish.x = Math.max(wish.x, 0.72);
    if (wish.lengthSq() > 0.01) wish.normalize();
    return;
  }

  const blueFace = face;
  if (pos.x > blueFace - keep) {
    wish.x = Math.min(wish.x, -0.72);
    if (wish.lengthSq() > 0.01) wish.normalize();
  }
}

/** Clamp dribble targets so bots do not path into the back-wall keep-out band. */
export function clampMoveTargetFromBackWall(
  target: THREE.Vector3,
  attackingTeam: Team | null = null,
): void {
  const face = goalEndFaceX();
  const inShootZone =
    attackingTeam !== null &&
    isInsideShootZone(target.x, target.z, attackingTeam);
  const keep = inShootZone
    ? BOT.goalApproachKeepFromWallM
    : BOT.backWallKeepOutFromWallM;
  const minX = -face + keep;
  const maxX = face - keep;
  if (target.x < minX) target.x = minX;
  if (target.x > maxX) target.x = maxX;
}

/**
 * Inside a back-wall volume: turn 120–180° and drive away from the wall.
 */
export function tickBotBackWallEscape(
  pos: THREE.Vector3,
  wish: THREE.Vector3,
  dt: number,
  attackingTeam: Team | null = null,
): THREE.Vector3 | null {
  if (attackingTeam && isInsideShootZone(pos.x, pos.z, attackingTeam)) {
    return null;
  }
  const side = whichBackWallEscapeZone(pos.x, pos.z);
  if (!side) return null;

  _backWallCooldown[side] = Math.max(0, _backWallCooldown[side] - dt);
  if (_backWallCooldown[side] > 0) return null;

  _backWallCooldown[side] = BOT.backWallEscapeCooldownSec;

  const awayX = side === 'red' ? 1 : -1;
  const baseYaw =
    wish.lengthSq() > 0.04
      ? Math.atan2(wish.x, wish.z)
      : Math.atan2(awayX, 0);

  const turnDeg = 120 + Math.random() * 60;
  const sign = Math.random() < 0.5 ? 1 : -1;
  const yaw = baseYaw + sign * THREE.MathUtils.degToRad(turnDeg);

  _escapeWish.set(Math.sin(yaw), 0, Math.cos(yaw));
  _escapeWish.x += awayX * 0.55;
  if (_escapeWish.lengthSq() > 0.01) _escapeWish.normalize();

  return _escapeWish;
}

export type BotWallEscapeResult = {
  escapeWish: THREE.Vector3 | null;
  requestJump: boolean;
};

export function tickBotWallEscape(
  state: BotStuckState,
  pos: THREE.Vector3,
  wish: THREE.Vector3,
  dt: number,
): BotWallEscapeResult {
  const none: BotWallEscapeResult = { escapeWish: null, requestJump: false };
  state.escapeCooldown = Math.max(0, state.escapeCooldown - dt);

  const arenaR = ARENA.hexRadius - BOT.stuckBoundaryMargin;
  const nearWall = !isInsideHex(pos.x, pos.z, arenaR);

  const moved = Math.hypot(pos.x - state.sampleX, pos.z - state.sampleZ);
  if (moved >= BOT.stuckMoveThreshold) {
    state.sampleX = pos.x;
    state.sampleZ = pos.z;
    state.stuckSec = 0;
    return none;
  }

  if (!nearWall) {
    state.stuckSec = 0;
    return none;
  }

  state.stuckSec += dt;
  if (state.stuckSec < BOT.stuckTimeSec || state.escapeCooldown > 0) {
    return none;
  }

  state.stuckSec = 0;
  state.escapeCooldown = BOT.stuckEscapeCooldownSec;
  state.sampleX = pos.x;
  state.sampleZ = pos.z;

  _normal.copy(hexBoundaryNormal(pos.x, pos.z, arenaR));
  _escapeWish.set(_normal.x, 0, _normal.y);
  if (_escapeWish.lengthSq() < 0.01) {
    _escapeWish.set(0, 0, wish.lengthSq() > 0.01 ? 1 : -1);
  }
  _escapeWish.normalize();

  const along = new THREE.Vector3(-_escapeWish.z, 0, _escapeWish.x);
  if (Math.random() < 0.5) along.multiplyScalar(-1);
  _escapeWish.addScaledVector(along, 0.45 + Math.random() * 0.35);
  if (_escapeWish.lengthSq() > 0.01) _escapeWish.normalize();

  return { escapeWish: _escapeWish.clone(), requestJump: true };
}

export function softenHexBoundaryVelocity(
  pos: THREE.Vector3,
  vel: THREE.Vector3,
): void {
  const r = ARENA.hexRadius - 2.5;
  if (isInsideHex(pos.x, pos.z, r - 1.2)) return;

  _normal.copy(hexBoundaryNormal(pos.x, pos.z, r));
  const vn = vel.x * _normal.x + vel.z * _normal.y;
  if (vn < 0) {
    vel.x -= _normal.x * vn * 1.05;
    vel.z -= _normal.y * vn * 1.05;
  }

  const clamped = clampToHex(pos.x, pos.z, r, 0.5);
  if (!isInsideHex(pos.x, pos.z, r)) {
    vel.x += (clamped.x - pos.x) * 2;
    vel.z += (clamped.z - pos.z) * 2;
  }
}

export function applyEscapeImpulse(
  vel: THREE.Vector3,
  escapeWish: THREE.Vector3,
): void {
  vel.x += escapeWish.x * BOT.stuckEscapePush;
  vel.z += escapeWish.z * BOT.stuckEscapePush;
}
