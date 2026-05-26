import * as THREE from 'three';

const STORAGE_KEY = 'rocketball-new-platform-visual-v1';

export type NewPlatformVisualTune = {
  /** Lower the FBX visual (feet) after fit — physics unchanged */
  offsetLowerFt: number;
  uniformScale: number;
  rotXDeg: number;
  rotYDeg: number;
  rotZDeg: number;
};

const defaults: NewPlatformVisualTune = {
  offsetLowerFt: 2,
  uniformScale: 1,
  rotXDeg: 0,
  rotYDeg: 0,
  rotZDeg: 0,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function clampTune(raw: Partial<NewPlatformVisualTune>): NewPlatformVisualTune {
  return {
    offsetLowerFt: Math.max(-20, Math.min(30, raw.offsetLowerFt ?? defaults.offsetLowerFt)),
    uniformScale: Math.max(0.25, Math.min(3, raw.uniformScale ?? defaults.uniformScale)),
    rotXDeg: Math.max(-180, Math.min(180, raw.rotXDeg ?? defaults.rotXDeg)),
    rotYDeg: Math.max(-180, Math.min(180, raw.rotYDeg ?? defaults.rotYDeg)),
    rotZDeg: Math.max(-180, Math.min(180, raw.rotZDeg ?? defaults.rotZDeg)),
  };
}

function loadStored(): Partial<NewPlatformVisualTune> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<NewPlatformVisualTune>;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function persist(v: NewPlatformVisualTune) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

let state: NewPlatformVisualTune = clampTune(loadStored());

function patch(partial: Partial<NewPlatformVisualTune>) {
  state = clampTune({ ...state, ...partial });
  persist(state);
  notify();
}

export function formatNewPlatformVisualForCopy(t = state): string {
  return [
    'newPlatformVisualTune:',
    `  offsetLowerFt: ${t.offsetLowerFt},`,
    `  uniformScale: ${t.uniformScale},`,
    `  rotXDeg: ${t.rotXDeg},`,
    `  rotYDeg: ${t.rotYDeg},`,
    `  rotZDeg: ${t.rotZDeg},`,
  ].join('\n');
}

export type NewPlatformVisualBase = {
  positionY: number;
  scale: number;
};

/** Apply menu tuning on top of fitted FBX root (visual-only). */
export function applyNewPlatformVisualTune(
  visual: THREE.Object3D,
  base: NewPlatformVisualBase,
  tuneGroup: THREE.Object3D | null,
  tune: NewPlatformVisualTune = state,
): void {
  visual.position.y = base.positionY - tune.offsetLowerFt;
  visual.scale.setScalar(base.scale * tune.uniformScale);
  if (tuneGroup) {
    tuneGroup.rotation.set(
      THREE.MathUtils.degToRad(tune.rotXDeg),
      THREE.MathUtils.degToRad(tune.rotYDeg),
      THREE.MathUtils.degToRad(tune.rotZDeg),
    );
  }
}

export const newPlatformVisualStore = {
  getState: () => state,
  getDefaults: () => ({ ...defaults }),
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  setOffsetLowerFt: (v: number) => patch({ offsetLowerFt: v }),
  setUniformScale: (v: number) => patch({ uniformScale: v }),
  setRotXDeg: (v: number) => patch({ rotXDeg: v }),
  setRotYDeg: (v: number) => patch({ rotYDeg: v }),
  setRotZDeg: (v: number) => patch({ rotZDeg: v }),
  reset: () => {
    state = { ...defaults };
    persist(state);
    notify();
  },
};
