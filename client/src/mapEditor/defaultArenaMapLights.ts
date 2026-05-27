import * as THREE from 'three';
import { ARENA } from '../shared/Constants';
import { goalWallPositions } from '../game/goals';
import { normalizeMapLight } from './mapLightDefaults';
import type { MapDocument, MapLight } from './mapEditorTypes';
import { DEFAULT_MAP_ID, DEFAULT_MAP_NAME } from './mapEditorTypes';
import { ensureDocumentGroups } from './stadiumLayout';

const FT = 0.3048;

/** Default glow height — 70 ft below ceiling lip so blobs sit lower in the bowl. */
const GLOW_Y =
  ARENA.wallHeight + ARENA.ceilingOverlapM - 3.2 - 70 * FT;

const { red: redGoalX, blue: blueGoalX } = goalWallPositions();
/** Side glows sit this far infield from each goal end wall. */
const GLOW_WALL_STANDOFF_M = 43 * FT;
const RED_GLOW_X = redGoalX + GLOW_WALL_STANDOFF_M;
const BLUE_GLOW_X = blueGoalX - GLOW_WALL_STANDOFF_M;

function saturateHexColor(hex: string, saturationMul: number): string {
  const color = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  color.setHSL(hsl.h, Math.min(1, hsl.s * saturationMul), hsl.l);
  return `#${color.getHexString()}`;
}

const CENTER_GLOW_COLOR = saturateHexColor('#b0d8ff', 1.3);
const RED_GLOW_COLOR = '#ff1d18';
const BLUE_GLOW_COLOR = '#184eff';

const GLOW_LAMP = {
  kind: 'point' as const,
  rotation: [-Math.PI / 4, 0, 0] as [number, number, number],
  angle: Math.PI / 5,
  penumbra: 0.35,
  rectWidth: 14,
  rectHeight: 8,
  castShadow: false,
};

/**
 * Default Arena ceiling glows — center + one per goal end (smoke billboards).
 */
export const DEFAULT_ARENA_MAP_LIGHTS: MapLight[] = [
  normalizeMapLight({
    id: 'default-light-center',
    name: 'Center glow',
    ...GLOW_LAMP,
    position: [0, GLOW_Y, 0],
    color: CENTER_GLOW_COLOR,
    intensity: 8,
    distance: 80,
  }),
  normalizeMapLight({
    id: 'default-light-red',
    name: 'Red side glow',
    ...GLOW_LAMP,
    position: [RED_GLOW_X, GLOW_Y - 1.2, 0],
    color: RED_GLOW_COLOR,
    intensity: 6.5,
    distance: 72,
  }),
  normalizeMapLight({
    id: 'default-light-blue',
    name: 'Blue side glow',
    ...GLOW_LAMP,
    position: [BLUE_GLOW_X, GLOW_Y - 1.2, 0],
    color: BLUE_GLOW_COLOR,
    intensity: 6.5,
    distance: 72,
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
