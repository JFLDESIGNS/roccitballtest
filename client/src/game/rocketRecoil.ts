import * as THREE from 'three';
import { BEAM } from '../shared/Constants';

export const ROCKET_RECOIL = {
  /** Lean back on tilt.x (radians) */
  pitchBack: 0.42,
  decayTau: 0.2,
  flashDuration: 0.16,
  muzzleAhead: 1.05,
  chestLift: 0.12,
} as const;

export type RocketMuzzleFlash = {
  x: number;
  y: number;
  z: number;
  dirX: number;
  dirY: number;
  dirZ: number;
  life: number;
  explosive: boolean;
};

type ActorRecoil = { pitch: number };

const recoils = new Map<string, ActorRecoil>();
const flashes: RocketMuzzleFlash[] = [];
const MAX_FLASHES = 14;

const _dir = new THREE.Vector3();
const _muzzle = new THREE.Vector3();

export function triggerRocketRecoil(
  actorId: string,
  lookDir: THREE.Vector3,
  bodyPos: THREE.Vector3,
  explosive: boolean,
): void {
  recoils.set(actorId, { pitch: ROCKET_RECOIL.pitchBack });

  _dir.copy(lookDir);
  if (_dir.lengthSq() < 1e-8) _dir.set(0, 0, 1);
  _dir.normalize();

  _muzzle
    .copy(bodyPos)
    .addScaledVector(_dir, ROCKET_RECOIL.muzzleAhead);
  _muzzle.y += BEAM.chestHeight * 0.35 + ROCKET_RECOIL.chestLift;

  flashes.push({
    x: _muzzle.x,
    y: _muzzle.y,
    z: _muzzle.z,
    dirX: _dir.x,
    dirY: _dir.y,
    dirZ: _dir.z,
    life: 1,
    explosive,
  });
  if (flashes.length > MAX_FLASHES) {
    flashes.splice(0, flashes.length - MAX_FLASHES);
  }
}

export function getRocketRecoilPitch(actorId: string): number {
  return recoils.get(actorId)?.pitch ?? 0;
}

export function tickRocketRecoil(dt: number): void {
  const decay = Math.exp(-dt / ROCKET_RECOIL.decayTau);
  for (const [id, state] of recoils) {
    state.pitch *= decay;
    if (state.pitch < 0.006) recoils.delete(id);
  }

  const flashStep = dt / ROCKET_RECOIL.flashDuration;
  for (let i = flashes.length - 1; i >= 0; i--) {
    flashes[i]!.life -= flashStep;
    if (flashes[i]!.life <= 0) flashes.splice(i, 1);
  }
}

export function getRocketMuzzleFlashes(): readonly RocketMuzzleFlash[] {
  return flashes;
}
