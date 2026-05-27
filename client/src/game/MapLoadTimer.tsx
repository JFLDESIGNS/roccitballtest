import { useEffect, useRef } from 'react';
import { MATCH } from '../shared/Constants';
import { gamePreloadStore } from './gamePreloadStore';
import { gameStore } from './gameStore';
import { multiplayerStore } from '../multiplayer/multiplayerStore';

/** Wall-clock arena load — not tied to rAF (tab background won't freeze the timer). */
export function MapLoadTimer() {
  const loadEndsAtMs = useRef(0);
  const announcedReadyForGeneration = useRef(-1);
  const resetReadyForGeneration = useRef(-1);

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
      const localReady = remainingMs <= 0 && gamePreloadStore.isReady();
      const multiplayer = multiplayerStore.getState();
      if (multiplayer.enabled && multiplayer.status === 'online') {
        if (resetReadyForGeneration.current !== state.matchGeneration) {
          multiplayerStore.sendLoadReady(false);
          resetReadyForGeneration.current = state.matchGeneration;
        }
        if (
          localReady &&
          announcedReadyForGeneration.current !== state.matchGeneration
        ) {
          multiplayerStore.sendLoadReady(true);
          announcedReadyForGeneration.current = state.matchGeneration;
        }
        if (multiplayer.selfId !== multiplayer.hostId) return;

        const allPlayersReady =
          multiplayer.remotePlayers.length > 0 &&
          multiplayer.remotePlayers.every((player) => player.loadReady === true);
        if (localReady && allPlayersReady) {
          gameStore.finishMapLoad();
        }
        return;
      }

      if (localReady) {
        gameStore.finishMapLoad();
      }
    };

    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
