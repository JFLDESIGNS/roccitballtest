import { arenaPillarTopWorldY } from './arenaPillarConfig';
import type { StadiumLightDef } from './stadiumLightTypes';

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
      intensity: 0.38,
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
      intensity: 0.38,
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
      intensity: 0.38,
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
      intensity: 0.38,
      distance: 118,
      decay: 1.05,
      castShadow: true,
      enabled: true,
      brightnessMenuKey: 'keyLight3',
      linkGroup: 'key3',
    },
  ];

  return lights;
}
