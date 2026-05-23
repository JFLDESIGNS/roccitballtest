import { isBallMidAir } from './announcements';
import { gameStore } from './gameStore';

/** Combo ends if the local player does not hit the ball within this window */
export const BALL_COMBO_TIMEOUT_MS = 2300;

const MIN_COMBO_HIT_SPEED = 2.4;

/** Mid-air strike by the local player — chains x2, x3, … */
export function registerLocalBallComboHit(
  ballY: number,
  ballVy: number,
  impactSpeed: number,
): void {
  if (gameStore.getState().ballHolderId === 'local') return;
  if (impactSpeed < MIN_COMBO_HIT_SPEED) return;
  if (!isBallMidAir(ballY, ballVy)) return;

  const now = performance.now();
  const { ballCombo, ballComboExpiresAt } = gameStore.getState();
  let next = ballCombo;
  if (next > 0 && now > ballComboExpiresAt) {
    next = 0;
  }
  next = next <= 0 ? 1 : next + 1;
  gameStore.setBallCombo(next, now + BALL_COMBO_TIMEOUT_MS);
}

export function clearBallCombo(): void {
  gameStore.clearBallCombo();
}
