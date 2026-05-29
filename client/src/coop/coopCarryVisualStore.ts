type CoopCarryVisualState = {
  heldTargetId: string | null;
};

const listeners = new Set<() => void>();

let state: CoopCarryVisualState = {
  heldTargetId: null,
};

function emit() {
  listeners.forEach((listener) => listener());
}

export const coopCarryVisualStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getState(): CoopCarryVisualState {
    return state;
  },

  setHeldTarget(id: string | null): void {
    if (state.heldTargetId === id) return;
    state = { heldTargetId: id };
    emit();
  },
};
