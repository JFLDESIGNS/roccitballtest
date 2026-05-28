import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
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
import {
  multiplayerStore,
  type RoomMode,
  type RoomSummary,
} from '../multiplayer/multiplayerStore';
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

function roomModeLabel(mode: RoomMode): string {
  return mode === '2v2' ? '2v2' : '1v1';
}

function roomModeDescription(mode: RoomMode): string {
  return mode === '2v2'
    ? 'Four players, two per team'
    : 'Two players, one per team';
}

export function MainMenu({ onPlay, onEditMap }: MainMenuProps) {
  const saved = loadSavedProfile();
  const [playerName, setPlayerName] = useState(saved.name);
  const [jerseyNumber, setJerseyNumber] = useState(saved.number);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [menuMusicVolume, setMenuMusicVolumeState] = useState(
    () => getMenuMusicVolume(),
  );
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showServerBrowser, setShowServerBrowser] = useState(false);
  const [browserRooms, setBrowserRooms] = useState<RoomSummary[]>([]);
  const [browserBusy, setBrowserBusy] = useState(false);
  const [browserError, setBrowserError] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState<RoomMode>('1v1');
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

  const roomReadyCount = useMemo(() => {
    const selfReady = multiplayer.playReady ? 1 : 0;
    return (
      selfReady +
      multiplayer.remotePlayers.filter((player) => player.playReady === true).length
    );
  }, [multiplayer.playReady, multiplayer.remotePlayers]);

  const roomInfo = multiplayer.roomInfo;
  const roomIsFull =
    roomInfo !== null && roomInfo.playerCount >= roomInfo.maxPlayers;
  const everyoneReady =
    roomInfo !== null && roomReadyCount >= roomInfo.maxPlayers;

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
    if (
      multiplayer.enabled &&
      multiplayer.status === 'online' &&
      multiplayer.playReady &&
      roomIsFull &&
      everyoneReady
    ) {
      setShowServerBrowser(false);
      resumeAudio();
      stopBackgroundMusic();
      onPlay();
    }
  }, [
    everyoneReady,
    multiplayer.enabled,
    multiplayer.playReady,
    multiplayer.status,
    onPlay,
    roomIsFull,
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

  const syncProfile = () => {
    commitProfile();
    setLocalProfile(playerName, jerseyNumber);
    multiplayerStore.updateProfile(getLocalProfile());
  };

  const refreshRooms = async () => {
    setBrowserBusy(true);
    setBrowserError(null);
    try {
      const rooms = await multiplayerStore.fetchRooms();
      setBrowserRooms(rooms);
    } catch (error) {
      setBrowserError(
        error instanceof Error ? error.message : 'Could not load lobbies.',
      );
    } finally {
      setBrowserBusy(false);
    }
  };

  useEffect(() => {
    if (!showServerBrowser || multiplayer.enabled) return;
    void refreshRooms();
    const id = window.setInterval(() => {
      void refreshRooms();
    }, 3000);
    return () => window.clearInterval(id);
  }, [multiplayer.enabled, showServerBrowser]);

  const openServerBrowser = () => {
    syncProfile();
    setShowServerBrowser(true);
    if (!multiplayer.enabled) {
      void refreshRooms();
    }
  };

  const launchOfflineMatch = (withBots: boolean) => {
    syncProfile();
    if (multiplayer.enabled) multiplayerStore.disconnect();
    gameStore.setBotsEnabled(withBots);
    setShowServerBrowser(false);
    resumeAudio();
    stopBackgroundMusic();
    onPlay();
  };

  const joinRoom = (roomId: string) => {
    syncProfile();
    gameStore.setBotsEnabled(false);
    multiplayerStore.connect(getLocalProfile(), roomId);
  };

  const createRoom = async () => {
    syncProfile();
    setBrowserBusy(true);
    setBrowserError(null);
    try {
      const room = await multiplayerStore.createRoom({ mode: createMode });
      gameStore.setBotsEnabled(false);
      multiplayerStore.connect(getLocalProfile(), room.id);
    } catch (error) {
      setBrowserError(
        error instanceof Error ? error.message : 'Could not create lobby.',
      );
    } finally {
      setBrowserBusy(false);
    }
  };

  const leaveLobby = () => {
    multiplayerStore.sendPlayReady(false);
    multiplayerStore.disconnect();
    setBrowserError(null);
    void refreshRooms();
  };

  const toggleReady = () => {
    multiplayerStore.sendPlayReady(!multiplayer.playReady);
  };

  const openEditor = () => {
    commitProfile();
    mapEditorStore.openEditor(DEFAULT_MAP_ID);
    onEditMap();
  };

  const lobbyRoster = useMemo(() => {
    if (!multiplayer.roomInfo) return [];
    const self = multiplayer.selfId
      ? [
          {
            id: multiplayer.selfId,
            name: getLocalProfile().displayName,
            team: multiplayer.team ?? 'blue',
            teamSlot: multiplayer.teamSlot,
            ready: multiplayer.playReady,
            jerseyNumber: getLocalProfile().jerseyNumber,
            self: true,
          },
        ]
      : [];
    const remotes = multiplayer.remotePlayers.map((player) => ({
      id: player.id,
      name: player.name,
      team: player.team,
      teamSlot: player.teamSlot,
      ready: Boolean(player.playReady),
      jerseyNumber: player.jerseyNumber,
      self: false,
    }));
    return [...self, ...remotes].sort((a, b) => {
      if (a.team !== b.team) return a.team === 'blue' ? -1 : 1;
      return a.teamSlot - b.teamSlot;
    });
  }, [
    multiplayer.playReady,
    multiplayer.remotePlayers,
    multiplayer.roomInfo,
    multiplayer.selfId,
    multiplayer.team,
    multiplayer.teamSlot,
  ]);

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
                    onChange={(e) => gameStore.setBotsEnabled(e.target.checked)}
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
                    onClick={openServerBrowser}
                  >
                    {multiplayer.enabled ? 'Current Lobby' : 'Server Browser'}
                    <span>
                      {multiplayer.enabled && multiplayer.roomInfo
                        ? `${multiplayer.roomInfo.playerCount}/${multiplayer.roomInfo.maxPlayers}`
                        : 'rooms'}
                    </span>
                  </button>
                  <small>
                    {multiplayer.enabled && multiplayer.roomInfo
                      ? `${multiplayer.roomInfo.name} · ${roomModeLabel(multiplayer.roomInfo.mode)}`
                      : 'Browse online lobbies or start a bots match'}
                  </small>
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
            <button
              type="button"
              className="btn-play-now"
              onClick={openServerBrowser}
            >
              Play Now
            </button>
          </footer>

          {showServerBrowser && (
            <div className="main-menu-browser-backdrop" role="dialog" aria-modal="true">
              <div className="main-menu-browser">
                <div className="main-menu-browser-head">
                  <div>
                    <p className="main-menu-browser-kicker">Play Hub</p>
                    <h2>
                      {multiplayer.enabled && multiplayer.roomInfo
                        ? multiplayer.roomInfo.name
                        : 'Server Browser'}
                    </h2>
                    <span>
                      {multiplayer.enabled && multiplayer.roomInfo
                        ? `${roomModeLabel(multiplayer.roomInfo.mode)} · ${multiplayer.roomInfo.playerCount}/${multiplayer.roomInfo.maxPlayers} players in lobby`
                        : 'Join an online lobby or launch a local match'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowServerBrowser(false)}
                  >
                    Close
                  </button>
                </div>

                {multiplayer.enabled && multiplayer.roomInfo ? (
                  <div className="main-menu-lobby">
                    <div className="main-menu-lobby-meta">
                      <div className="main-menu-lobby-stat">
                        <strong>{multiplayer.roomInfo.playerCount}</strong>
                        <span>Players</span>
                      </div>
                      <div className="main-menu-lobby-stat">
                        <strong>{roomReadyCount}</strong>
                        <span>Ready</span>
                      </div>
                      <div className="main-menu-lobby-stat">
                        <strong>{roomModeLabel(multiplayer.roomInfo.mode)}</strong>
                        <span>Mode</span>
                      </div>
                    </div>

                    <div className="main-menu-lobby-roster">
                      {lobbyRoster.map((player) => (
                        <div
                          key={player.id}
                          className={`main-menu-lobby-player main-menu-lobby-player--${player.team}`}
                        >
                          <div className="main-menu-lobby-player-badge">
                            {player.team === 'blue' ? 'B' : 'R'}
                          </div>
                          <div className="main-menu-lobby-player-copy">
                            <strong>
                              {player.name}
                              {player.self ? ' (You)' : ''}
                            </strong>
                            <span>
                              #{player.jerseyNumber.toString().padStart(2, '0')} ·{' '}
                              {player.team.toUpperCase()} slot {player.teamSlot + 1}
                            </span>
                          </div>
                          <em>{player.ready ? 'Ready' : 'Waiting'}</em>
                        </div>
                      ))}
                      {Array.from({
                        length: Math.max(
                          0,
                          multiplayer.roomInfo.maxPlayers - lobbyRoster.length,
                        ),
                      }).map((_, index) => (
                        <div key={`open-slot-${index}`} className="main-menu-lobby-player main-menu-lobby-player--empty">
                          <div className="main-menu-lobby-player-badge">+</div>
                          <div className="main-menu-lobby-player-copy">
                            <strong>Open Slot</strong>
                            <span>Waiting for another pilot</span>
                          </div>
                          <em>Open</em>
                        </div>
                      ))}
                    </div>

                    <div className="main-menu-lobby-footer">
                      <p>
                        {roomIsFull
                          ? everyoneReady
                            ? 'Everybody is ready. Launching the match...'
                            : 'Lobby is full. Ready up to launch.'
                          : `Waiting for ${multiplayer.roomInfo.maxPlayers - multiplayer.roomInfo.playerCount} more player${multiplayer.roomInfo.maxPlayers - multiplayer.roomInfo.playerCount === 1 ? '' : 's'}.`}
                      </p>
                      <div className="main-menu-lobby-actions">
                        <button
                          type="button"
                          className="btn-online btn-online--active"
                          onClick={toggleReady}
                        >
                          {multiplayer.playReady ? 'Cancel Ready' : 'Ready Up'}
                          <span>{multiplayer.playReady ? 'ready' : 'not ready'}</span>
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={leaveLobby}
                        >
                          Leave Lobby
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="main-menu-browser-grid">
                    <section className="main-menu-browser-panel">
                      <div className="main-menu-browser-panel-head">
                        <h3>Online Games</h3>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => void refreshRooms()}
                          disabled={browserBusy}
                        >
                          Refresh
                        </button>
                      </div>
                      <div className="main-menu-room-list">
                        {browserRooms.length === 0 ? (
                          <div className="main-menu-room-empty">
                            <strong>No games live right now</strong>
                            <span>Create a fresh lobby below.</span>
                          </div>
                        ) : (
                          browserRooms.map((room) => (
                            <button
                              key={room.id}
                              type="button"
                              className="main-menu-room-card"
                              onClick={() => joinRoom(room.id)}
                              disabled={browserBusy || room.playerCount >= room.maxPlayers}
                            >
                              <div className="main-menu-room-card-top">
                                <strong>{room.name}</strong>
                                <em>{roomModeLabel(room.mode)}</em>
                              </div>
                              <span>{roomModeDescription(room.mode)}</span>
                              <div className="main-menu-room-card-foot">
                                <small>
                                  {room.playerCount}/{room.maxPlayers} in lobby
                                </small>
                                <small>{room.readyCount} ready</small>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </section>

                    <section className="main-menu-browser-panel">
                      <div className="main-menu-browser-panel-head">
                        <h3>Create a Game</h3>
                      </div>
                      <div className="main-menu-browser-create">
                        <div className="main-menu-mode-toggle">
                          {(['1v1', '2v2'] as RoomMode[]).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              className={
                                mode === createMode
                                  ? 'main-menu-mode-btn main-menu-mode-btn--active'
                                  : 'main-menu-mode-btn'
                              }
                              onClick={() => setCreateMode(mode)}
                            >
                              {roomModeLabel(mode)}
                            </button>
                          ))}
                        </div>
                        <p className="main-menu-browser-copy">
                          {roomModeDescription(createMode)}. The match starts after the lobby fills
                          and every player readies up.
                        </p>
                        <button
                          type="button"
                          className="btn-online btn-online--active"
                          onClick={() => void createRoom()}
                          disabled={browserBusy}
                        >
                          Create {roomModeLabel(createMode)} Lobby
                          <span>online</span>
                        </button>
                        <div className="main-menu-browser-divider" />
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => launchOfflineMatch(true)}
                        >
                          Play Against Bots
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => launchOfflineMatch(false)}
                        >
                          Solo Free Play
                        </button>
                      </div>
                    </section>
                  </div>
                )}

                {(browserError || multiplayer.error) && (
                  <div className="main-menu-browser-error">
                    {browserError || multiplayer.error}
                  </div>
                )}
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
