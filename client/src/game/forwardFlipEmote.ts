import { gameStore, type BotId } from './gameStore';
import type { ActorId } from './playerRoster';

/** Teammate drone — flips when the local player presses E */
const ALLY_BOT_ID: BotId = 'bot-2';

const FLIP_DURATION_MS = 640;

const flipUntilByActor = new Map<string, number>();

export function triggerForwardFlip(actorId: ActorId): void {
  flipUntilByActor.set(actorId, performance.now() + FLIP_DURATION_MS);
}

export function triggerAllyBotForwardFlip(): void {
  triggerForwardFlip(ALLY_BOT_ID);
}

/** E throw flourish — local player only */
export function triggerThrowFlipEmotes(): void {
  triggerForwardFlip('local');
  gameStore.bumpPlayerHatPop(true);
}

export function isForwardFlipActive(actorId: string): boolean {
  const until = flipUntilByActor.get(actorId);
  return until !== undefined && performance.now() < until;
}

/** 0 at flip start → 1 at flip end */
export function getForwardFlipProgress(actorId: string): number {
  const until = flipUntilByActor.get(actorId);
  if (!until) return 0;
  const remaining = until - performance.now();
  if (remaining <= 0) return 1;
  return 1 - remaining / FLIP_DURATION_MS;
}

/** Extra pitch (rad) on the tilt group — one forward somersault, eased in/out */
export function getForwardFlipPitchX(actorId: string): number {
  const until = flipUntilByActor.get(actorId);
  if (!until) return 0;

  const now = performance.now();
  const remaining = until - now;
  if (remaining <= 0) {
    flipUntilByActor.delete(actorId);
    return 0;
  }

  const u = 1 - remaining / FLIP_DURATION_MS;
  const t = u * u * (3 - 2 * u);
  // One forward somersault (0 → 2π), no unwind — sin(π·u) peaked at mid-flip then rotated back.
  return -t * Math.PI * 2;
}
