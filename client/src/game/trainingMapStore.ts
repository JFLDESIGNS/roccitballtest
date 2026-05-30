export type TrainingBallHit = {
  normal: { x: number; y: number; z: number };
  contact: { x: number; y: number; z: number };
  at: number;
};

const listeners = new Set<() => void>();
let lastBallHit: TrainingBallHit | null = null;

function notify() {
  listeners.forEach((fn) => fn());
}

export const trainingMapStore = {
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getLastBallHit: () => lastBallHit,
  recordBallHit: (hit: Omit<TrainingBallHit, 'at'>) => {
    lastBallHit = { ...hit, at: performance.now() };
    notify();
  },
  clear: () => {
    lastBallHit = null;
    notify();
  },
};
