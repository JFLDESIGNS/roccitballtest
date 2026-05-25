import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  resumeAudio,
  setMenuBackgroundMusicVolume,
  startMenuBackgroundMusic,
  stopBackgroundMusic,
} from '../game/audio';
import { getMenuMusicVolume } from '../game/menuAudioSettings';
import { gameStore } from '../game/gameStore';
import {
  clampJersey,
  DEFAULT_LOCAL_JERSEY,
  DEFAULT_LOCAL_NAME,
  formatJersey,
  getLocalProfile,
  setLocalProfile,
} from '../game/playerRoster';
import { MenuLogoTilt } from './MenuLogoTilt';
import { DEFAULT_MAP_ID, DEFAULT_MAP_NAME } from '../mapEditor/mapEditorTypes';
import { mapEditorStore, mapRegistryStore } from '../mapEditor/mapEditorStore';
import {
  getPremium8Ball,
  resetPremium8Ball,
  subscribePremium8Ball,
} from '../game/premiumBall';
import { HowToPlayContent } from './howToPlayContent';
import { PremiumBallPurchaseModal } from './PremiumBallPurchaseModal';
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
  const [menuMusicVolume, setMenuMusicVolumeState] = useState(
    () => getMenuMusicVolume(),
  );
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const premium8Ball = useSyncExternalStore(
    subscribePremium8Ball,
    getPremium8Ball,
  );
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

  useEffect(() => {
    resetPremium8Ball();
    resumeAudio();
    startMenuBackgroundMusic();
  }, []);

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
    stopBackgroundMusic();
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
            <MenuLogoTilt />

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

            <label className="menu-field menu-field--range">
              <span>
                Menu music
                <em className="menu-range-val">
                  {Math.round(menuMusicVolume * 100)}%
                </em>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(menuMusicVolume * 100)}
                onChange={(e) => {
                  const v = Number(e.target.value) / 100;
                  setMenuMusicVolumeState(v);
                  setMenuBackgroundMusicVolume(v);
                }}
              />
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

            <div className="premium-ball-offer">
              {premium8Ball ? (
                <p className="premium-ball-equipped">
                  Premium 8-Ball equipped
                </p>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn-premium-ball"
                    onClick={() => setShowPremiumModal(true)}
                  >
                    <span className="premium-ball-btn-icons" aria-hidden>
                      <span className="premium-ball-icon">🎁</span>
                      <span className="premium-ball-icon">💵</span>
                    </span>
                    Buy Premium Ball
                  </button>
                  <ul className="premium-ball-stats">
                    <li>+30 extra power on ball</li>
                    <li>+18% magnetic grip strength</li>
                    <li>Pro-grade billiards resin finish</li>
                    <li>VIP chalk pocket (cosmetic)</li>
                  </ul>
                </>
              )}
            </div>

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
      {showPremiumModal && (
        <PremiumBallPurchaseModal
          onClose={() => setShowPremiumModal(false)}
        />
      )}
    </div>
  );
}
