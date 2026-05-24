/** Local-player match totals shown on the end-game stats screen */
export type MatchStats = {
  midAirHits: number;
  maxCombo: number;
  kills: number;
  /** Scoring events for the local player's team */
  goals: number;
  /** Points earned for the local player's team */
  pointsScored: number;
  /** Direct rockets that hit hostile players or bots */
  rocketHits: number;
};

export const EMPTY_MATCH_STATS: MatchStats = {
  midAirHits: 0,
  maxCombo: 0,
  kills: 0,
  goals: 0,
  pointsScored: 0,
  rocketHits: 0,
};

export type MatchStatRow = {
  label: string;
  value: number | string;
};

export function matchStatRows(stats: MatchStats): MatchStatRow[] {
  return [
    { label: 'Mid-air hits', value: stats.midAirHits },
    { label: 'Best combo', value: stats.maxCombo > 1 ? `x${stats.maxCombo}` : stats.maxCombo },
    { label: 'Kills', value: stats.kills },
    { label: 'Goals', value: stats.goals },
    { label: 'Points scored', value: stats.pointsScored },
    { label: 'Rocket hits', value: stats.rocketHits },
  ];
}
