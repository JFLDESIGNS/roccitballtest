import { buildDefaultStadiumLights } from './stadiumLightsDefaults';
import type {
  StadiumLightAddKind,
  StadiumLightDef,
  StadiumLightGizmoMode,
  StadiumLightKind,
} from './stadiumLightTypes';

const STORAGE_KEY = 'rocketball-stadium-lights-v1';

type StadiumLightState = {
  lights: StadiumLightDef[];
  selectedId: string | null;
  gizmoDragging: boolean;
  gizmoMode: StadiumLightGizmoMode;
  showWireframes: boolean;
  flyCameraPosition: [number, number, number];
  /** Normalized look direction — updated each fly frame for placing new lights */
  flyCameraLook: [number, number, number];
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function cloneLight(l: StadiumLightDef): StadiumLightDef {
  return {
    ...l,
    position: [...l.position],
    rotation: [...l.rotation],
  };
}

function normalizeLight(raw: Partial<StadiumLightDef> & { id: string }): StadiumLightDef {
  const defaults = buildDefaultStadiumLights().find((d) => d.id === raw.id);
  const fallback: StadiumLightDef = {
    id: raw.id,
    name: raw.name ?? 'Light',
    kind: raw.kind ?? 'point',
    position: [0, 40, 0],
    rotation: [0, 0, 0],
    color: '#ffffff',
    intensity: 120,
    castShadow: false,
    enabled: true,
  };
  const base = defaults ?? fallback;
  return {
    ...base,
    ...raw,
    position: (raw.position ?? base.position).slice(0, 3) as [
      number,
      number,
      number,
    ],
    rotation: (raw.rotation ?? base.rotation).slice(0, 3) as [
      number,
      number,
      number,
    ],
    enabled: raw.enabled ?? base.enabled ?? true,
    castShadow: raw.castShadow ?? base.castShadow ?? false,
  };
}

function loadStored(): StadiumLightDef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildDefaultStadiumLights();
    const parsed = JSON.parse(raw) as StadiumLightDef[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return buildDefaultStadiumLights();
    }
    return parsed.map((l) => normalizeLight(l));
  } catch {
    return buildDefaultStadiumLights();
  }
}

function persist(lights: StadiumLightDef[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lights));
  } catch {
    /* ignore */
  }
}

let state: StadiumLightState = {
  lights: loadStored(),
  selectedId: null,
  gizmoDragging: false,
  gizmoMode: 'translate',
  showWireframes: true,
  flyCameraPosition: [0, 40, 0],
  flyCameraLook: [0, -0.2, -1],
};

function patchLights(next: StadiumLightDef[]) {
  state = { ...state, lights: next.map(cloneLight) };
  persist(state.lights);
  notify();
}

function syncLinkGroup(
  lights: StadiumLightDef[],
  sourceId: string,
  position: [number, number, number],
  rotation: [number, number, number],
): StadiumLightDef[] {
  const source = lights.find((l) => l.id === sourceId);
  if (!source?.linkGroup) {
    return lights.map((l) =>
      l.id === sourceId ? { ...l, position, rotation } : l,
    );
  }
  return lights.map((l) =>
    l.linkGroup === source.linkGroup ? { ...l, position, rotation } : l,
  );
}

let idCounter = 0;

function newLightId(kind: StadiumLightKind): string {
  idCounter += 1;
  return `custom-${kind}-${Date.now()}-${idCounter}`;
}

export const stadiumLightStore = {
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getState: () => state,

  select: (id: string | null) => {
    state = { ...state, selectedId: id };
    notify();
  },

  toggleSelect: (id: string) => {
    state = {
      ...state,
      selectedId: state.selectedId === id ? null : id,
    };
    notify();
  },

  deselect: () => {
    if (state.selectedId === null) return;
    state = { ...state, selectedId: null };
    notify();
  },

  setGizmoDragging: (dragging: boolean) => {
    if (state.gizmoDragging === dragging) return;
    state = { ...state, gizmoDragging: dragging };
    notify();
  },

  setGizmoMode: (mode: StadiumLightGizmoMode) => {
    if (state.gizmoMode === mode) return;
    state = { ...state, gizmoMode: mode };
    notify();
  },

  getSelectedLight: (): StadiumLightDef | undefined =>
    state.lights.find((l) => l.id === state.selectedId),

  setShowWireframes: (show: boolean) => {
    state = { ...state, showWireframes: show };
    notify();
  },

  setFlyCameraPosition: (position: [number, number, number]) => {
    state = { ...state, flyCameraPosition: position };
  },

  setFlyCameraLook: (look: [number, number, number]) => {
    state = { ...state, flyCameraLook: look };
  },

  /** Spawn ~12 m in front of fly camera and select it */
  addLightAheadOfCamera: (kind: StadiumLightAddKind, distanceM = 12): string => {
    const p = state.flyCameraPosition;
    const l = state.flyCameraLook;
    const len = Math.hypot(l[0], l[1], l[2]) || 1;
    const nx = l[0] / len;
    const ny = l[1] / len;
    const nz = l[2] / len;
    return stadiumLightStore.addLight(kind, [
      p[0] + nx * distanceM,
      p[1] + ny * distanceM,
      p[2] + nz * distanceM,
    ]);
  },

  duplicateLight: (id: string): string | null => {
    const src = state.lights.find((l) => l.id === id);
    if (!src) return null;
    const kind = src.kind;
    const newId = newLightId(kind);
    const copy = cloneLight({
      ...src,
      id: newId,
      name: `${src.name} copy`,
      position: [
        src.position[0] + 2,
        src.position[1],
        src.position[2] + 2,
      ],
      linkGroup: undefined,
      brightnessMenuKey: undefined,
      stripMenu: undefined,
    });
    patchLights([...state.lights, copy]);
    state = { ...state, selectedId: newId };
    notify();
    return newId;
  },

  updateTransform: (
    id: string,
    position: [number, number, number],
    rotation: [number, number, number],
    extra?: Partial<StadiumLightDef>,
  ) => {
    let lights = syncLinkGroup(state.lights, id, position, rotation);
    if (extra && Object.keys(extra).length > 0) {
      lights = lights.map((l) =>
        l.id === id ? normalizeLight({ ...l, ...extra, id: l.id }) : l,
      );
    }
    patchLights(lights);
  },

  patchLight: (id: string, partial: Partial<StadiumLightDef>) => {
    const clean: Partial<StadiumLightDef> = { ...partial };
    for (const [k, v] of Object.entries(clean)) {
      if (typeof v === 'number' && !Number.isFinite(v)) {
        delete clean[k as keyof StadiumLightDef];
      }
    }
    patchLights(
      state.lights.map((l) =>
        l.id === id ? normalizeLight({ ...l, ...clean, id: l.id }) : l,
      ),
    );
  },

  addLight: (
    kind: StadiumLightAddKind,
    position: [number, number, number],
  ): string => {
    const id = newLightId(kind);
    const base: StadiumLightDef = {
      id,
      name: `New ${kind}`,
      kind,
      position,
      rotation: kind === 'rectArea' ? [-Math.PI / 2, 0, 0] : [0, 0, 0],
      color: '#ffffff',
      intensity: kind === 'directional' ? 0.8 : 120,
      distance: kind === 'point' || kind === 'spot' ? 80 : undefined,
      decay: kind === 'point' ? 1.2 : undefined,
      angle: kind === 'spot' ? 0.6 : undefined,
      penumbra: kind === 'spot' ? 0.4 : undefined,
      rectWidth: kind === 'rectArea' ? 20 : undefined,
      rectHeight: kind === 'rectArea' ? 20 : undefined,
      castShadow:
        kind === 'point' || kind === 'spot' || kind === 'directional',
      enabled: true,
    };
    patchLights([...state.lights, base]);
    state = { ...state, selectedId: id };
    notify();
    return id;
  },

  deleteSelected: () => {
    const id = state.selectedId;
    if (!id) return;
    patchLights(state.lights.filter((l) => l.id !== id));
    state = { ...state, selectedId: null };
    notify();
  },

  resetToDefaults: () => {
    patchLights(buildDefaultStadiumLights());
    state = { ...state, selectedId: null };
    notify();
  },

  exportToCode: (): string => {
    const lines = state.lights.map((l) => {
      const fields: string[] = [
        `id: '${l.id}'`,
        `name: '${l.name.replace(/'/g, "\\'")}'`,
        `kind: '${l.kind}'`,
        `position: [${l.position.map((n) => +n.toFixed(3)).join(', ')}]`,
        `rotation: [${l.rotation.map((n) => +n.toFixed(4)).join(', ')}]`,
        `color: '${l.color}'`,
        `intensity: ${+l.intensity.toFixed(3)}`,
        `castShadow: ${l.castShadow}`,
        `enabled: ${l.enabled}`,
      ];
      if (l.distance != null) fields.push(`distance: ${+l.distance.toFixed(2)}`);
      if (l.decay != null) fields.push(`decay: ${+l.decay.toFixed(2)}`);
      if (l.angle != null) fields.push(`angle: ${+l.angle.toFixed(3)}`);
      if (l.penumbra != null) fields.push(`penumbra: ${+l.penumbra.toFixed(2)}`);
      if (l.rectWidth != null) fields.push(`rectWidth: ${l.rectWidth}`);
      if (l.rectHeight != null) fields.push(`rectHeight: ${l.rectHeight}`);
      if (l.roofGated) fields.push('roofGated: true');
      if (l.brightnessMenuKey)
        fields.push(`brightnessMenuKey: '${l.brightnessMenuKey}'`);
      if (l.stripMenu) fields.push('stripMenu: true');
      if (l.linkGroup) fields.push(`linkGroup: '${l.linkGroup}'`);
      return `    {\n      ${fields.join(',\n      ')},\n    }`;
    });

    return `import type { StadiumLightDef } from './stadiumLightTypes';

/** Generated from fly-mode light editor */
export function buildDefaultStadiumLights(): StadiumLightDef[] {
  return [
${lines.join(',\n')}
  ];
}
`;
  },

  copyExportToClipboard: async (): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(stadiumLightStore.exportToCode());
      return true;
    } catch {
      return false;
    }
  },
};
