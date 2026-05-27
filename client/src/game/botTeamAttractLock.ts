import type { BotId } from './gameStore';
import type { Team } from '../shared/Types';

type AttractLock = {
  team: Team;
  botId: BotId;
  /** Seconds (performance.now/1000) when lock expires if not refreshed */
  until: number;
};

let lock: AttractLock | null = null;

/** Short TTL so lock self-heals if a bot stops ticking. */
const LOCK_TTL_S = 0.35;

export function clearBotTeamAttractLock(): void {
  lock = null;
}

/**
 * Team-wide gate for beam/magnet attraction. Returns true when this bot is allowed
 * to attract right now. When `active` is true, the lock is acquired/refreshed.
 * When `active` is false and this bot holds the lock, the lock is released.
 */
export function allowTeamAttract(
  team: Team,
  botId: BotId,
  active: boolean,
  nowSec = performance.now() / 1000,
): boolean {
  if (lock && nowSec > lock.until) lock = null;

  if (!active) {
    if (lock && lock.team === team && lock.botId === botId) lock = null;
    return true;
  }

  if (!lock) {
    lock = { team, botId, until: nowSec + LOCK_TTL_S };
    return true;
  }

  if (lock.team === team && lock.botId === botId) {
    lock.until = nowSec + LOCK_TTL_S;
    return true;
  }

  return false;
}

