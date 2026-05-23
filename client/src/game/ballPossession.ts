import { gameStore } from './gameStore';

export function isBallPossessed(): boolean {
  return gameStore.getState().ballHolderId !== null;
}
