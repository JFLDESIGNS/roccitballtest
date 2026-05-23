import { useEffect, useRef } from 'react';
import { MATCH } from '../shared/Constants';
import { gameStore } from './gameStore';

/** Logo splash wall-clock timer — then arena load countdown begins. */
export function MatchIntroTimer() {
  const introEndsAtMs = useRef(0);

  useEffect(() => {
    const tick = () => {
      const state = gameStore.getState();
      if (state.phase !== 'intro') {
        introEndsAtMs.current = 0;
        return;
      }

      if (introEndsAtMs.current === 0) {
        introEndsAtMs.current =
          performance.now() + MATCH.logoIntroSec * 1000;
      }

      if (performance.now() >= introEndsAtMs.current) {
        gameStore.beginMapLoad();
      }
    };

    tick();
    const id = window.setInterval(tick, 50);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
