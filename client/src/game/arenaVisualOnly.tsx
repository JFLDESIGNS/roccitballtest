import { createContext, useContext } from 'react';

/** When true, arena pieces render meshes only (no Rapier bodies). Used in map editor. */
export const ArenaVisualOnlyContext = createContext(false);

export function useArenaVisualOnly(): boolean {
  return useContext(ArenaVisualOnlyContext);
}
