import {
  createMapLight,
  createMapObject,
  DEFAULT_MAP_ID,
  type MapDocument,
  type MapGroup,
  type MapLight,
  type MapLightKind,
  type MapObject,
  type MapPrimitiveKind,
  type MapSummary,
  type MapTextureId,
  type TransformMode,
} from './mapEditorTypes';
import {
  createNewCustomMap,
  getCustomMapById,
  isDefaultMapId,
  loadActiveMapId,
  listCustomMapSummaries,
  persistActiveMapId,
  importMapDocumentFromJson,
  saveCustomMap,
} from './mapEditorStorage';
import { snapPositionToMoveGrid } from './editorMoveGrid';
import { ensureDocumentGroups } from './stadiumLayout';
import { normalizeMapLight } from './mapLightDefaults';

type EditorState = {
  document: MapDocument;
  selectedId: string | null;
  transformMode: TransformMode;
  dirty: boolean;
  editingMapId: string | null;
  /** When false (default), clicking a grouped object selects its parent group. */
  selectIndividual: boolean;
  showMoveGrid: boolean;
  snapToMoveGrid: boolean;
};

function maybeSnapPosition(
  position: [number, number, number],
): [number, number, number] {
  if (state.transformMode !== 'translate' || !state.snapToMoveGrid) {
    return position;
  }
  return snapPositionToMoveGrid(position);
}

const listeners = new Set<() => void>();
let suppressPointerMissUntil = 0;

function notify(): void {
  listeners.forEach((l) => l());
}

function cloneDoc(doc: MapDocument): MapDocument {
  return {
    ...doc,
    groups: doc.groups.map((g) => ({ ...g })),
    objects: doc.objects.map((o) => ({ ...o })),
    lights: doc.lights.map((l) => ({ ...l })),
  };
}

function normalizeDocument(doc: MapDocument): MapDocument {
  return {
    ...doc,
    groups: ensureDocumentGroups(doc.groups),
    objects: doc.objects ?? [],
    lights: (doc.lights ?? []).map((l) => normalizeMapLight(l as MapLight)),
  };
}

function createEditorDocument(name: string): MapDocument {
  return normalizeDocument({
    id: '',
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    groups: [],
    objects: [],
    lights: [],
  });
}

function resolveSelectionId(id: string, state: EditorState): string {
  if (state.selectIndividual) return id;
  const obj = state.document.objects.find((o) => o.id === id);
  if (obj?.groupId) return obj.groupId;
  return id;
}

let state: EditorState = {
  document: createEditorDocument('Untitled'),
  selectedId: null,
  transformMode: 'translate',
  dirty: false,
  editingMapId: null,
  selectIndividual: false,
  showMoveGrid: true,
  snapToMoveGrid: true,
};

function patch(partial: Partial<EditorState>): void {
  state = { ...state, ...partial };
  notify();
}

export const mapEditorStore = {
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getState: () => state,
  shouldSuppressPointerMiss: () => performance.now() < suppressPointerMissUntil,

  openEditor: (mapId?: string) => {
    const id = mapId ?? loadActiveMapId();
    if (isDefaultMapId(id)) {
      patch({
        document: createEditorDocument('Untitled'),
        selectedId: null,
        transformMode: 'translate',
        dirty: false,
        editingMapId: null,
        selectIndividual: false,
      });
      return;
    }
    const doc = getCustomMapById(id);
    if (!doc) {
      mapEditorStore.openEditor(DEFAULT_MAP_ID);
      return;
    }
    patch({
      document: normalizeDocument(cloneDoc(doc)),
      selectedId: null,
      transformMode: 'translate',
      dirty: false,
      editingMapId: doc.id,
      selectIndividual: false,
    });
  },

  setTransformMode: (mode: TransformMode) => patch({ transformMode: mode }),

  setSelectIndividual: (value: boolean) => patch({ selectIndividual: value }),

  select: (id: string | null) => {
    if (!id) {
      patch({ selectedId: null });
      return;
    }
    patch({ selectedId: resolveSelectionId(id, state) });
  },

  addObject: (kind: MapPrimitiveKind) => {
    const obj = createMapObject(kind);
    const selectedGroup = state.selectedId
      ? state.document.groups.find((g) => g.id === state.selectedId)
      : null;
    if (selectedGroup && !selectedGroup.stadiumKey) {
      obj.groupId = selectedGroup.id;
      obj.position = [0, 1.5, 0];
    }
    suppressPointerMissUntil = performance.now() + 80;
    patch({
      document: {
        ...state.document,
        objects: [...state.document.objects, obj],
      },
      selectedId: resolveSelectionId(obj.id, state),
      dirty: true,
    });
  },

  addLight: (kind: MapLightKind) => {
    const light = createMapLight(kind);
    suppressPointerMissUntil = performance.now() + 40;
    patch({
      document: {
        ...state.document,
        lights: [...state.document.lights, light],
      },
      selectedId: light.id,
      dirty: true,
    });
  },

  updateObject: (id: string, partial: Partial<MapObject>) => {
    patch({
      document: {
        ...state.document,
        objects: state.document.objects.map((o) =>
          o.id === id ? { ...o, ...partial } : o,
        ),
      },
      dirty: true,
    });
  },

  updateGroup: (id: string, partial: Partial<MapGroup>) => {
    patch({
      document: {
        ...state.document,
        groups: state.document.groups.map((g) =>
          g.id === id ? { ...g, ...partial } : g,
        ),
      },
      dirty: true,
    });
  },

  updateLight: (id: string, partial: Partial<MapLight>) => {
    patch({
      document: {
        ...state.document,
        lights: state.document.lights.map((l) =>
          l.id === id ? { ...l, ...partial } : l,
        ),
      },
      dirty: true,
    });
  },

  syncObjectTransform: (
    id: string,
    position: [number, number, number],
    rotation: [number, number, number],
    scale: [number, number, number],
  ) => {
    const snapped = maybeSnapPosition(position);
    patch({
      document: {
        ...state.document,
        objects: state.document.objects.map((o) =>
          o.id === id ? { ...o, position: snapped, rotation, scale } : o,
        ),
      },
      dirty: true,
    });
  },

  syncGroupTransform: (
    id: string,
    position: [number, number, number],
    rotation: [number, number, number],
    scale: [number, number, number],
  ) => {
    const snapped = maybeSnapPosition(position);
    patch({
      document: {
        ...state.document,
        groups: state.document.groups.map((g) =>
          g.id === id ? { ...g, position: snapped, rotation, scale } : g,
        ),
      },
      dirty: true,
    });
  },

  syncLightTransform: (
    id: string,
    position: [number, number, number],
    rotation: [number, number, number],
  ) => {
    const snapped = maybeSnapPosition(position);
    patch({
      document: {
        ...state.document,
        lights: state.document.lights.map((l) =>
          l.id === id ? { ...l, position: snapped, rotation } : l,
        ),
      },
      dirty: true,
    });
  },

  syncLightRectSize: (id: string, width: number, height: number) => {
    patch({
      document: {
        ...state.document,
        lights: state.document.lights.map((l) =>
          l.id === id
            ? {
                ...l,
                rectWidth: Math.max(0.5, width),
                rectHeight: Math.max(0.5, height),
              }
            : l,
        ),
      },
      dirty: true,
    });
  },

  setShowMoveGrid: (v: boolean) => patch({ showMoveGrid: v }),
  setSnapToMoveGrid: (v: boolean) => patch({ snapToMoveGrid: v }),

  setObjectTexture: (id: string, textureId: MapTextureId) => {
    mapEditorStore.updateObject(id, { textureId });
  },

  createGroupFromSelected: () => {
    const id = state.selectedId;
    if (!id) return;
    const obj = state.document.objects.find((o) => o.id === id);
    if (!obj || obj.groupId) return;
    const group: MapGroup = {
      id: `group-${Date.now()}`,
      name: `${obj.name} group`,
      position: [...obj.position],
      rotation: [...obj.rotation],
      scale: [...obj.scale],
    };
    patch({
      document: {
        ...state.document,
        groups: [...state.document.groups, group],
        objects: state.document.objects.map((o) =>
          o.id === obj.id
            ? {
                ...o,
                groupId: group.id,
                position: [0, 0, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
              }
            : o,
        ),
      },
      selectedId: group.id,
      dirty: true,
    });
  },

  deleteSelected: () => {
    const id = state.selectedId;
    if (!id) return;
    const isGroup = state.document.groups.some((g) => g.id === id);
    if (isGroup) {
      const group = state.document.groups.find((g) => g.id === id);
      if (group?.stadiumKey) return;
      patch({
        document: {
          ...state.document,
          groups: state.document.groups.filter((g) => g.id !== id),
          objects: state.document.objects.map((o) => {
            if (o.groupId !== id) return o;
            return {
              ...o,
              groupId: undefined,
              position: [
                group!.position[0] + o.position[0],
                group!.position[1] + o.position[1],
                group!.position[2] + o.position[2],
              ] as [number, number, number],
            };
          }),
        },
        selectedId: null,
        dirty: true,
      });
      return;
    }
    patch({
      document: {
        ...state.document,
        objects: state.document.objects.filter((o) => o.id !== id),
        lights: state.document.lights.filter((l) => l.id !== id),
      },
      selectedId: null,
      dirty: true,
    });
  },

  duplicateSelected: () => {
    const id = state.selectedId;
    if (!id) return;
    const group = state.document.groups.find((g) => g.id === id);
    if (group) {
      const copy: MapGroup = {
        ...group,
        id: `group-${Date.now()}`,
        name: `${group.name} copy`,
        stadiumKey: undefined,
        position: [group.position[0] + 2, group.position[1], group.position[2] + 2],
      };
      patch({
        document: {
          ...state.document,
          groups: [...state.document.groups, copy],
        },
        selectedId: copy.id,
        dirty: true,
      });
      return;
    }
    const obj = state.document.objects.find((o) => o.id === id);
    if (obj) {
      const copy: MapObject = {
        ...obj,
        id: `obj-${Date.now()}`,
        name: `${obj.name} copy`,
        position: [obj.position[0] + 1, obj.position[1], obj.position[2] + 1],
        groupId: undefined,
      };
      patch({
        document: {
          ...state.document,
          objects: [...state.document.objects, copy],
        },
        selectedId: copy.id,
        dirty: true,
      });
      return;
    }
    const light = state.document.lights.find((l) => l.id === id);
    if (light) {
      const copy: MapLight = {
        ...light,
        id: `light-${Date.now()}`,
        name: `${light.name} copy`,
        position: [light.position[0] + 1, light.position[1], light.position[2]],
      };
      patch({
        document: {
          ...state.document,
          lights: [...state.document.lights, copy],
        },
        selectedId: copy.id,
        dirty: true,
      });
    }
  },

  saveCurrent: (): MapDocument | null => {
    if (state.editingMapId) {
      const saved = saveCustomMap({
        ...state.document,
        id: state.editingMapId,
      });
      mapRegistryStore.refresh();
      mapRegistryStore.setActiveMapId(saved.id);
      patch({ document: cloneDoc(saved), dirty: false, editingMapId: saved.id });
      return saved;
    }
    return null;
  },

  saveAsNew: (name: string): MapDocument => {
    const doc = createNewCustomMap(name);
    const merged: MapDocument = {
      ...doc,
      groups: state.document.groups.map((g) => ({ ...g })),
      objects: state.document.objects.map((o) => ({ ...o })),
      lights: state.document.lights.map((l) => ({ ...l })),
    };
    const saved = saveCustomMap(merged);
    mapRegistryStore.setActiveMapId(saved.id);
    patch({
      document: cloneDoc(saved),
      dirty: false,
      editingMapId: saved.id,
    });
    return saved;
  },

  importFromJson: (raw: string): MapDocument => {
    const saved = importMapDocumentFromJson(raw);
    mapRegistryStore.refresh();
    mapRegistryStore.setActiveMapId(saved.id);
    patch({
      document: normalizeDocument(cloneDoc(saved)),
      selectedId: null,
      transformMode: 'translate',
      dirty: false,
      editingMapId: saved.id,
      selectIndividual: false,
    });
    return saved;
  },

  canSaveInPlace: () =>
    state.editingMapId !== null && !isDefaultMapId(state.editingMapId),
};

const registryListeners = new Set<() => void>();

function notifyRegistry(): void {
  registryListeners.forEach((l) => l());
}

let activeMapId = loadActiveMapId();
let cachedSummaries: MapSummary[] = [];
let cachedActiveDocument: MapDocument | null = null;

function refreshRegistryCache(): void {
  cachedSummaries = listCustomMapSummaries();
  cachedActiveDocument = isDefaultMapId(activeMapId)
    ? null
    : getCustomMapById(activeMapId);
  if (cachedActiveDocument) {
    cachedActiveDocument = normalizeDocument(cachedActiveDocument);
  }
}

refreshRegistryCache();

export const mapRegistryStore = {
  subscribe: (fn: () => void) => {
    registryListeners.add(fn);
    return () => registryListeners.delete(fn);
  },
  getActiveMapId: () => activeMapId,
  getActiveMapDocument: () => cachedActiveDocument,
  listSummaries: (): MapSummary[] => cachedSummaries,
  setActiveMapId: (id: string) => {
    activeMapId = id;
    persistActiveMapId(id);
    refreshRegistryCache();
    notifyRegistry();
  },
  refresh: () => {
    refreshRegistryCache();
    notifyRegistry();
  },
};
