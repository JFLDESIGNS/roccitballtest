import { useSyncExternalStore } from 'react';
import { resumeAudio } from '../game/audio';
import { gameStore } from '../game/gameStore';

type MainMenuProps = {
  onPlay: () => void;
};

export function MainMenu({ onPlay }: MainMenuProps) {
  const botsEnabled = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().botsEnabled,
  );

  return (
    <div className="main-menu">
      <div className="main-menu-panel">
        <h1>RocketBall Arena</h1>
        <p className="subtitle">Neon Foundry · Practice Arena v0.2</p>
        <ul className="feature-list">
          <li>First-person movement &amp; rockets</li>
          <li>Magnetic beam &amp; energy system</li>
          <li>Red rings (left) · Blue rings (right) — score on the other side</li>
          {botsEnabled ? (
            <li>2 red bots + 1 blue teammate</li>
          ) : (
            <li>Solo practice — bots off</li>
          )}
        </ul>

        <label className="menu-option">
          <input
            type="checkbox"
            checked={botsEnabled}
            onChange={(e) => gameStore.setBotsEnabled(e.target.checked)}
          />
          <span>Enable practice bots</span>
        </label>

        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            resumeAudio();
            onPlay();
          }}
        >
          Enter Practice Arena
        </button>
        <p className="hint">Third-person · Double jump (Space×2) · RMB magnetic beam</p>
      </div>
    </div>
  );
}
