import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { ARENA_PADS } from '../shared/Constants';
import { tuningStore } from './tuningStore';
import {
  bounceLaunchSpeedY,
  getBounceTrampolinePads,
  sampleTrampolineFloorY,
  type FloorPad,
} from './arenaPadLayout';

const trampolines = getBounceTrampolinePads();

let ballPadUntil = 0;
let playerPadUntil = 0;

function stoneCylinderR(pad: FloorPad): number {
  return pad.radius * 1.2;
}

function inCylinderXZ(x: number, z: number, pad: FloorPad): boolean {
  return Math.hypot(x - pad.x, z - pad.z) <= stoneCylinderR(pad);
}

function onTrampolineDeck(x: number, z: number, pad: FloorPad): boolean {
  return Math.hypot(x - pad.x, z - pad.z) <= pad.radius;
}

function deckSurfaceY(pad: FloorPad): number {
  return pad.platformTopY + ARENA_PADS.bouncePadHeightM;
}

/** Pedestal + cyan deck column — player should never treat this as walkable ground */
export function isPlayerInTrampolineZone(
  x: number,
  z: number,
  feetY: number,
): boolean {
  for (const pad of trampolines) {
    if (!inCylinderXZ(x, z, pad)) continue;
    const deckY = deckSurfaceY(pad);
    if (feetY <= deckY + 1.45 && feetY >= pad.platformTopY - 0.45) return true;
  }
  return false;
}

/** Cyan deck launch zone — feet intersecting deck volume */
export function isPlayerOverTrampolineDeck(
  x: number,
  z: number,
  feetY: number,
): boolean {
  for (const pad of trampolines) {
    if (!onTrampolineDeck(x, z, pad)) continue;
    const deckY = deckSurfaceY(pad);
    if (feetY <= deckY + 1.35 && feetY >= deckY - 0.85) return true;
  }
  return false;
}

function tryBallPads(body: RapierRigidBody, launchVy: number): boolean {
  const t = body.translation();
  const surface = sampleTrampolineFloorY(t.x, t.z);
  const maxY = surface ?? 0;
  if (t.y > maxY + 4) return false;

  for (const trampoline of trampolines) {
    if (inCylinderXZ(t.x, t.z, trampoline)) {
      const v = body.linvel();
      body.setLinvel(
        { x: v.x, y: Math.max(v.y, 0) + launchVy, z: v.z },
        true,
      );
      return true;
    }
  }
  return false;
}

function playerPadLaunchVy(gravity: number, strengthMult: number): number {
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

/**
 * Player trampoline — launch on cyan deck overlap (no deck collider; wide vertical band).
 */
export function tryPlayerPads(
  body: RapierRigidBody,
  velocity: THREE.Vector3,
  gravity: number,
  strengthMult: number,
  contact: { feetY: number; vy: number },
): boolean {
  const now = performance.now();
  if (now < playerPadUntil) return false;

  const t = body.translation();
  const launchVy = playerPadLaunchVy(gravity, strengthMult);

  for (const trampoline of trampolines) {
    if (!inCylinderXZ(t.x, t.z, trampoline)) continue;

    const deckY = deckSurfaceY(trampoline);
    const stoneY = trampoline.platformTopY;
    const feetY = contact.feetY;
    if (feetY > deckY + 1.45 || feetY < stoneY - 0.45) continue;
    if (contact.vy > launchVy * 0.92 && feetY > deckY + 0.08) continue;

    velocity.y = launchVy;
    body.setLinvel(
      { x: velocity.x, y: launchVy, z: velocity.z },
      true,
    );
    const tr = body.translation();
    const liftY = Math.max(tr.y, deckY + 0.12 + (tr.y - feetY));
    body.setTranslation({ x: tr.x, y: liftY, z: tr.z }, true);
    playerPadUntil = now + Math.max(ARENA_PADS.padCooldownMs, 220);
    return true;
  }

  return false;
}

export function tickArenaPads(ballBody: RapierRigidBody | null): void {
  const now = performance.now();
  const tune = tuningStore.getState();
  const launchVy = bounceLaunchSpeedY(tune.gravity, tune.trampolineStrength);

  if (ballBody && now >= ballPadUntil) {
    if (tryBallPads(ballBody, launchVy)) {
      ballPadUntil = now + 280;
    }
  }
}
