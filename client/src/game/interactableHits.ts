import * as THREE from 'three';
import type { WallMount } from './arenaPadLayout';
import { getBillboardMounts } from './arenaPadLayout';
import { listArenaPlatforms } from './arenaSpawn';
import {
  billboardFaceNormalWorld,
  billboardHitHalfExtents,
  segmentHitsLocalAabb,
  worldDeltaToBillboardLocal,
} from './billboardCollision';
import { findGoalBackCapDiscHit } from './goalRingBounce';
import { triggerBillboardShake, triggerOctagonShake } from './visualShake';

const _sample = new THREE.Vector3();
const _segFrom = new THREE.Vector3();
const _segTo = new THREE.Vector3();
const _localA = { lx: 0, ly: 0, lz: 0 };
const _localB = { lx: 0, ly: 0, lz: 0 };
const _impact = new THREE.Vector3();

/** Catches fast rockets grazing corners between frames */
const BILLBOARD_SEG_SAMPLES = 14;

export type BillboardSegmentHit = {
  mount: WallMount;
  point: THREE.Vector3;
  normal: THREE.Vector3;
};

export { billboardFaceNormalWorld } from './billboardCollision';

export function findBillboardSegmentHit(
  from: THREE.Vector3,
  to: THREE.Vector3,
  pad = 0,
): BillboardSegmentHit | null {
  const { hx, hy, lzMin, lzMax } = billboardHitHalfExtents();
  const hxPad = hx + pad;
  const hyPad = hy + pad;
  const lzMinPad = lzMin - pad;
  const lzMaxPad = lzMax + pad;

  for (const mount of getBillboardMounts()) {
    let hitT = -1;

    for (let s = 0; s < BILLBOARD_SEG_SAMPLES; s++) {
      const t0 = s / BILLBOARD_SEG_SAMPLES;
      const t1 = (s + 1) / BILLBOARD_SEG_SAMPLES;
      _segFrom.lerpVectors(from, to, t0);
      _segTo.lerpVectors(from, to, t1);

      worldDeltaToBillboardLocal(
        _segFrom.x - mount.x,
        _segFrom.y - mount.y,
        _segFrom.z - mount.z,
        mount.yaw,
        _localA,
      );
      worldDeltaToBillboardLocal(
        _segTo.x - mount.x,
        _segTo.y - mount.y,
        _segTo.z - mount.z,
        mount.yaw,
        _localB,
      );

      if (
        segmentHitsLocalAabb(
          _localA.lx,
          _localA.ly,
          _localA.lz,
          _localB.lx,
          _localB.ly,
          _localB.lz,
          hxPad,
          hyPad,
          lzMinPad,
          lzMaxPad,
        )
      ) {
        hitT = (t0 + t1) * 0.5;
        break;
      }
    }

    if (hitT < 0) continue;

    const normal = billboardFaceNormalWorld(mount.yaw);
    _impact.lerpVectors(from, to, hitT);
    return { mount, point: _impact.clone(), normal };
  }
  return null;
}

export function rocketSegmentHitsBillboard(
  from: THREE.Vector3,
  to: THREE.Vector3,
): boolean {
  return findBillboardSegmentHit(from, to) !== null;
}

export function tryTriggerGoalRingImpact(
  from: THREE.Vector3,
  to: THREE.Vector3,
  entityRadius = 0.5,
): string | null {
  const end = findGoalBackCapDiscHit(to.x, to.y, to.z, entityRadius);
  if (end) return end.goalId;
  for (let i = 0; i <= 10; i++) {
    _sample.lerpVectors(from, to, i / 10);
    const hit = findGoalBackCapDiscHit(
      _sample.x,
      _sample.y,
      _sample.z,
      entityRadius,
    );
    if (hit) return hit.goalId;
  }
  return null;
}

export function tryTriggerGoalRingImpactAt(
  x: number,
  y: number,
  z: number,
  entityRadius: number,
): string | null {
  const hit = findGoalBackCapDiscHit(x, y, z, entityRadius);
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
  const hit = findBillboardSegmentHit(from, to);
  if (!hit) return false;
  triggerBillboardShake(hit.mount);
  return true;
}
