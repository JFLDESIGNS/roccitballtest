import { useEffect, useRef } from 'react';
import { MATCH } from '../shared/Constants';
import { gamePreloadStore } from './gamePreloadStore';
import { gameStore } from './gameStore';

/** Wall-clock arena load — not tied to rAF (tab background won't freeze the timer). */
export function MapLoadTimer() {
  const loadEndsAtMs = useRef(0);

  useEffect(() => {
    const tick = () => {
      const state = gameStore.getState();
      if (state.phase !== 'loading') {
        loadEndsAtMs.current = 0;
        return;
      }

      if (loadEndsAtMs.current === 0) {
        loadEndsAtMs.current =
          performance.now() + MATCH.mapLoadSec * 1000;
      }

      const remainingMs = Math.max(0, loadEndsAtMs.current - performance.now());
      const display = Math.ceil(remainingMs / 1000);
      if (state.loadCountdown !== display) {
        gameStore.setLoadCountdown(display);
      }
      if (remainingMs <= 0 && gamePreloadStore.isReady()) {
        gameStore.finishMapLoad();
      }
    };

    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
