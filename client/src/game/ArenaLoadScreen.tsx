import { useSyncExternalStore } from 'react';
import { MATCH } from '../shared/Constants';
import { getRocccitLogoUrl } from './roccitLogo';
import { gamePreloadStore } from './gamePreloadStore';
import { gameStore } from './gameStore';

export function ArenaLoadScreen() {
  const phase = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().phase,
  );
  const loadCountdown = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().loadCountdown,
  );
  const preloadProgress = useSyncExternalStore(
    gamePreloadStore.subscribe,
    () => gamePreloadStore.getState().progress,
  );

  if (phase !== 'loading') return null;

  const elapsedSec = MATCH.mapLoadSec - loadCountdown;
  const timeProgress = Math.min(1, elapsedSec / MATCH.mapLoadSec);
  const barProgress = Math.min(
    1,
    timeProgress * 0.38 + preloadProgress * 0.62,
  );

  return (
    <div className="arena-load" role="dialog" aria-label="Loading arena">
      <div className="arena-load-glow" aria-hidden />

      <div className="arena-load-body">
        <img
          className="arena-load-logo"
          src={getRocccitLogoUrl()}
          alt="Roccit Ball"
          draggable={false}
        />
        <div className="arena-load-bar-wrap">
          <div
            className="arena-load-bar-fill"
            style={{ width: `${barProgress * 100}%` }}
          />
        </div>
        <p className="arena-load-status">
          Loading arena… {loadCountdown > 0 ? `${loadCountdown}s` : 'finishing'}
        </p>
      </div>
    </div>
  );
}
