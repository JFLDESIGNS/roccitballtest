/** Session-only premium 8-ball — must buy again after refresh or returning to menu */

let premium8Ball = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

export function getPremium8Ball(): boolean {
  return premium8Ball;
}

export function subscribePremium8Ball(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function unlockPremium8Ball(): void {
  if (premium8Ball) return;
  premium8Ball = true;
  notify();
}

/** Clears premium so the buy button is required again (menu mount / page load). */
export function resetPremium8Ball(): void {
  if (!premium8Ball) return;
  premium8Ball = false;
  notify();
}
