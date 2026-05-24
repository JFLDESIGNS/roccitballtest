import { gameStore } from './gameStore';

export function isHoldImmunityActive(): boolean {
  return performance.now() < gameStore.getState().holdImmunityUntilMs;
}

/** Held ball cannot be knocked loose by hits/explosions while immunity is active. */
export function canKnockLooseHeldBall(): boolean {
  return !isHoldImmunityActive();
}

export function armHoldImmunity(): void {
  gameStore.armHoldImmunity();
}
