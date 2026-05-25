import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { ARENA_PADS } from '../shared/Constants';
import { tuningStore } from './tuningStore';
import {
  bounceLaunchSpeedY,
  getBounceTrampolinePads,
  type FloorPad,
} from './arenaPadLayout';
import { triggerJumpPadGlow } from './jumpPadGlow';

const trampolines = getBounceTrampolinePads();

let ballPadUntil = 0;
let playerPadUntil = 0;
let botPadUntil = 0;

const PAD_XZ_SCALE = 1.08;
const PAD_MAX_ABOVE_DECK_M = 4.5;

function deckSurfaceY(pad: FloorPad): number {
  return pad.platformTopY + ARENA_PADS.bouncePadHeightM;
}

function findLaunchPad(x: number, z: number): FloorPad | null {
  for (const pad of trampolines) {
    if (Math.hypot(x - pad.x, z - pad.z) <= pad.radius * PAD_XZ_SCALE) {
      return pad;
    }
  }
  return null;
}

function playerLaunchVy(gravity: number, strengthMult: number): number {
  const h =
    ARENA_PADS.bounceLaunchHeightFt *
    0.3048 *
    ARENA_PADS.playerBounceLaunchHeightScale;
  const g = Math.abs(gravity);
  return (
    Math.sqrt(2 * g * h) *
    strengthMult *
    ARENA_PADS.trampolineStrengthScale
  );
}

function applyLaunch(
  body: RapierRigidBody,
  velocity: THREE.Vector3 | null,
  launchVy: number,
): void {
  const v = body.linvel();
  const vy = Math.max(launchVy, v.y);
  body.setLinvel({ x: v.x, y: vy, z: v.z }, true);
  if (velocity) {
    velocity.x = v.x;
    velocity.y = vy;
    velocity.z = v.z;
  }
  const t = body.translation();
  const pad = findLaunchPad(t.x, t.z);
  if (pad) {
    triggerJumpPadGlow(pad);
    const deckY = deckSurfaceY(pad);
    const liftY = Math.max(t.y, deckY + 0.15);
    body.setTranslation({ x: t.x, y: liftY, z: t.z }, true);
  }
}

function bodyOnPad(body: RapierRigidBody, feetY?: number): FloorPad | null {
  const t = body.translation();
  const pad = findLaunchPad(t.x, t.z);
  if (!pad) return null;
  const deckY = deckSurfaceY(pad);
  const refY = feetY ?? t.y;
  if (refY > deckY + PAD_MAX_ABOVE_DECK_M && t.y > deckY + PAD_MAX_ABOVE_DECK_M) {
    return null;
  }
  if (t.y < pad.platformTopY - 2.5) return null;
  return pad;
}

/** Pedestal + deck column — player should not treat as normal walkable ground */
export function isPlayerInTrampolineZone(
  x: number,
  z: number,
  feetY: number,
): boolean {
  const pad = findLaunchPad(x, z);
  if (!pad) return false;
  const deckY = deckSurfaceY(pad);
  return feetY <= deckY + PAD_MAX_ABOVE_DECK_M && feetY >= pad.platformTopY - 0.8;
}

/** Cyan deck launch zone */
export function isPlayerOverTrampolineDeck(
  x: number,
  z: number,
  feetY: number,
): boolean {
  const pad = findLaunchPad(x, z);
  if (!pad) return false;
  const deckY = deckSurfaceY(pad);
  return feetY <= deckY + 1.8 && feetY >= deckY - 1.2;
}

export function tryPlayerPads(
  body: RapierRigidBody,
  velocity: THREE.Vector3,
  gravity: number,
  strengthMult: number,
  contact: { feetY: number; vy: number },
): boolean {
  const now = performance.now();
  if (now < playerPadUntil) return false;

  const pad = bodyOnPad(body, contact.feetY);
  if (!pad) return false;

  const launchVy = playerLaunchVy(gravity, strengthMult);
  applyLaunch(body, velocity, launchVy);
  playerPadUntil = now + 220;
  return true;
}

/** Bots — same XZ pad test as player/ball */
export function tryBotPads(
  body: RapierRigidBody,
  velocity: THREE.Vector3,
  gravity: number,
  strengthMult: number,
): boolean {
  const now = performance.now();
  if (now < botPadUntil) return false;

  const pad = bodyOnPad(body);
  if (!pad) return false;

  const launchVy = bounceLaunchSpeedY(gravity, strengthMult);
  applyLaunch(body, velocity, launchVy);
  botPadUntil = now + 200;
  return true;
}

export function tickArenaPads(ballBody: RapierRigidBody | null): void {
  const now = performance.now();
  if (!ballBody || now < ballPadUntil) return;

  const pad = bodyOnPad(ballBody);
  if (!pad) return;

  const tune = tuningStore.getState();
  const launchVy = bounceLaunchSpeedY(tune.gravity, tune.trampolineStrength);
  applyLaunch(ballBody, null, launchVy);
  ballPadUntil = now + 200;
}
