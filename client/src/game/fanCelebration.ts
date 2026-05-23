import { MATCH } from '../shared/Constants';
import type { Team } from '../shared/Types';
import { gameStore } from './gameStore';

let celebrateUntil = 0;
let celebrateTeam: Team | null = null;
let lastCelebId = -1;

/** Shared goal-celebration window for all fan bays (matches spotlight timing). */
export function getFanCelebrationState(elapsedTime: number): {
  active: boolean;
  team: Team | null;
} {
  const { goalCelebration, lastScoringTeam } = gameStore.getState();

  if (
    goalCelebration &&
    goalCelebration.id !== lastCelebId &&
    lastScoringTeam
  ) {
    lastCelebId = goalCelebration.id;
    celebrateTeam = lastScoringTeam;
    celebrateUntil =
      elapsedTime +
      MATCH.postScoreCountdownDelaySec +
      MATCH.resetCountdownSec +
      0.75;
  }

  const active = celebrateTeam != null && elapsedTime < celebrateUntil;
  return { active, team: active ? celebrateTeam : null };
}
