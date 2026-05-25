export type GamePreloadStage =
  | 'idle'
  | 'maps'
  | 'audio'
  | 'textures'
  | 'models'
  | 'grass'
  | 'ready';

type GamePreloadState = {
  stage: GamePreloadStage;
  /** 0–1 overall */
  progress: number;
  modelsReady: boolean;
  grassReady: boolean;
};

const listeners = new Set<() => void>();

let state: GamePreloadState = {
  stage: 'idle',
  progress: 0,
  modelsReady: false,
  grassReady: false,
};

function notify() {
  listeners.forEach((l) => l());
}

export const gamePreloadStore = {
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getState: () => state,
  isReady: () => state.stage === 'ready',
  setStage: (stage: GamePreloadStage, progress: number) => {
    state = { ...state, stage, progress: Math.max(0, Math.min(1, progress)) };
    notify();
  },
  setModelsReady: () => {
    if (state.modelsReady) return;
    state = { ...state, modelsReady: true };
    notify();
  },
  setGrassReady: () => {
    if (state.grassReady) return;
    state = { ...state, grassReady: true };
    notify();
  },
  markReady: () => {
    state = {
      stage: 'ready',
      progress: 1,
      modelsReady: true,
      grassReady: true,
    };
    notify();
  },
};
