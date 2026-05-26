import { ARENA_GOALS } from '../game/goals';
import { ARENA_PILLAR, getArenaCornerPillarLayouts } from '../game/arenaPillars';
import { listOctagonPlatformPlacements } from '../game/arenaOctagonPlatforms';
import type { MapGroup } from './mapEditorTypes';

export function stadiumGoalKey(goalId: string): string {
  return `goal:${goalId}`;
}

export function stadiumPillarKey(index: number): string {
  return `pillar:${index}`;
}

export function stadiumPlatformKey(index: number): string {
  return `platform:${index}`;
}

export function parseStadiumKey(
  key: string,
):
  | { kind: 'goal'; goalId: string }
  | { kind: 'pillar'; index: number }
  | { kind: 'platform'; index: number }
  | null {
  if (key.startsWith('goal:')) {
    return { kind: 'goal', goalId: key.slice(5) };
  }
  if (key.startsWith('pillar:')) {
    const index = Number(key.slice(7));
    if (Number.isFinite(index)) return { kind: 'pillar', index };
  }
  if (key.startsWith('platform:')) {
    const index = Number(key.slice(9));
    if (Number.isFinite(index)) return { kind: 'platform', index };
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

  const platforms: MapGroup[] = listOctagonPlatformPlacements().map((p, i) => ({
    id: `stadium-platform-${i}`,
    name: i === 0 ? 'Center platform' : `Corner platform ${i}`,
    stadiumKey: stadiumPlatformKey(i),
    position: [p.x, 0, p.z],
    rotation: [0, 0, 0],
    scale: [p.sizeScale, 1, p.sizeScale],
  }));

  return [...goals, ...pillars, ...platforms];
}

export function getHiddenStadiumPieces(groups: MapGroup[]): {
  hiddenGoalIds: string[];
  hiddenPillarIndices: number[];
  hiddenPlatformIndices: number[];
} {
  const hiddenGoalIds: string[] = [];
  const hiddenPillarIndices: number[] = [];
  const hiddenPlatformIndices: number[] = [];
  for (const group of groups) {
    if (!group.stadiumKey) continue;
    const parsed = parseStadiumKey(group.stadiumKey);
    if (parsed?.kind === 'goal') hiddenGoalIds.push(parsed.goalId);
    if (parsed?.kind === 'pillar') hiddenPillarIndices.push(parsed.index);
    if (parsed?.kind === 'platform') hiddenPlatformIndices.push(parsed.index);
  }
  return { hiddenGoalIds, hiddenPillarIndices, hiddenPlatformIndices };
}

export function ensureDocumentGroups(groups: MapGroup[] | undefined): MapGroup[] {
  const base =
    groups && groups.length > 0
      ? groups.map((g) => ({ ...g }))
      : createDefaultStadiumGroups();

  const placements = listOctagonPlatformPlacements();
  const merged = [...base];
  for (let i = 0; i < placements.length; i++) {
    const key = stadiumPlatformKey(i);
    if (merged.some((g) => g.stadiumKey === key)) continue;
    const p = placements[i]!;
    merged.push({
      id: `stadium-platform-${i}`,
      name: i === 0 ? 'Center platform' : `Corner platform ${i}`,
      stadiumKey: key,
      position: [p.x, 0, p.z],
      rotation: [0, 0, 0],
      scale: [p.sizeScale, 1, p.sizeScale],
    });
  }
  return merged;
}
