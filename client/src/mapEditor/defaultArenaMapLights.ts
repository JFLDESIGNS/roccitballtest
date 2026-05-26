import { ARENA } from '../shared/Constants';
import { goalEndFaceX } from '../game/goals';
import { normalizeMapLight } from './mapLightDefaults';
import type { MapDocument, MapLight } from './mapEditorTypes';
import { DEFAULT_MAP_ID, DEFAULT_MAP_NAME } from './mapEditorTypes';
import { ensureDocumentGroups } from './stadiumLayout';

/** Just under the ceiling — matches where ceiling strip / glow blobs read best. */
const GLOW_Y = ARENA.wallHeight + ARENA.ceilingOverlapM - 3.2;

const FACE_X = goalEndFaceX();
/** Midfield X — between center and each goal wall (classic 3-point fill). */
const SIDE_X = FACE_X * 0.42;

/**
 * Built-in map lights for Default Arena (point lamps + play-mode glow billboards).
 * Baked from the Newbie map layout: warm center + red/blue side fills.
 */
export const DEFAULT_ARENA_MAP_LIGHTS: MapLight[] = [
  normalizeMapLight({
    id: 'default-light-center',
    name: 'Center glow',
    kind: 'point',
    position: [0, GLOW_Y, 0],
    rotation: [-Math.PI / 4, 0, 0],
    color: '#ffe8cc',
    intensity: 8,
    distance: 80,
    angle: Math.PI / 5,
    penumbra: 0.35,
    rectWidth: 14,
    rectHeight: 8,
    castShadow: false,
  }),
  normalizeMapLight({
    id: 'default-light-red',
    name: 'Red side glow',
    kind: 'point',
    position: [-SIDE_X, GLOW_Y - 1.2, 0],
    rotation: [-Math.PI / 4, 0, 0],
    color: '#ff9977',
    intensity: 6.5,
    distance: 72,
    angle: Math.PI / 5,
    penumbra: 0.35,
    rectWidth: 14,
    rectHeight: 8,
    castShadow: false,
  }),
  normalizeMapLight({
    id: 'default-light-blue',
    name: 'Blue side glow',
    kind: 'point',
    position: [SIDE_X, GLOW_Y - 1.2, 0],
    rotation: [-Math.PI / 4, 0, 0],
    color: '#77bbff',
    intensity: 6.5,
    distance: 72,
    angle: Math.PI / 5,
    penumbra: 0.35,
    rectWidth: 14,
    rectHeight: 8,
    castShadow: false,
  }),
];

export function cloneDefaultArenaMapLights(): MapLight[] {
  return DEFAULT_ARENA_MAP_LIGHTS.map((l) => ({ ...l }));
}

/** Editor + play baseline for Default Arena (not persisted to localStorage). */
export function createDefaultArenaDocument(): MapDocument {
  const now = Date.now();
  return {
    id: DEFAULT_MAP_ID,
    name: DEFAULT_MAP_NAME,
    createdAt: now,
    updatedAt: now,
    groups: ensureDocumentGroups([]),
    objects: [],
    lights: cloneDefaultArenaMapLights(),
  };
}
