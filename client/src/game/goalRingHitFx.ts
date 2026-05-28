const GOAL_RING_FLASH_SEC = 0.22;
const hitTimesMs = new Map<string, number>();

export function triggerGoalRingHit(goalId: string): void {
  hitTimesMs.set(goalId, performance.now());
}

export function sampleGoalRingHit(goalId: string, nowMs = performance.now()): number {
  const hitMs = hitTimesMs.get(goalId);
  if (hitMs == null) return 0;
  const ageSec = (nowMs - hitMs) / 1000;
  if (ageSec >= GOAL_RING_FLASH_SEC) {
    hitTimesMs.delete(goalId);
    return 0;
  }
  const t = 1 - ageSec / GOAL_RING_FLASH_SEC;
  return t * t;
}
