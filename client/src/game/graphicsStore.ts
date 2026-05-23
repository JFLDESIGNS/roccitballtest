const STORAGE_KEY = 'rocketball-graphics-v5';

export type GraphicsSettings = {
  shadows: boolean;
  bloom: boolean;
  bloomIntensity: number;
  ao: boolean;
  aoIntensity: number;
  /** Scene + sun/ambient multiplier (1 = legacy, ~1.35 = brighter default) */
  arenaBrightness: number;
  exposure: number;
  fog: boolean;
  fogDensity: number;
  atmosphere: boolean;
  particleCount: number;
  particleSize: number;
  particleOpacity: number;
};

type GraphicsState = GraphicsSettings;

const defaults: GraphicsSettings = {
  shadows: true,
  bloom: true,
  bloomIntensity: 0.55,
  ao: true,
  aoIntensity: 1.15,
  arenaBrightness: 1.35,
  exposure: 1.2,
  fog: true,
  fogDensity: 0.0052,
  atmosphere: true,
  particleCount: 18,
  particleSize: 0.22,
  particleOpacity: 0.55,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function loadStored(): Partial<GraphicsSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<GraphicsSettings>;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function persist(v: GraphicsSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

let state: GraphicsState = { ...defaults, ...loadStored() };

function patch(partial: Partial<GraphicsSettings>) {
  state = { ...state, ...partial };
  persist(state);
  notify();
}

export const graphicsStore = {
  getState: () => state,
  getDefaults: () => ({ ...defaults }),
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  setShadows: (v: boolean) => patch({ shadows: v }),
  setBloom: (v: boolean) => patch({ bloom: v }),
  setBloomIntensity: (v: number) =>
    patch({ bloomIntensity: Math.max(0, Math.min(2, v)) }),
  setAo: (v: boolean) => patch({ ao: v }),
  setAoIntensity: (v: number) =>
    patch({ aoIntensity: Math.max(0, Math.min(3, v)) }),
  setArenaBrightness: (v: number) =>
    patch({ arenaBrightness: Math.max(0.4, Math.min(2.5, v)) }),
  setExposure: (v: number) =>
    patch({ exposure: Math.max(0.5, Math.min(2.5, v)) }),
  setFog: (v: boolean) => patch({ fog: v }),
  setFogDensity: (v: number) =>
    patch({ fogDensity: Math.max(0, Math.min(0.03, v)) }),
  setAtmosphere: (v: boolean) => patch({ atmosphere: v }),
  setParticleCount: (v: number) =>
    patch({ particleCount: Math.round(Math.max(0, Math.min(1200, v))) }),
  setParticleSize: (v: number) =>
    patch({ particleSize: Math.max(0.05, Math.min(0.8, v)) }),
  setParticleOpacity: (v: number) =>
    patch({ particleOpacity: Math.max(0.05, Math.min(1, v)) }),
  resetDefaults: () => {
    state = { ...defaults };
    persist(state);
    notify();
  },
};
