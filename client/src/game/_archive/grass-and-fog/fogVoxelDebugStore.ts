type FogVoxelDebugState = {
  /** White gradient fog billboards visible */
  arrayVisible: boolean;
  /** Wireframe cell debug overlay */
  wireframe: boolean;
};

const listeners = new Set<() => void>();
let state: FogVoxelDebugState = { arrayVisible: false, wireframe: false };

function notify() {
  listeners.forEach((l) => l());
}

export const fogVoxelDebugStore = {
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getState: () => state,
  /** T — toggle wireframe cube overlay (fog stays on) */
  toggleWireframe: () => {
    state = { ...state, wireframe: !state.wireframe };
    notify();
  },
  toggleArrayVisible: () => {
    state = { ...state, arrayVisible: !state.arrayVisible };
    notify();
  },
  setArrayVisible: (v: boolean) => {
    if (state.arrayVisible === v) return;
    state = { ...state, arrayVisible: v };
    notify();
  },
  setWireframe: (v: boolean) => {
    if (state.wireframe === v) return;
    state = { ...state, wireframe: v };
    notify();
  },
};
