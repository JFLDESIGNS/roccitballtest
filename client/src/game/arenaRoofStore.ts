import { ARENA } from '../shared/Constants';

type ArenaRoofState = {
  /** 0 = closed (meeting at midfield), 1 = fully retracted */
  open: number;
  target: number;
};

const listeners = new Set<() => void>();

let state: ArenaRoofState = { open: 0, target: 0 };

function notify() {
  listeners.forEach((l) => l());
}

export const arenaRoofStore = {
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getState: () => state,
  toggleTarget: () => {
    state = { ...state, target: state.target < 0.5 ? 1 : 0 };
    notify();
  },
  step: (dt: number) => {
    const speed = 1 / ARENA.roofRetractSec;
    const diff = state.target - state.open;
    if (Math.abs(diff) < 0.0008) {
      if (state.open !== state.target) {
        state = { ...state, open: state.target };
        notify();
      }
      return;
    }
    const next =
      state.open + Math.sign(diff) * speed * dt;
    state = {
      ...state,
      open: Math.max(0, Math.min(1, next)),
    };
    notify();
  },
  reset: () => {
    state = { open: 0, target: 0 };
    notify();
  },
};
