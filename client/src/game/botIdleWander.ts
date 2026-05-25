import * as THREE from 'three';
import { BOT } from '../shared/Constants';
import type { BotMode } from './botBrain';

export type BotIdleWanderState = {
  stillSec: number;
  lastX: number;
  lastZ: number;
  phase: number;
};

export function createBotIdleWanderState(x: number, z: number): BotIdleWanderState {
  return { stillSec: 0, lastX: x, lastZ: z, phase: Math.random() * Math.PI * 2 };
}

/** Ally oop / receive / give-space — never stand still longer than maxStillSec */
export function botModeUsesIdleWander(
  mode: BotMode,
  giveShootZoneSpace: boolean,
): boolean {
  if (giveShootZoneSpace) return true;
  return mode === 'allyDunk' || mode === 'allySupport' || mode === 'allyReceive';
}

export function applyBotIdleWanderNudge(
  idle: BotIdleWanderState,
  posX: number,
  posZ: number,
  feetY: number,
  moveTarget: THREE.Vector3,
  dt: number,
): void {
  const moved = Math.hypot(posX - idle.lastX, posZ - idle.lastZ);
  if (moved > 0.4) {
    idle.stillSec = 0;
    idle.lastX = posX;
    idle.lastZ = posZ;
  } else {
    idle.stillSec += dt;
  }

  if (idle.stillSec < BOT.botPostMaxStillSec) return;

  idle.phase += dt * 1.35;
  const r = BOT.botPostIdleWanderRadiusM;
  moveTarget.set(
    posX + Math.cos(idle.phase) * r,
    feetY,
    posZ + Math.sin(idle.phase) * r,
  );
}
