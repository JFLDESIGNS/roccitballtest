import { useEffect, useState, useSyncExternalStore } from 'react';
import { resumeAudio } from '../game/audio';
import { gameStore } from '../game/gameStore';
import {
  clampJersey,
  DEFAULT_LOCAL_JERSEY,
  DEFAULT_LOCAL_NAME,
  formatJersey,
  getLocalProfile,
  setLocalProfile,
} from '../game/playerRoster';
import { getRocccitLogoUrl } from '../game/roccitLogo';
import { DEFAULT_MAP_ID, DEFAULT_MAP_NAME } from '../mapEditor/mapEditorTypes';
import { mapEditorStore, mapRegistryStore } from '../mapEditor/mapEditorStore';
import { HowToPlayContent } from './howToPlayContent';
import '../mapEditor/mapEditor.css';

const PROFILE_NAME_KEY = 'rocketball-player-name';
const PROFILE_NUMBER_KEY = 'rocketball-player-number';

function loadSavedProfile(): { name: string; number: number } {
  try {
    const storedName = localStorage.getItem(PROFILE_NAME_KEY);
    const numRaw = localStorage.getItem(PROFILE_NUMBER_KEY);
    const name =
      storedName !== null && storedName.trim().length > 0
        ? storedName
        : DEFAULT_LOCAL_NAME;
    const number =
      numRaw !== null ? clampJersey(Number(numRaw)) : DEFAULT_LOCAL_JERSEY;
    return { name, number };
  } catch {
    return { name: DEFAULT_LOCAL_NAME, number: DEFAULT_LOCAL_JERSEY };
  }
}

type MainMenuProps = {
  onPlay: () => void;
  onEditMap: () => void;
};

export function MainMenu({ onPlay, onEditMap }: MainMenuProps) {
  const saved = loadSavedProfile();
  const [playerName, setPlayerName] = useState(saved.name);
  const [jerseyNumber, setJerseyNumber] = useState(saved.number);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const botsEnabled = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().botsEnabled,
  );
  const activeMapId = useSyncExternalStore(
    mapRegistryStore.subscribe,
    () => mapRegistryStore.getActiveMapId(),
  );
  const customMaps = useSyncExternalStore(
    mapRegistryStore.subscribe,
    mapRegistryStore.listSummaries,
  );

  useEffect(() => {
    setLocalProfile(playerName, jerseyNumber);
  }, [playerName, jerseyNumber]);

  const commitProfile = () => {
    const profile = getLocalProfile();
    try {
      localStorage.setItem(PROFILE_NAME_KEY, profile.displayName);
      localStorage.setItem(PROFILE_NUMBER_KEY, String(profile.jerseyNumber));
    } catch {
      /* ignore */
    }
  };

  const enterArena = () => {
    commitProfile();
    setLocalProfile(playerName, jerseyNumber);
    resumeAudio();
    onPlay();
  };

  const openEditor = () => {
    commitProfile();
    mapEditorStore.openEditor(activeMapId);
    onEditMap();
  };

  return (
    <div className="main-menu">
      <div
        className={`main-menu-panel${showHowToPlay ? ' main-menu-panel--how-to' : ''}`}
      >
        {showHowToPlay ? (
          <>
            <h2 className="how-to-play-title">How to Play</h2>
            <HowToPlayContent />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowHowToPlay(false)}
            >
              Back to Menu
            </button>
          </>
        ) : (
          <>
            <img
              className="main-menu-logo"
              src={getRocccitLogoUrl()}
              alt="Rocccit Ball"
            />
            <ul className="feature-list">
              <li>Third-person movement &amp; rockets</li>
              <li>Magnetic beam &amp; energy system</li>
              <li>Red rings (left) · Blue rings (right) — score on the other side</li>
              {botsEnabled ? (
                <li>2 red bots + 1 blue teammate</li>
              ) : (
                <li>Solo practice — bots off</li>
              )}
            </ul>

            <div className="menu-profile">
              <label className="menu-field">
                <span>Your name</span>
                <input
                  type="text"
                  maxLength={18}
                  value={playerName}
                  placeholder={DEFAULT_LOCAL_NAME}
                  onChange={(e) => setPlayerName(e.target.value)}
                  onBlur={commitProfile}
                />
              </label>
              <label className="menu-field menu-field--number">
                <span>Jersey #</span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={jerseyNumber}
                  onChange={(e) =>
                    setJerseyNumber(clampJersey(Number(e.target.value)))
                  }
                  onBlur={commitProfile}
                />
                <span className="menu-jersey-preview">
                  {formatJersey(jerseyNumber)}
                </span>
              </label>
            </div>

            <label className="menu-option">
              <input
                type="checkbox"
                checked={botsEnabled}
                onChange={(e) => gameStore.setBotsEnabled(e.target.checked)}
              />
              <span>Enable practice bots</span>
            </label>

            <label className="menu-map-picker">
              <span>Arena map</span>
              <select
                value={activeMapId}
                onChange={(e) => mapRegistryStore.setActiveMapId(e.target.value)}
              >
                <option value={DEFAULT_MAP_ID}>{DEFAULT_MAP_NAME}</option>
                {customMaps.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="main-menu-actions">
              <button type="button" className="btn-primary" onClick={enterArena}>
                Enter Arena
              </button>
              <button type="button" className="btn-secondary" onClick={openEditor}>
                Edit Map
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowHowToPlay(true)}
              >
                How to Play
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
