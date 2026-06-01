import { gameStore, type BotId } from './gameStore';
import type { ActorId } from './playerRoster';

/** Teammate drone — flips when the local player presses E */
const ALLY_BOT_ID: BotId = 'bot-2';

const FLIP_DURATION_MS = 640;
const DANCE_DURATION_MS = 2200;

const flipUntilByActor = new Map<string, number>();
const danceUntilByActor = new Map<string, number>();

export function triggerForwardFlip(actorId: ActorId): void {
  flipUntilByActor.set(actorId, performance.now() + FLIP_DURATION_MS);
}

export function triggerDanceEmote(actorId: ActorId): void {
  danceUntilByActor.set(actorId, performance.now() + DANCE_DURATION_MS);
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

export function isDanceActive(actorId: string): boolean {
  const until = danceUntilByActor.get(actorId);
  if (until === undefined) return false;
  if (performance.now() < until) return true;
  danceUntilByActor.delete(actorId);
  return false;
}

export function getDanceVisualOffset(actorId: string): { x: number; y: number; z: number; bob: number } {
  const until = danceUntilByActor.get(actorId);
  if (!until) return { x: 0, y: 0, z: 0, bob: 0 };
  const now = performance.now();
  const remaining = until - now;
  if (remaining <= 0) {
    danceUntilByActor.delete(actorId);
    return { x: 0, y: 0, z: 0, bob: 0 };
  }
  const u = 1 - remaining / DANCE_DURATION_MS;
  const fade = Math.min(1, remaining / 260, u / 0.12);
  const beat = now * 0.014;
  return {
    x: Math.sin(beat * 0.8) * 0.16 * fade,
    y: Math.sin(beat * 1.15) * 0.18 * fade,
    z: Math.sin(beat) * 0.28 * fade,
    bob: Math.abs(Math.sin(beat * 1.15)) * 0.12 * fade,
  };
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
