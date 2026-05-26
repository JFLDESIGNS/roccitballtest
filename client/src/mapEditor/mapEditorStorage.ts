import {
  createEmptyMapDocument,
  DEFAULT_MAP_ID,
  DEFAULT_MAP_NAME,
  type MapDocument,
  type MapLight,
  type MapSummary,
} from './mapEditorTypes';
import { normalizeMapLight } from './mapLightDefaults';

const REGISTRY_KEY = 'rocketball-map-registry-v1';
const ACTIVE_MAP_KEY = 'rocketball-active-map-v1';

type StoredRegistry = {
  maps: MapDocument[];
};

function loadRegistry(): StoredRegistry {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return { maps: [] };
    const parsed = JSON.parse(raw) as StoredRegistry;
    if (!parsed || !Array.isArray(parsed.maps)) return { maps: [] };
    return { maps: parsed.maps.filter(isValidMapDocument) };
  } catch {
    return { maps: [] };
  }
}

function persistRegistry(maps: MapDocument[]): void {
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify({ maps }));
  } catch {
    /* ignore quota */
  }
}

function isValidMapDocument(doc: unknown): doc is MapDocument {
  if (!doc || typeof doc !== 'object') return false;
  const d = doc as MapDocument;
  return (
    typeof d.id === 'string' &&
    typeof d.name === 'string' &&
    Array.isArray(d.objects) &&
    Array.isArray(d.lights) &&
    (d.groups === undefined || Array.isArray(d.groups))
  );
}

export function importMapDocumentFromJson(raw: string): MapDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON.');
  }
  if (!isValidMapDocument(parsed)) {
    throw new Error('JSON does not look like a RocccitBall map document.');
  }

  const d = parsed as MapDocument;
  const now = Date.now();
  const id =
    !d.id || d.id === DEFAULT_MAP_ID
      ? `map-${now}-${Math.random().toString(36).slice(2, 8)}`
      : d.id;
  const name = (d.name ?? '').trim() || 'Imported Map';

  const normalized: MapDocument = {
    id,
    name,
    createdAt: typeof d.createdAt === 'number' ? d.createdAt : now,
    updatedAt: now,
    groups: (d.groups ?? []).map((g) => ({ ...g })),
    objects: d.objects.map((o) => ({ ...o })),
    lights: d.lights.map((l) => normalizeMapLight(l as MapLight)),
  };

  return saveCustomMap(normalized);
}

export function loadActiveMapId(): string {
  try {
    const id = localStorage.getItem(ACTIVE_MAP_KEY);
    if (!id || id === DEFAULT_MAP_ID) return DEFAULT_MAP_ID;
    const exists = loadRegistry().maps.some((m) => m.id === id);
    return exists ? id : DEFAULT_MAP_ID;
  } catch {
    return DEFAULT_MAP_ID;
  }
}

export function persistActiveMapId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_MAP_KEY, id);
  } catch {
    /* ignore */
  }
}

export function listCustomMapSummaries(): MapSummary[] {
  return loadRegistry()
    .maps.map(({ id, name, updatedAt }) => ({ id, name, updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getCustomMapById(id: string): MapDocument | null {
  if (id === DEFAULT_MAP_ID) return null;
  return loadRegistry().maps.find((m) => m.id === id) ?? null;
}

export function getActiveMapDocument(activeId: string): MapDocument | null {
  if (activeId === DEFAULT_MAP_ID) return null;
  return getCustomMapById(activeId);
}

export function saveCustomMap(doc: MapDocument): MapDocument {
  if (doc.id === DEFAULT_MAP_ID) {
    throw new Error('Cannot save over the default arena map.');
  }
  const normalized: MapDocument = {
    ...doc,
    updatedAt: Date.now(),
    groups: (doc.groups ?? []).map((g) => ({ ...g })),
    objects: doc.objects.map((o) => ({ ...o })),
    lights: doc.lights.map((l) => ({ ...l })),
  };
  const registry = loadRegistry();
  const idx = registry.maps.findIndex((m) => m.id === normalized.id);
  if (idx >= 0) {
    registry.maps[idx] = normalized;
  } else {
    registry.maps.push(normalized);
  }
  persistRegistry(registry.maps);
  return normalized;
}

export function deleteCustomMap(id: string): boolean {
  if (id === DEFAULT_MAP_ID) return false;
  const registry = loadRegistry();
  const next = registry.maps.filter((m) => m.id !== id);
  if (next.length === registry.maps.length) return false;
  persistRegistry(next);
  return true;
}

export function createNewCustomMap(name: string): MapDocument {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Map name is required.');
  if (trimmed.toLowerCase() === DEFAULT_MAP_NAME.toLowerCase()) {
    throw new Error('That name is reserved for the built-in arena.');
  }
  const doc = createEmptyMapDocument(trimmed);
  saveCustomMap(doc);
  return doc;
}

export function cloneMapDocument(doc: MapDocument, newName: string): MapDocument {
  const copy = createEmptyMapDocument(newName.trim());
  copy.groups = doc.groups?.map((g) => ({ ...g, id: `group-${crypto.randomUUID().slice(0, 8)}` })) ?? [];
  copy.objects = doc.objects.map((o) => ({ ...o, id: `obj-${crypto.randomUUID().slice(0, 8)}` }));
  copy.lights = doc.lights.map((l) => ({ ...l, id: `light-${crypto.randomUUID().slice(0, 8)}` }));
  return saveCustomMap(copy);
}

export function isDefaultMapId(id: string): boolean {
  return id === DEFAULT_MAP_ID;
}
