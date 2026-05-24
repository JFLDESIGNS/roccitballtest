import { MATCH } from '../shared/Constants';
import { gameStore } from './gameStore';

type GameStoreState = ReturnType<typeof gameStore.getState>;

export function isMatchOver(state: GameStoreState): boolean {
  if (state.phase === 'paused') return true;
  return (
    state.score.red >= MATCH.scoreLimit ||
    state.score.blue >= MATCH.scoreLimit
  );
}

export function matchWinner(state: GameStoreState): 'red' | 'blue' | 'draw' {
  if (state.score.red > state.score.blue) return 'red';
  if (state.score.blue > state.score.red) return 'blue';
  return 'draw';
}

export function matchEndHeadline(state: GameStoreState): string {
  const winner = matchWinner(state);
  if (winner === 'draw') return 'Match over — tie game';
  const label = winner === 'blue' ? 'Blue' : 'Red';
  return `${label} wins!`;
}
