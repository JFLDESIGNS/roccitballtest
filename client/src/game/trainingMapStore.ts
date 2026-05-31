export type TrainingBallHit = {
  normal: { x: number; y: number; z: number };
  contact: { x: number; y: number; z: number };
  at: number;
};

export type TrainingShot = {
  distanceFt: number;
  carryFt: number;
  apexFt: number;
  speedMps: number;
  landed: boolean;
  at: number;
};

const listeners = new Set<() => void>();
let lastBallHit: TrainingBallHit | null = null;
let activeShot: TrainingShot | null = null;
let lastShot: TrainingShot | null = null;
let bestShot: TrainingShot | null = null;

function notify() {
  listeners.forEach((fn) => fn());
}

export const trainingMapStore = {
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getLastBallHit: () => lastBallHit,
  getActiveShot: () => activeShot,
  getLastShot: () => lastShot,
  getBestShot: () => bestShot,
  recordBallHit: (hit: Omit<TrainingBallHit, 'at'>) => {
    lastBallHit = { ...hit, at: performance.now() };
    notify();
  },
  updateActiveShot: (shot: Omit<TrainingShot, 'at'>) => {
    activeShot = { ...shot, at: performance.now() };
    notify();
  },
  finishShot: (shot: Omit<TrainingShot, 'at'>) => {
    const finished = { ...shot, at: performance.now() };
    activeShot = null;
    lastShot = finished;
    if (!bestShot || finished.distanceFt > bestShot.distanceFt) {
      bestShot = finished;
    }
    notify();
  },
  clear: () => {
    lastBallHit = null;
    activeShot = null;
    lastShot = null;
    bestShot = null;
    notify();
  },
};
