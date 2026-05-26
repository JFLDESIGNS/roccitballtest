const listeners = new Set<() => void>();
let active = false;

function notify(): void {
  listeners.forEach((l) => l());
}

/** True while the custom map editor screen is open (not play mode). */
export const mapEditorSession = {
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  isActive: () => active,
  setActive: (value: boolean) => {
    if (active === value) return;
    active = value;
    notify();
  },
};
