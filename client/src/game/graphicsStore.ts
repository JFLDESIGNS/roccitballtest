import {
  isShadowMapTypeId,
  type ShadowMapTypeId,
} from './shadowMapType';

const STORAGE_KEY = 'rocketball-graphics-v20';

function normalizeHexColor(raw: string | undefined, fallback: string): string {
  if (!raw || !/^#[0-9a-fA-F]{6}$/.test(raw)) return fallback;
  return raw.toLowerCase();
}

function normalizeSettings(raw: Partial<GraphicsSettings>): GraphicsSettings {
  return {
    ...defaults,
    ...raw,
    chromaticAberration: raw.chromaticAberration ?? defaults.chromaticAberration,
    chromaticAberrationIntensity:
      raw.chromaticAberrationIntensity ?? defaults.chromaticAberrationIntensity,
    fisheye: raw.fisheye ?? defaults.fisheye,
    fisheyeIntensity: raw.fisheyeIntensity ?? defaults.fisheyeIntensity,
    lensFlare: raw.lensFlare ?? defaults.lensFlare,
    keyLight2Color: normalizeHexColor(raw.keyLight2Color, defaults.keyLight2Color),
    keyLight3Color: normalizeHexColor(raw.keyLight3Color, defaults.keyLight3Color),
    keyLight2Brightness: Math.max(
      1,
      Math.min(1000, raw.keyLight2Brightness ?? defaults.keyLight2Brightness),
    ),
    keyLight3Brightness: Math.max(
      1,
      Math.min(1000, raw.keyLight3Brightness ?? defaults.keyLight3Brightness),
    ),
    keyLight2CastShadow: raw.keyLight2CastShadow ?? defaults.keyLight2CastShadow,
    keyLight3CastShadow: raw.keyLight3CastShadow ?? defaults.keyLight3CastShadow,
    keyLightWireframe: raw.keyLightWireframe ?? defaults.keyLightWireframe,
    stadiumStripLightIntensity: Math.max(
      0,
      Math.min(24, raw.stadiumStripLightIntensity ?? defaults.stadiumStripLightIntensity),
    ),
    stadiumStripGapFt: Math.max(
      8,
      Math.min(80, raw.stadiumStripGapFt ?? defaults.stadiumStripGapFt),
    ),
    stadiumStripPlaneWidthFt: Math.max(
      24,
      Math.min(220, raw.stadiumStripPlaneWidthFt ?? defaults.stadiumStripPlaneWidthFt),
    ),
    shadowMapType:
      raw.shadowMapType && isShadowMapTypeId(raw.shadowMapType)
        ? raw.shadowMapType
        : defaults.shadowMapType,
  };
}

export type GraphicsSettings = {
  shadows: boolean;
  shadowMapType: ShadowMapTypeId;
  bloom: boolean;
  bloomIntensity: number;
  ao: boolean;
  aoIntensity: number;
  /** Scene + ambient multiplier (1 = legacy, ~1.35 = brighter default) */
  arenaBrightness: number;
  exposure: number;
  fog: boolean;
  fogDensity: number;
  atmosphere: boolean;
  particleCount: number;
  particleSize: number;
  particleOpacity: number;
  chromaticAberration: boolean;
  chromaticAberrationIntensity: number;
  fisheye: boolean;
  fisheyeIntensity: number;
  lensFlare: boolean;
  /** Warm ceiling rect strips when roof is open (0–24) */
  stadiumStripLightIntensity: number;
  /** Gap between strip inner edges along midfield (feet) */
  stadiumStripGapFt: number;
  /** Each rect strip width perpendicular to goals (feet) */
  stadiumStripPlaneWidthFt: number;
  /** Interior Key 2 — color + brightness (1–1000) */
  keyLight2Color: string;
  keyLight2Brightness: number;
  /** Interior Key 3 — color + brightness (1–1000) */
  keyLight3Color: string;
  keyLight3Brightness: number;
  keyLight2CastShadow: boolean;
  keyLight3CastShadow: boolean;
  /** Wireframe gizmo at ceiling mount + beam cone */
  keyLightWireframe: boolean;
};

type GraphicsState = GraphicsSettings;

const defaults: GraphicsSettings = {
  shadows: true,
  shadowMapType: 'basic',
  bloom: true,
  bloomIntensity: 0.42,
  ao: true,
  aoIntensity: 1.05,
  arenaBrightness: 1,
  exposure: 1,
  fog: true,
  fogDensity: 0.0052,
  atmosphere: true,
  particleCount: 72,
  particleSize: 0.32,
  particleOpacity: 0.68,
  chromaticAberration: false,
  chromaticAberrationIntensity: 0.35,
  fisheye: false,
  fisheyeIntensity: 0.28,
  lensFlare: false,
  stadiumStripLightIntensity: 6.5,
  stadiumStripGapFt: 34,
  /** ~half stadium width per strip (Z), with gap unchanged */
  stadiumStripPlaneWidthFt: 150,
  keyLight2Color: '#fff0e0',
  keyLight2Brightness: 280,
  keyLight3Color: '#dfe8f5',
  keyLight3Brightness: 240,
  keyLight2CastShadow: true,
  keyLight3CastShadow: true,
  keyLightWireframe: true,
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

let state: GraphicsState = normalizeSettings(loadStored());

function patch(partial: Partial<GraphicsSettings>) {
  state = normalizeSettings({ ...state, ...partial });
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
  setShadowMapType: (v: ShadowMapTypeId) => patch({ shadowMapType: v }),
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
  setChromaticAberration: (v: boolean) => patch({ chromaticAberration: v }),
  setChromaticAberrationIntensity: (v: number) =>
    patch({ chromaticAberrationIntensity: Math.max(0, Math.min(1, v)) }),
  setFisheye: (v: boolean) => patch({ fisheye: v }),
  setFisheyeIntensity: (v: number) =>
    patch({ fisheyeIntensity: Math.max(0, Math.min(1, v)) }),
  setLensFlare: (v: boolean) => patch({ lensFlare: v }),
  setStadiumStripLightIntensity: (v: number) =>
    patch({
      stadiumStripLightIntensity: Math.max(0, Math.min(24, v)),
    }),
  setStadiumStripGapFt: (v: number) =>
    patch({ stadiumStripGapFt: Math.max(8, Math.min(80, v)) }),
  setStadiumStripPlaneWidthFt: (v: number) =>
    patch({ stadiumStripPlaneWidthFt: Math.max(24, Math.min(220, v)) }),
  setKeyLight2Color: (v: string) =>
    patch({ keyLight2Color: normalizeHexColor(v, defaults.keyLight2Color) }),
  setKeyLight3Color: (v: string) =>
    patch({ keyLight3Color: normalizeHexColor(v, defaults.keyLight3Color) }),
  setKeyLight2Brightness: (v: number) =>
    patch({ keyLight2Brightness: Math.max(1, Math.min(1000, Math.round(v))) }),
  setKeyLight3Brightness: (v: number) =>
    patch({ keyLight3Brightness: Math.max(1, Math.min(1000, Math.round(v))) }),
  setKeyLight2CastShadow: (v: boolean) => patch({ keyLight2CastShadow: v }),
  setKeyLight3CastShadow: (v: boolean) => patch({ keyLight3CastShadow: v }),
  setKeyLightWireframe: (v: boolean) => patch({ keyLightWireframe: v }),
  resetBrightnessDefaults: () => {
    patch({
      arenaBrightness: defaults.arenaBrightness,
      exposure: defaults.exposure,
      bloom: defaults.bloom,
      bloomIntensity: defaults.bloomIntensity,
      stadiumStripLightIntensity: defaults.stadiumStripLightIntensity,
      stadiumStripGapFt: defaults.stadiumStripGapFt,
      stadiumStripPlaneWidthFt: defaults.stadiumStripPlaneWidthFt,
      keyLight2Color: defaults.keyLight2Color,
      keyLight2Brightness: defaults.keyLight2Brightness,
      keyLight3Color: defaults.keyLight3Color,
      keyLight3Brightness: defaults.keyLight3Brightness,
      keyLight2CastShadow: defaults.keyLight2CastShadow,
      keyLight3CastShadow: defaults.keyLight3CastShadow,
      keyLightWireframe: defaults.keyLightWireframe,
    });
  },
  resetDefaults: () => {
    state = normalizeSettings({});
    persist(state);
    notify();
  },
};
