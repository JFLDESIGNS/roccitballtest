import type { MapLight, MapLightKind } from './mapEditorTypes';

export const MAP_LIGHT_SHADOW_PROPS = {
  'shadow-mapSize': [1024, 1024] as [number, number],
  'shadow-bias': -0.00025,
  'shadow-normalBias': 0.02,
} as const;

export function normalizeMapLight(light: MapLight): MapLight {
  const kind = light.kind ?? 'point';
  return {
    id: light.id,
    name: light.name,
    kind,
    position: light.position ?? [0, 12, 0],
    rotation: light.rotation ?? [-Math.PI / 4, 0, 0],
    color: light.color ?? '#ffffff',
    intensity: light.intensity ?? (kind === 'directional' ? 1.2 : 2.5),
    distance: light.distance ?? 48,
    angle: light.angle ?? Math.PI / 5,
    penumbra: light.penumbra ?? 0.35,
    rectWidth: light.rectWidth ?? 14,
    rectHeight: light.rectHeight ?? 8,
    castShadow: light.castShadow ?? false,
  };
}

export function defaultLightRotation(kind: MapLightKind): [number, number, number] {
  if (kind === 'rectArea') return [-Math.PI / 2, 0, 0];
  if (kind === 'directional') return [-Math.PI / 3, 0.4, 0];
  return [-Math.PI / 4, 0, 0];
}
