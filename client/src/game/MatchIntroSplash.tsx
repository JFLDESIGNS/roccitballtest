import { useSyncExternalStore } from 'react';
import { getRocccitLogoUrl } from './roccitLogo';
import { gameStore } from './gameStore';

export function MatchIntroSplash() {
  const phase = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().phase,
  );

  if (phase !== 'intro') return null;

  return (
    <div className="match-intro" role="presentation" aria-hidden>
      <div className="match-intro-glow" />
      <img
        className="match-intro-logo"
        src={getRocccitLogoUrl()}
        alt="RocccitBall"
        draggable={false}
      />
    </div>
  );
}
