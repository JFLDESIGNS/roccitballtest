import * as THREE from 'three';

export type EnergyOrbDefinition = {
  id: string;
  position: THREE.Vector3;
};

export type EnergyOrbSnapshot = {
  version: number;
  orbs: Array<{
    id: string;
    position: THREE.Vector3;
    ready: boolean;
  }>;
};

export const ENERGY_ORB_RESTORE = 38;
export const ENERGY_ORB_PICKUP_RADIUS = 3.1;
export const ENERGY_ORB_RESPAWN_SEC = 6;

export const ENERGY_ORB_LAYOUT: EnergyOrbDefinition[] = [
  { id: 'side-blue-left', position: new THREE.Vector3(-42, 3.1, -24) },
  { id: 'side-blue-right', position: new THREE.Vector3(42, 3.1, -24) },
  { id: 'side-red-left', position: new THREE.Vector3(-42, 3.1, 24) },
  { id: 'side-red-right', position: new THREE.Vector3(42, 3.1, 24) },
  { id: 'mid-side-left', position: new THREE.Vector3(-50, 3.1, 0) },
  { id: 'mid-side-right', position: new THREE.Vector3(50, 3.1, 0) },
];

const respawnAt = new Map<string, number>();
const listeners = new Set<() => void>();
let snapshotVersion = 0;
let snapshot: EnergyOrbSnapshot = buildSnapshot();

function buildSnapshot(): EnergyOrbSnapshot {
  const now = performance.now() / 1000;
  return {
    version: snapshotVersion,
    orbs: ENERGY_ORB_LAYOUT.map((orb) => ({
      id: orb.id,
      position: orb.position,
      ready: (respawnAt.get(orb.id) ?? 0) <= now,
    })),
  };
}

function emitEnergyOrbChange(): void {
  snapshotVersion += 1;
  snapshot = buildSnapshot();
  for (const listener of listeners) listener();
}

export function subscribeEnergyOrbs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getEnergyOrbSnapshot(): EnergyOrbSnapshot {
  return snapshot;
}

export function tickEnergyOrbs(nowSec: number): void {
  let changed = false;
  for (const orb of ENERGY_ORB_LAYOUT) {
    const readyAt = respawnAt.get(orb.id) ?? 0;
    if (readyAt > 0 && readyAt <= nowSec) {
      respawnAt.delete(orb.id);
      changed = true;
    }
  }
  if (changed) emitEnergyOrbChange();
}

export function tryCollectEnergyOrb(
  playerPosition: THREE.Vector3,
  nowSec: number,
): number {
  const radiusSq = ENERGY_ORB_PICKUP_RADIUS * ENERGY_ORB_PICKUP_RADIUS;
  for (const orb of ENERGY_ORB_LAYOUT) {
    if ((respawnAt.get(orb.id) ?? 0) > nowSec) continue;
    if (playerPosition.distanceToSquared(orb.position) > radiusSq) continue;
    respawnAt.set(orb.id, nowSec + ENERGY_ORB_RESPAWN_SEC);
    emitEnergyOrbChange();
    return ENERGY_ORB_RESTORE;
  }
  return 0;
}
