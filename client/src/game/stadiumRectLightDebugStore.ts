type StadiumRectLightDebugState = {
  wireframe: boolean;
};

const listeners = new Set<() => void>();
let state: StadiumRectLightDebugState = { wireframe: false };

function notify() {
  listeners.forEach((l) => l());
}

export const stadiumRectLightDebugStore = {
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getState: () => state,
  toggleWireframe: () => {
    state = { wireframe: !state.wireframe };
    notify();
  },
  setWireframe: (v: boolean) => {
    if (state.wireframe === v) return;
    state = { wireframe: v };
    notify();
  },
};
