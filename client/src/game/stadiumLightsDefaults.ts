import { ARENA } from '../shared/Constants';
import { arenaPillarTopWorldY } from './arenaPillarConfig';
import type { StadiumLightDef } from './stadiumLightTypes';

const FT = 0.3048;
const STRIP_HEIGHT_FT = 132;
const stripLengthM = ARENA.hexRadius * 2.45;
const stripYM = ARENA.platformTopHeight + STRIP_HEIGHT_FT * FT;
const stripGapM = 34 * FT;
const stripWidthM = 150 * FT;
const centerOffsetZ = stripGapM * 0.5 + stripWidthM * 0.5;
const stripXs = [-stripLengthM * 0.32, 0, stripLengthM * 0.32];

function keyMountY(): number {
  return arenaPillarTopWorldY() - 8.5;
}

/** Default stadium lights — export from fly-mode editor copies this shape */
export function buildDefaultStadiumLights(): StadiumLightDef[] {
  const y2 = keyMountY();
  const lights: StadiumLightDef[] = [
    {
      id: 'outdoor-key-1',
      name: 'Key 1 (outdoor sun)',
      kind: 'directional',
      position: [38, 62, 22],
      rotation: [-0.72, 0.38, 0],
      color: '#fff4ea',
      intensity: 0.88,
      castShadow: true,
      enabled: true,
      roofGated: true,
    },
    {
      id: 'key-2-rect',
      name: 'Key 2 rect',
      kind: 'rectArea',
      position: [-26, y2, 24],
      rotation: [-Math.PI / 2, 0, 0],
      color: '#fff0e0',
      intensity: 1,
      rectWidth: 40,
      rectHeight: 40,
      castShadow: false,
      enabled: true,
      brightnessMenuKey: 'keyLight2',
      linkGroup: 'key2',
    },
    {
      id: 'key-2-omni',
      name: 'Key 2 omni',
      kind: 'point',
      position: [-26, y2, 24],
      rotation: [0, 0, 0],
      color: '#fff0e0',
      intensity: 1,
      distance: 118,
      decay: 1.05,
      castShadow: true,
      enabled: true,
      brightnessMenuKey: 'keyLight2',
      linkGroup: 'key2',
    },
    {
      id: 'key-3-rect',
      name: 'Key 3 rect',
      kind: 'rectArea',
      position: [26, y2, -24],
      rotation: [-Math.PI / 2, 0, 0],
      color: '#dfe8f5',
      intensity: 1,
      rectWidth: 40,
      rectHeight: 40,
      castShadow: false,
      enabled: true,
      brightnessMenuKey: 'keyLight3',
      linkGroup: 'key3',
    },
    {
      id: 'key-3-omni',
      name: 'Key 3 omni',
      kind: 'point',
      position: [26, y2, -24],
      rotation: [0, 0, 0],
      color: '#dfe8f5',
      intensity: 1,
      distance: 118,
      decay: 1.05,
      castShadow: true,
      enabled: true,
      brightnessMenuKey: 'keyLight3',
      linkGroup: 'key3',
    },
  ];

  const stripZ = [-centerOffsetZ, centerOffsetZ];
  stripZ.forEach((z, stripIdx) => {
    stripXs.forEach((x, i) => {
      lights.push({
        id: `strip-${stripIdx}-${i}`,
        name: `Ceiling strip ${stripIdx + 1} · ${i + 1}`,
        kind: 'point',
        position: [x, stripYM, z],
        rotation: [0, 0, 0],
        color: '#f0f2f4',
        intensity: 1,
        distance: stripYM * 2.6,
        decay: 1.6,
        castShadow: false,
        enabled: true,
        roofGated: true,
        stripMenu: true,
      });
    });
  });

  return lights;
}
