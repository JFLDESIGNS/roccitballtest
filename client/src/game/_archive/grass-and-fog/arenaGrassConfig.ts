/**
 * Master switch for arena instanced grass (blades on hex floor).
 * Set to `true` to show grass again; tuning menu "Arena grass" still applies when on.
 *
 * All build/placement logic lives in `arenaTurfBlades.ts` (unchanged when off).
 */
export const ARENA_GRASS_ENABLED = false;

export function isArenaGrassBuildEnabled(): boolean {
  return ARENA_GRASS_ENABLED;
}
