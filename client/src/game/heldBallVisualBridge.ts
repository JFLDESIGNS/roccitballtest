import * as THREE from 'three';
import { BALL } from '../shared/Constants';

/** Handoff between Player smooth carry mesh and Ball release blend */
export const heldBallVisualBridge = {
  smoothPos: new THREE.Vector3(),
  carryQuat: new THREE.Quaternion(),
  release: {
    active: false,
    from: new THREE.Vector3(),
    fromQuat: new THREE.Quaternion(),
    startedAt: 0,
  },
};

export function markLocalHeldBallCarry(
  from: THREE.Vector3,
  rot?: { x: number; y: number; z: number; w: number },
) {
  heldBallVisualBridge.smoothPos.copy(from);
  if (rot) {
    heldBallVisualBridge.carryQuat.set(rot.x, rot.y, rot.z, rot.w);
  } else {
    heldBallVisualBridge.carryQuat.identity();
  }
}

export function beginLocalHeldBallRelease(from: THREE.Vector3) {
  const r = heldBallVisualBridge.release;
  r.from.copy(from);
  r.fromQuat.copy(heldBallVisualBridge.carryQuat);
  r.startedAt = performance.now() / 1000;
  r.active = true;
}

/** Read-only release blend [0,1] — does not clear release.active */
export function getHeldBallReleaseBlend(nowSec: number): number {
  const r = heldBallVisualBridge.release;
  if (!r.active) return 1;
  const t =
    (nowSec - r.startedAt) / Math.max(BALL.holdReleaseVisualLerpSec, 1e-4);
  return Math.min(t, 1);
}

export function advanceHeldBallReleaseBlend(nowSec: number): number {
  const blend = getHeldBallReleaseBlend(nowSec);
  if (blend >= 1) {
    heldBallVisualBridge.release.active = false;
    return 1;
  }
  return blend;
}

export function smoothstep01(t: number): number {
  const c = THREE.MathUtils.clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}
