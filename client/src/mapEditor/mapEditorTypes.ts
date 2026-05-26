export type MapTextureId = 'concrete' | 'metal' | 'darkMetal' | 'flat';

export type MapPrimitiveKind =
  | 'box'
  | 'sphere'
  | 'cylinder'
  | 'plane'
  | 'alphaShadow';

export type MapObject = {
  id: string;
  kind: MapPrimitiveKind;
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  textureId: MapTextureId;
  color: string;
  /** When set, object moves with this group (local transform). */
  groupId?: string;
};

export type MapGroup = {
  id: string;
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  /** Built-in arena piece id, e.g. goal:red-ring-large or pillar:0 */
  stadiumKey?: string;
};

export type MapLightKind = 'point' | 'spot' | 'directional' | 'rectArea';

export type MapLight = {
  id: string;
  name: string;
  kind: MapLightKind;
  position: [number, number, number];
  rotation: [number, number, number];
  color: string;
  intensity: number;
  distance: number;
  angle: number;
  penumbra: number;
  /** Rect area light panel width (m) */
  rectWidth: number;
  /** Rect area light panel height (m) */
  rectHeight: number;
  castShadow: boolean;
};

export type MapDocument = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  groups: MapGroup[];
  objects: MapObject[];
  lights: MapLight[];
};

export type MapSummary = Pick<MapDocument, 'id' | 'name' | 'updatedAt'>;

export type TransformMode = 'translate' | 'rotate' | 'scale';

export const DEFAULT_MAP_ID = '__default__';
export const DEFAULT_MAP_NAME = 'Default Arena';

export const MAP_TEXTURE_OPTIONS: { id: MapTextureId; label: string }[] = [
  { id: 'concrete', label: 'Concrete' },
  { id: 'metal', label: 'Brushed metal' },
  { id: 'darkMetal', label: 'Dark metal' },
  { id: 'flat', label: 'Flat color' },
];

export function createEmptyMapDocument(name: string, id?: string): MapDocument {
  const now = Date.now();
  return {
    id: id ?? `map-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: now,
    updatedAt: now,
    objects: [],
    lights: [],
    groups: [],
  };
}

export function createMapObject(kind: MapPrimitiveKind): MapObject {
  const id = `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const names: Record<MapPrimitiveKind, string> = {
    box: 'Box',
    sphere: 'Sphere',
    cylinder: 'Cylinder',
    plane: 'Plane',
    alphaShadow: 'Alpha shadow',
  };
  const scale: [number, number, number] =
    kind === 'plane'
      ? [6, 1, 6]
      : kind === 'alphaShadow'
        ? [10, 10, 1]
        : kind === 'sphere'
          ? [2, 2, 2]
          : [2, 2, 2];
  return {
    id,
    kind,
    name: names[kind],
    position:
      kind === 'alphaShadow' ? [0, 0.08, 0] : kind === 'plane' ? [0, 0, 0] : [0, 3, 0],
    rotation:
      kind === 'plane' || kind === 'alphaShadow'
        ? [-Math.PI / 2, 0, 0]
        : [0, 0, 0],
    scale,
    textureId: 'concrete',
    color: '#b8bec6',
  };
}

export function createMapLight(kind: MapLightKind): MapLight {
  const id = `light-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const names: Record<MapLightKind, string> = {
    point: 'Point light',
    spot: 'Spot light',
    directional: 'Directional light',
    rectArea: 'Rect area light',
  };
  return {
    id,
    name: names[kind],
    kind,
    position: [0, 12, 0],
    rotation:
      kind === 'rectArea'
        ? [-Math.PI / 2, 0, 0]
        : kind === 'directional'
          ? [-Math.PI / 3, 0.4, 0]
          : [-Math.PI / 4, 0, 0],
    color: '#ffffff',
    intensity:
      kind === 'directional' ? 1.2 : kind === 'rectArea' ? 6 : 2.5,
    distance: 48,
    angle: Math.PI / 5,
    penumbra: 0.35,
    rectWidth: 14,
    rectHeight: 8,
    castShadow: false,
  };
}
