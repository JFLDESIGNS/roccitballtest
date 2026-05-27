import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  resumeAudio,
  setMenuBackgroundMusicVolume,
  startMenuBackgroundMusic,
  stopBackgroundMusic,
} from '../game/audio';
import { getMenuMusicVolume } from '../game/menuAudioSettings';
import { gameStore } from '../game/gameStore';
import { graphicsStore } from '../game/graphicsStore';
import {
  clampJersey,
  DEFAULT_LOCAL_JERSEY,
  DEFAULT_LOCAL_NAME,
  formatJersey,
  getLocalProfile,
  setLocalProfile,
} from '../game/playerRoster';
import { multiplayerStore } from '../multiplayer/multiplayerStore';
import { MenuLogoTilt } from './MenuLogoTilt';
import { MenuBotPreview } from './MenuBotPreview';
import { DEFAULT_MAP_ID, DEFAULT_MAP_NAME } from '../mapEditor/mapEditorTypes';
import { mapEditorStore, mapRegistryStore } from '../mapEditor/mapEditorStore';
import {
  getPremium8Ball,
  resetPremium8Ball,
  subscribePremium8Ball,
} from '../game/premiumBall';
import { HowToPlayContent } from './howToPlayContent';
import { PremiumBallPurchaseModal } from './PremiumBallPurchaseModal';
import premiumBallsImage from '../assets/images/ui/premium-balls.png';
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
  const [waitingForOnlinePlayer, setWaitingForOnlinePlayer] = useState(false);
  const premium8Ball = useSyncExternalStore(
    subscribePremium8Ball,
    getPremium8Ball,
  );
  const botsEnabled = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().botsEnabled,
  );
  const badPuter = useSyncExternalStore(
    graphicsStore.subscribe,
    () => graphicsStore.getState().badPuter,
  );
  const activeMapId = useSyncExternalStore(
    mapRegistryStore.subscribe,
    () => mapRegistryStore.getActiveMapId(),
  );
  const customMaps = useSyncExternalStore(
    mapRegistryStore.subscribe,
    mapRegistryStore.listSummaries,
  );
  const multiplayer = useSyncExternalStore(
    multiplayerStore.subscribe,
    multiplayerStore.getState,
  );

  useEffect(() => {
    setLocalProfile(playerName, jerseyNumber);
    multiplayerStore.updateProfile(getLocalProfile());
  }, [playerName, jerseyNumber]);

  useEffect(() => {
    resetPremium8Ball();
    resumeAudio();
    startMenuBackgroundMusic();
  }, []);

  useEffect(() => {
    if (!waitingForOnlinePlayer) return;
    if (!multiplayer.enabled || multiplayer.status === 'offline') {
      setWaitingForOnlinePlayer(false);
      return;
    }
    if (multiplayer.status !== 'online') return;
    if (!multiplayer.playReady) {
      multiplayerStore.sendPlayReady(true);
      return;
    }
    const allReady =
      multiplayer.playReady &&
      multiplayer.remotePlayers.length > 0 &&
      multiplayer.remotePlayers.every((player) => player.playReady === true);
    if (!allReady) return;
    setWaitingForOnlinePlayer(false);
    resumeAudio();
    stopBackgroundMusic();
    onPlay();
  }, [
    multiplayer.enabled,
    multiplayer.playReady,
    multiplayer.remotePlayers.length,
    multiplayer.remotePlayers,
    multiplayer.status,
    onPlay,
    waitingForOnlinePlayer,
  ]);

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
    multiplayerStore.updateProfile(getLocalProfile());
    if (multiplayer.enabled) {
      if (multiplayer.status === 'online') {
        multiplayerStore.sendPlayReady(true);
      }
      if (
        multiplayer.status !== 'online' ||
        multiplayer.remotePlayers.length === 0 ||
        !multiplayer.remotePlayers.every((player) => player.playReady === true)
      ) {
        setWaitingForOnlinePlayer(true);
        return;
      }
    }
    resumeAudio();
    stopBackgroundMusic();
    onPlay();
  };

  const toggleMultiplayer = () => {
    commitProfile();
    setLocalProfile(playerName, jerseyNumber);
    const profile = getLocalProfile();
    if (multiplayer.enabled) {
      setWaitingForOnlinePlayer(false);
      multiplayerStore.sendPlayReady(false);
      multiplayerStore.disconnect();
    } else {
      gameStore.setBotsEnabled(false);
      multiplayerStore.connect(profile);
    }
  };

  const openEditor = () => {
    commitProfile();
    mapEditorStore.openEditor(DEFAULT_MAP_ID);
    onEditMap();
  };

  return (
    <div className="main-menu">
      {showHowToPlay ? (
        <div className="main-menu-howto">
          <div className="main-menu-howto-panel">
            <h2 className="how-to-play-title">How to Play</h2>
            <HowToPlayContent />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowHowToPlay(false)}
            >
              Back to Menu
            </button>
          </div>
        </div>
      ) : (
        <div className="main-menu-layout">
          <header className="main-menu-hero">
            <div className="main-menu-bot-overlay" aria-hidden>
              <MenuBotPreview team="blue" />
            </div>
            <MenuLogoTilt />
          </header>

          <div className="main-menu-dock" aria-label="Menu options">
            <section
              className="main-menu-strip-card main-menu-dock-setup"
              aria-label="Play setup"
            >
              <div className="main-menu-setup-compact">
                <label className="menu-field menu-field--dock-name">
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
                <label className="menu-field menu-field--number menu-field--dock-jersey">
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
                <label className="menu-option menu-option--dock-bots">
                  <input
                    type="checkbox"
                    checked={multiplayer.enabled ? false : botsEnabled}
                    disabled={multiplayer.enabled}
                    onChange={(e) =>
                      gameStore.setBotsEnabled(e.target.checked)
                    }
                  />
                  <span>
                    {multiplayer.enabled ? 'Bots off online' : 'Practice bots'}
                  </span>
                </label>
                <label className="menu-option menu-option--dock-bad-puter">
                  <input
                    type="checkbox"
                    checked={badPuter}
                    onChange={(e) => graphicsStore.setBadPuter(e.target.checked)}
                  />
                  <span>Bad Puter</span>
                </label>
                <label className="menu-field menu-map-picker menu-field--dock-map">
                  <span>Arena map</span>
                  <select
                    value={activeMapId}
                    onChange={(e) =>
                      mapRegistryStore.setActiveMapId(e.target.value)
                    }
                  >
                    <option value={DEFAULT_MAP_ID}>{DEFAULT_MAP_NAME}</option>
                    {customMaps.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="menu-field menu-field--range menu-field--dock-music">
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
                <div className="menu-online menu-field--dock-online">
                  <button
                    type="button"
                    className={
                      multiplayer.enabled
                        ? 'btn-online btn-online--active'
                        : 'btn-online'
                    }
                    onClick={toggleMultiplayer}
                  >
                    Online Multiplayer
                    <span>{multiplayer.status}</span>
                  </button>
                  {multiplayer.error ? (
                    <small>{multiplayer.error}</small>
                  ) : (
                    <small>
                      {multiplayer.selfId
                        ? `Room ${multiplayer.roomId} · ${
                            multiplayer.remotePlayers.length + 1
                          } player${
                            multiplayer.remotePlayers.length === 0 ? '' : 's'
                          } online`
                        : 'Connect before Play Now'}
                    </small>
                  )}
                </div>
              </div>
            </section>

            <div className="main-menu-dock-row">
              <section
                className="main-menu-strip-card main-menu-dock-premium"
                aria-label="Premium ball"
              >
                <div className="premium-ball-offer premium-ball-offer--dock">
                  <div className="premium-balls-showcase" aria-hidden>
                    <img src={premiumBallsImage} alt="" />
                  </div>
                  {premium8Ball ? (
                    <p className="premium-ball-equipped">
                      Premium 8-Ball equipped
                    </p>
                  ) : (
                    <>
                      <ul className="premium-ball-stats premium-ball-stats--dock">
                        <li>+30 extra power on ball</li>
                        <li>+18% magnetic grip strength</li>
                        <li>Pro-grade billiards resin finish</li>
                        <li>VIP chalk pocket (cosmetic)</li>
                      </ul>
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
                    </>
                  )}
                </div>
              </section>

              <section
                className="main-menu-strip-card main-menu-dock-actions"
                aria-label="More"
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={openEditor}
                >
                  Edit Map
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowHowToPlay(true)}
                >
                  How to Play
                </button>
              </section>
            </div>
          </div>

          <footer className="main-menu-play">
            <button type="button" className="btn-play-now" onClick={enterArena}>
              Play Now
            </button>
          </footer>

          {waitingForOnlinePlayer && (
            <div className="main-menu-waiting-backdrop" role="status">
              <div className="main-menu-waiting-panel">
                <strong>Waiting for players</strong>
                <span>
                  The match starts after each connected player presses Play Now.
                </span>
                <em>
                  Room {multiplayer.roomId} ·{' '}
                  {multiplayer.remotePlayers.length + 1} player
                  {multiplayer.remotePlayers.length === 0 ? '' : 's'} online
                </em>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    multiplayerStore.sendPlayReady(false);
                    setWaitingForOnlinePlayer(false);
                  }}
                >
                  Cancel Wait
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showPremiumModal && (
        <PremiumBallPurchaseModal onClose={() => setShowPremiumModal(false)} />
      )}
    </div>
  );
}
