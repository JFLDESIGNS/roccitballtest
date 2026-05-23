import * as THREE from 'three';
import { ARENA_PADS } from '../shared/Constants';
import { getBillboardMounts } from './arenaPadLayout';
import { listArenaPlatforms } from './arenaSpawn';
import {
  findGoalRimHit,
  findGoalRimSegmentHit,
} from './goalRingBounce';
import { triggerBillboardShake, triggerOctagonShake } from './visualShake';

const _sample = new THREE.Vector3();

export function tryTriggerGoalRingImpact(
  from: THREE.Vector3,
  to: THREE.Vector3,
  entityRadius = 0.5,
): string | null {
  return findGoalRimSegmentHit(from, to, entityRadius);
}

export function tryTriggerGoalRingImpactAt(
  x: number,
  y: number,
  z: number,
  entityRadius: number,
): string | null {
  const hit = findGoalRimHit(x, y, z, entityRadius);
  return hit?.goalId ?? null;
}

export function tryTriggerOctagonImpactAt(x: number, z: number): boolean {
  for (const p of listArenaPlatforms()) {
    const dx = x - p.x;
    const dz = z - p.z;
    if (dx * dx + dz * dz <= p.slopeR * p.slopeR) {
      triggerOctagonShake(p.x, p.z);
      return true;
    }
  }
  return false;
}

export function tryTriggerBillboardImpact(
  from: THREE.Vector3,
  to: THREE.Vector3,
): boolean {
  const w = ARENA_PADS.billboardWidthM * 0.55;
  const h = ARENA_PADS.billboardHeightM * 0.55;
  const depth = 2.4;

  for (const mount of getBillboardMounts()) {
    const cos = Math.cos(mount.yaw);
    const sin = Math.sin(mount.yaw);
    for (let i = 0; i <= 10; i++) {
      _sample.lerpVectors(from, to, i / 10);
      const dx = _sample.x - mount.x;
      const dy = _sample.y - mount.y;
      const dz = _sample.z - mount.z;
      const lx = dx * cos + dz * sin;
      const lz = -dx * sin + dz * cos;
      if (Math.abs(lx) <= w && Math.abs(dy) <= h && Math.abs(lz) <= depth) {
        triggerBillboardShake(mount.x, mount.y, mount.z);
        return true;
      }
    }
  }
  return false;
}
