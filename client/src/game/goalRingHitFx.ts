import * as THREE from 'three';

const GOAL_RING_FLASH_SEC = 0.34;
const hitTimesMs = new Map<string, { at: number; point: THREE.Vector3 | null }>();

export function triggerGoalRingHit(goalId: string, point?: THREE.Vector3 | null): void {
  hitTimesMs.set(goalId, {
    at: performance.now(),
    point: point ? point.clone() : null,
  });
}

export function sampleGoalRingHit(goalId: string, nowMs = performance.now()): number {
  const hit = hitTimesMs.get(goalId);
  if (!hit) return 0;
  const ageSec = (nowMs - hit.at) / 1000;
  if (ageSec >= GOAL_RING_FLASH_SEC) {
    hitTimesMs.delete(goalId);
    return 0;
  }
  const t = 1 - ageSec / GOAL_RING_FLASH_SEC;
  return t * t;
}

export function sampleGoalRingHitPoint(goalId: string): THREE.Vector3 | null {
  return hitTimesMs.get(goalId)?.point ?? null;
}
