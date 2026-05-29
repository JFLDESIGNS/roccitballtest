import type { Vec3 } from '../shared/Types';

export type CoopAdventurePlatform = {
  id: string;
  position: Vec3;
  size: Vec3;
  color: string;
};

export type CoopAdventureLevel = {
  id: number;
  name: string;
  tip: string;
  platforms: CoopAdventurePlatform[];
  goal: Vec3;
};

const base = [
  { id: 'spawn-a', position: { x: 0, y: 3.2, z: 18 }, size: { x: 14, y: 0.55, z: 10 }, color: '#27476f' },
  { id: 'spawn-b', position: { x: 0, y: 3.2, z: 3 }, size: { x: 12, y: 0.55, z: 8 }, color: '#213a5f' },
];

export const COOP_ADVENTURE_LEVELS: CoopAdventureLevel[] = [
  {
    id: 1,
    name: 'First Toss',
    tip: 'Attract your partner, release RMB, and throw them to the lit pad.',
    platforms: [
      ...base,
      { id: 'first-goal', position: { x: 0, y: 7.4, z: -12 }, size: { x: 10, y: 0.55, z: 7 }, color: '#1d5563' },
    ],
    goal: { x: 0, y: 9.1, z: -12 },
  },
  {
    id: 2,
    name: 'Split Step',
    tip: 'One player crosses, then throws the other up the staggered pads.',
    platforms: [
      ...base,
      { id: 'split-left', position: { x: -12, y: 7.8, z: -7 }, size: { x: 8, y: 0.55, z: 7 }, color: '#37506b' },
      { id: 'split-right', position: { x: 13, y: 11.2, z: -20 }, size: { x: 8, y: 0.55, z: 7 }, color: '#1d6b67' },
    ],
    goal: { x: 13, y: 12.9, z: -20 },
  },
  {
    id: 3,
    name: 'High Five',
    tip: 'Throw upward. The goal is higher than it looks.',
    platforms: [
      ...base,
      { id: 'high-low', position: { x: 0, y: 8, z: -8 }, size: { x: 9, y: 0.55, z: 7 }, color: '#3d3c72' },
      { id: 'high-top', position: { x: 0, y: 15, z: -22 }, size: { x: 8, y: 0.55, z: 7 }, color: '#5d376d' },
    ],
    goal: { x: 0, y: 16.7, z: -22 },
  },
  {
    id: 4,
    name: 'Corner Catch',
    tip: 'Aim across the lane and catch your teammate on the corner island.',
    platforms: [
      ...base,
      { id: 'corner-left', position: { x: -17, y: 7.2, z: -11 }, size: { x: 8, y: 0.55, z: 8 }, color: '#284d71' },
      { id: 'corner-right', position: { x: 17, y: 10.6, z: -24 }, size: { x: 8, y: 0.55, z: 8 }, color: '#714135' },
    ],
    goal: { x: 17, y: 12.3, z: -24 },
  },
  {
    id: 5,
    name: 'Needle Run',
    tip: 'Short controlled throws are better than one huge launch.',
    platforms: [
      ...base,
      { id: 'needle-a', position: { x: -8, y: 7, z: -8 }, size: { x: 6, y: 0.55, z: 6 }, color: '#324f7a' },
      { id: 'needle-b', position: { x: 8, y: 9, z: -18 }, size: { x: 6, y: 0.55, z: 6 }, color: '#2b6960' },
      { id: 'needle-c', position: { x: 0, y: 12, z: -28 }, size: { x: 6, y: 0.55, z: 6 }, color: '#6c5430' },
    ],
    goal: { x: 0, y: 13.7, z: -28 },
  },
  {
    id: 6,
    name: 'Elevator Toss',
    tip: 'Stand under the target and throw almost straight up.',
    platforms: [
      ...base,
      { id: 'elevator-mid', position: { x: 0, y: 8.5, z: -6 }, size: { x: 10, y: 0.55, z: 7 }, color: '#305d79' },
      { id: 'elevator-top', position: { x: 0, y: 18.5, z: -9 }, size: { x: 9, y: 0.55, z: 7 }, color: '#713a5b' },
    ],
    goal: { x: 0, y: 20.2, z: -9 },
  },
  {
    id: 7,
    name: 'Wide Wing',
    tip: 'Cross the arena wall side, then throw back toward center.',
    platforms: [
      ...base,
      { id: 'wing-a', position: { x: 22, y: 7.5, z: -3 }, size: { x: 8, y: 0.55, z: 8 }, color: '#36516d' },
      { id: 'wing-b', position: { x: 26, y: 10.5, z: -20 }, size: { x: 8, y: 0.55, z: 8 }, color: '#2f6d53' },
      { id: 'wing-c', position: { x: 9, y: 13.4, z: -29 }, size: { x: 8, y: 0.55, z: 8 }, color: '#6b333d' },
    ],
    goal: { x: 9, y: 15.1, z: -29 },
  },
  {
    id: 8,
    name: 'Twin Towers',
    tip: 'Use the low towers as setup throws for the final high landing.',
    platforms: [
      ...base,
      { id: 'tower-left', position: { x: -15, y: 8.5, z: -8 }, size: { x: 7, y: 0.55, z: 7 }, color: '#274f77' },
      { id: 'tower-right', position: { x: 15, y: 8.5, z: -8 }, size: { x: 7, y: 0.55, z: 7 }, color: '#663c70' },
      { id: 'tower-top', position: { x: 0, y: 16.8, z: -24 }, size: { x: 8, y: 0.55, z: 7 }, color: '#316c66' },
    ],
    goal: { x: 0, y: 18.5, z: -24 },
  },
  {
    id: 9,
    name: 'The Skip',
    tip: 'Throw past the middle island or use it as a rescue pad.',
    platforms: [
      ...base,
      { id: 'skip-small', position: { x: 0, y: 6.5, z: -4 }, size: { x: 5, y: 0.55, z: 5 }, color: '#424f6d' },
      { id: 'skip-left', position: { x: -20, y: 12.4, z: -20 }, size: { x: 9, y: 0.55, z: 8 }, color: '#6d5640' },
      { id: 'skip-goal', position: { x: 5, y: 17, z: -31 }, size: { x: 8, y: 0.55, z: 7 }, color: '#30616a' },
    ],
    goal: { x: 5, y: 18.7, z: -31 },
  },
  {
    id: 10,
    name: 'Final Relay',
    tip: 'Trade throws all the way up. The final pad is the victory gate.',
    platforms: [
      ...base,
      { id: 'final-a', position: { x: -14, y: 8, z: -6 }, size: { x: 7, y: 0.55, z: 7 }, color: '#365a75' },
      { id: 'final-b', position: { x: 14, y: 11, z: -16 }, size: { x: 7, y: 0.55, z: 7 }, color: '#634979' },
      { id: 'final-c', position: { x: -8, y: 15, z: -26 }, size: { x: 7, y: 0.55, z: 7 }, color: '#65623a' },
      { id: 'final-d', position: { x: 8, y: 20, z: -34 }, size: { x: 8, y: 0.55, z: 7 }, color: '#2f7167' },
    ],
    goal: { x: 8, y: 21.7, z: -34 },
  },
];
