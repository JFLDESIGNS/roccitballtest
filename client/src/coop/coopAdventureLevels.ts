import type { Vec3 } from '../shared/Types';

export type CoopAdventurePlatformKind = 'start' | 'step' | 'finish';
export type CoopAdventurePlatformShape = 'box' | 'stack';

export type CoopAdventurePlatformMotion = {
  kind: 'vertical';
  amplitude: number;
  speed: number;
  phase: number;
} | null;

export type CoopAdventurePlatform = {
  id: string;
  position: Vec3;
  size: Vec3;
  kind: CoopAdventurePlatformKind;
  shape: CoopAdventurePlatformShape;
  motion: CoopAdventurePlatformMotion;
  treeCount: number;
  loveToken: boolean;
  grass: string;
  side: string;
};

export type CoopAdventureLevel = {
  id: number;
  name: string;
  tip: string;
  spawn: Vec3;
  platforms: CoopAdventurePlatform[];
  goal: Vec3;
};

type PadSpec = {
  x: number;
  y: number;
  z: number;
  sx: number;
  sz: number;
  kind?: CoopAdventurePlatformKind;
  shape?: CoopAdventurePlatformShape;
  motion?: CoopAdventurePlatformMotion;
  treeCount?: number;
  loveToken?: boolean;
};

const THEMES = [
  { grass: '#46c968', side: '#5b4531' },
  { grass: '#63d36d', side: '#604632' },
  { grass: '#3fc486', side: '#594537' },
  { grass: '#89c95b', side: '#635139' },
  { grass: '#52c5a2', side: '#4f4838' },
];

const COOP_PLATFORM_DISTANCE_SCALE = 9.0;
const COOP_PLATFORM_SIZE_SCALE = 3.0;

function scalePlatformSize(spec: PadSpec, themeIndex: number): { x: number; z: number } {
  if (spec.kind === 'start' || spec.kind === 'finish') {
    return {
      x: spec.sx * COOP_PLATFORM_SIZE_SCALE,
      z: spec.sz * COOP_PLATFORM_SIZE_SCALE,
    };
  }
  const widthScale = [1.14, 0.92, 1.28, 0.86, 1.08][themeIndex % 5]!;
  const depthScale = [0.96, 1.22, 0.9, 1.16, 1.02][themeIndex % 5]!;
  return {
    x: Math.max(8, spec.sx * widthScale) * COOP_PLATFORM_SIZE_SCALE,
    z: Math.max(7.5, spec.sz * depthScale) * COOP_PLATFORM_SIZE_SCALE,
  };
}

function pad(
  id: string,
  spec: PadSpec,
  themeIndex: number,
): CoopAdventurePlatform {
  const theme = THEMES[themeIndex % THEMES.length]!;
  const kind = spec.kind ?? 'step';
  const size = scalePlatformSize(spec, themeIndex);
  const autoMotion =
    kind === 'step' && themeIndex % 2 === 0
      ? {
          kind: 'vertical' as const,
          amplitude: (1.45 + (themeIndex % 4) * 0.32) * 3,
          speed: (0.55 + (themeIndex % 3) * 0.12) * 2.2,
          phase: themeIndex * 0.83,
        }
      : null;
  return {
    id,
    position: { x: spec.x, y: spec.y, z: spec.z },
    size: { x: size.x, y: kind === 'start' ? 1.2 : 0.9, z: size.z },
    kind,
    shape: spec.shape ?? (kind === 'step' && themeIndex % 4 === 0 ? 'stack' : 'box'),
    motion: spec.motion ?? autoMotion,
    treeCount: spec.treeCount ?? (kind === 'step' && themeIndex % 2 === 0 ? 1 : kind === 'finish' ? 2 : 0),
    loveToken: spec.loveToken ?? (kind === 'step'),
    grass: theme.grass,
    side: theme.side,
  };
}

function buildLevel(
  id: number,
  name: string,
  tip: string,
  specs: PadSpec[],
): CoopAdventureLevel {
  const startSpec = specs[0]!;
  const spacedSpecs = specs.map((spec, i) =>
    i === 0
      ? spec
      : {
          ...spec,
          x: startSpec.x + (spec.x - startSpec.x) * COOP_PLATFORM_DISTANCE_SCALE,
          y:
            startSpec.y +
            (spec.y - startSpec.y) * 1.48 +
            (i % 2 === 0 ? 1.4 : -0.45) +
            Math.floor(i / 2) * 0.45,
          z: startSpec.z + (spec.z - startSpec.z) * COOP_PLATFORM_DISTANCE_SCALE,
        },
  );
  const platforms = spacedSpecs.map((spec, i) =>
    pad(`level-${id}-platform-${i}`, spec, id + i),
  );
  const start = platforms[0]!;
  const finish = platforms[platforms.length - 1]!;
  return {
    id,
    name,
    tip,
    spawn: {
      x: start.position.x,
      y: start.position.y + start.size.y * 0.5 + 2.1,
      z: start.position.z,
    },
    platforms,
    goal: {
      x: finish.position.x,
      y: finish.position.y + finish.size.y * 0.5 + 3.1,
      z: finish.position.z,
    },
  };
}

export const COOP_ADVENTURE_LEVELS: CoopAdventureLevel[] = [
  buildLevel(1, 'Cloud Steps', 'Warm up on wider jumps, then throw your teammate to the gate.', [
    { x: 0, y: 8, z: 26, sx: 24, sz: 18, kind: 'start' },
    { x: 0, y: 9.5, z: 4, sx: 13, sz: 10 },
    { x: 13, y: 11.2, z: -14, sx: 12, sz: 9 },
    { x: -8, y: 13.7, z: -32, sx: 11, sz: 9 },
    { x: 10, y: 16.2, z: -51, sx: 11, sz: 8 },
    { x: 0, y: 18.6, z: -72, sx: 14, sz: 10, kind: 'finish' },
  ]),
  buildLevel(2, 'Split Breeze', 'One player sets the angle while the other crosses the long side gaps.', [
    { x: 0, y: 10, z: 28, sx: 24, sz: 18, kind: 'start' },
    { x: -16, y: 11.5, z: 5, sx: 12, sz: 9 },
    { x: 15, y: 14, z: -13, sx: 11, sz: 9 },
    { x: -17, y: 15.5, z: -32, sx: 10, sz: 8 },
    { x: 5, y: 18.8, z: -51, sx: 10, sz: 8 },
    { x: 22, y: 21.5, z: -70, sx: 13, sz: 10, kind: 'finish' },
  ]),
  buildLevel(3, 'Updraft Alley', 'Throw higher than normal and catch each other on the rising islands.', [
    { x: 0, y: 8, z: 26, sx: 24, sz: 18, kind: 'start' },
    { x: 8, y: 12, z: 5, sx: 12, sz: 9 },
    { x: -7, y: 16, z: -13, sx: 11, sz: 8 },
    { x: 10, y: 20.5, z: -30, sx: 10, sz: 8 },
    { x: -10, y: 25, z: -47, sx: 10, sz: 8 },
    { x: 0, y: 29, z: -65, sx: 14, sz: 10, kind: 'finish' },
  ]),
  buildLevel(4, 'Long Catch', 'The middle platforms are smaller. Use controlled throws, not panic launches.', [
    { x: 0, y: 9, z: 28, sx: 24, sz: 18, kind: 'start' },
    { x: 0, y: 10.5, z: 1, sx: 12, sz: 8 },
    { x: -19, y: 12.2, z: -17, sx: 9, sz: 8 },
    { x: 10, y: 15.7, z: -36, sx: 9, sz: 7 },
    { x: 25, y: 18.6, z: -56, sx: 9, sz: 7 },
    { x: 3, y: 21.5, z: -77, sx: 13, sz: 10, kind: 'finish' },
  ]),
  buildLevel(5, 'Staircase Sky', 'Trade throws upward and keep one teammate ready to rescue the other.', [
    { x: 0, y: 8, z: 28, sx: 24, sz: 18, kind: 'start' },
    { x: -8, y: 12.5, z: 6, sx: 12, sz: 9 },
    { x: 8, y: 17, z: -12, sx: 11, sz: 8 },
    { x: -8, y: 21.5, z: -30, sx: 10, sz: 8 },
    { x: 8, y: 26, z: -48, sx: 10, sz: 8 },
    { x: 0, y: 31, z: -68, sx: 14, sz: 10, kind: 'finish' },
  ]),
  buildLevel(6, 'Crosswind', 'The route bends hard left and right. Aim throws ahead of the platform.', [
    { x: 0, y: 10, z: 30, sx: 24, sz: 18, kind: 'start' },
    { x: 20, y: 12, z: 9, sx: 12, sz: 9 },
    { x: 2, y: 14, z: -12, sx: 11, sz: 8 },
    { x: -22, y: 16.5, z: -31, sx: 10, sz: 8 },
    { x: -2, y: 19, z: -52, sx: 10, sz: 8 },
    { x: 20, y: 22, z: -73, sx: 13, sz: 10, kind: 'finish' },
  ]),
  buildLevel(7, 'Tiny Islands', 'Small pads make catching matter. Throw one player, then pull the other across.', [
    { x: 0, y: 9, z: 28, sx: 24, sz: 18, kind: 'start' },
    { x: -10, y: 11.5, z: 4, sx: 10, sz: 8 },
    { x: 10, y: 13, z: -16, sx: 8.5, sz: 7 },
    { x: -12, y: 16, z: -36, sx: 8.5, sz: 7 },
    { x: 12, y: 19.5, z: -56, sx: 8.5, sz: 7 },
    { x: 0, y: 23, z: -78, sx: 12, sz: 9, kind: 'finish' },
  ]),
  buildLevel(8, 'High Relay', 'This one is about vertical timing. Throw up, land, and reset for the next toss.', [
    { x: 0, y: 8, z: 28, sx: 24, sz: 18, kind: 'start' },
    { x: 0, y: 13, z: 4, sx: 13, sz: 9 },
    { x: 16, y: 18, z: -14, sx: 11, sz: 8 },
    { x: -5, y: 24, z: -31, sx: 10, sz: 8 },
    { x: -20, y: 29, z: -51, sx: 10, sz: 8 },
    { x: 0, y: 35, z: -70, sx: 14, sz: 10, kind: 'finish' },
  ]),
  buildLevel(9, 'Skyhook Swerve', 'Long diagonal throws are the trick. Keep the receiver facing the next island.', [
    { x: 0, y: 10, z: 30, sx: 24, sz: 18, kind: 'start' },
    { x: -22, y: 13, z: 8, sx: 11, sz: 8 },
    { x: -5, y: 16, z: -15, sx: 10, sz: 8 },
    { x: 20, y: 19, z: -36, sx: 10, sz: 8 },
    { x: 2, y: 23, z: -58, sx: 10, sz: 8 },
    { x: -22, y: 27, z: -80, sx: 13, sz: 10, kind: 'finish' },
  ]),
  buildLevel(10, 'Cloud Crown', 'Final relay. Big distance, big height, and one clean finish gate.', [
    { x: 0, y: 9, z: 30, sx: 26, sz: 19, kind: 'start' },
    { x: 18, y: 13, z: 8, sx: 12, sz: 9 },
    { x: -14, y: 17, z: -14, sx: 11, sz: 8 },
    { x: 16, y: 22, z: -36, sx: 10, sz: 8 },
    { x: -16, y: 28, z: -58, sx: 10, sz: 8 },
    { x: 0, y: 36, z: -84, sx: 16, sz: 11, kind: 'finish' },
  ]),
];
