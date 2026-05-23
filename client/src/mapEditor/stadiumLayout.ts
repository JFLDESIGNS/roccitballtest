import { ARENA_GOALS } from '../game/goals';
import { ARENA_PILLAR, getArenaCornerPillarLayouts } from '../game/arenaPillars';
import type { MapGroup } from './mapEditorTypes';

export function stadiumGoalKey(goalId: string): string {
  return `goal:${goalId}`;
}

export function stadiumPillarKey(index: number): string {
  return `pillar:${index}`;
}

export function parseStadiumKey(
  key: string,
): { kind: 'goal'; goalId: string } | { kind: 'pillar'; index: number } | null {
  if (key.startsWith('goal:')) {
    return { kind: 'goal', goalId: key.slice(5) };
  }
  if (key.startsWith('pillar:')) {
    const index = Number(key.slice(7));
    if (Number.isFinite(index)) return { kind: 'pillar', index };
  }
  return null;
}

/** Default movable stadium groups layered on the built-in arena. */
export function createDefaultStadiumGroups(): MapGroup[] {
  const goals: MapGroup[] = ARENA_GOALS.map((g) => ({
    id: `stadium-${g.id}`,
    name: `${g.team} ${g.size} goal`,
    stadiumKey: stadiumGoalKey(g.id),
    position: [g.center.x, g.center.y, g.center.z],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  }));

  const pillars: MapGroup[] = getArenaCornerPillarLayouts().map((p, i) => ({
    id: `stadium-pillar-${i}`,
    name: `Corner pillar ${i + 1}`,
    stadiumKey: stadiumPillarKey(i),
    position: [p.x, ARENA_PILLAR.floorY, p.z],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  }));

  return [...goals, ...pillars];
}

export function getHiddenStadiumPieces(groups: MapGroup[]): {
  hiddenGoalIds: string[];
  hiddenPillarIndices: number[];
} {
  const hiddenGoalIds: string[] = [];
  const hiddenPillarIndices: number[] = [];
  for (const group of groups) {
    if (!group.stadiumKey) continue;
    const parsed = parseStadiumKey(group.stadiumKey);
    if (parsed?.kind === 'goal') hiddenGoalIds.push(parsed.goalId);
    if (parsed?.kind === 'pillar') hiddenPillarIndices.push(parsed.index);
  }
  return { hiddenGoalIds, hiddenPillarIndices };
}

export function ensureDocumentGroups(groups: MapGroup[] | undefined): MapGroup[] {
  if (groups && groups.length > 0) {
    return groups.map((g) => ({ ...g }));
  }
  return createDefaultStadiumGroups();
}
