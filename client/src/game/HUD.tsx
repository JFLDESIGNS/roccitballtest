import { useEffect, useSyncExternalStore } from 'react';
import { tuningStore } from './tuningStore';
import { FpsCounter } from './FpsCounter';
import { BallBoundaryHelpBadge } from './BallBoundaryHelpBadge';
import { gameStore } from './gameStore';
import { HudCrosshairEnergy } from './HudCrosshairEnergy';
import { inputManager } from './InputManager';
import {
  isMatchOver,
  matchEndHeadline,
  MATCH_PLAY_AGAIN_KEY,
  MATCH_PLAY_AGAIN_KEY_LABEL,
} from './matchEnd';
import { shouldIgnoreGameplayKeys } from './uiFocus';
import { matchStatRows } from './matchStats';
import { resumeAudio, warmAudio } from './audio';
import { MatchScoreboard } from './MatchScoreboard';
import { StadiumLightEditorPanel } from './StadiumLightEditorPanel';
import { multiplayerStore } from '../multiplayer/multiplayerStore';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatShotDistance(distanceM: number | null): string | null {
  if (distanceM == null || !Number.isFinite(distanceM)) return null;
  return `${Math.max(1, Math.round(distanceM * 3.28084))} ft`;
}

type HUDProps = {
  onMainMenu?: () => void;
};

export function HUD({ onMainMenu }: HUDProps) {
  const state = useSyncExternalStore(gameStore.subscribe, gameStore.getState);
  const multiplayerEnabled = useSyncExternalStore(
    multiplayerStore.subscribe,
    () => multiplayerStore.getState().enabled,
  );
  const multiplayerRoomName = useSyncExternalStore(
    multiplayerStore.subscribe,
    () => multiplayerStore.getState().roomInfo?.name ?? null,
  );
  const multiplayerRoomId = useSyncExternalStore(
    multiplayerStore.subscribe,
    () => multiplayerStore.getState().roomId,
  );
  const multiplayerPlayerCount = useSyncExternalStore(
    multiplayerStore.subscribe,
    () => {
      const s = multiplayerStore.getState();
      return s.roomInfo?.playerCount ?? s.remotePlayers.length + 1;
    },
  );
  const multiplayerMaxPlayers = useSyncExternalStore(
    multiplayerStore.subscribe,
    () => multiplayerStore.getState().roomInfo?.maxPlayers ?? 2,
  );
  const bouncy = useSyncExternalStore(
    tuningStore.subscribe,
    () => tuningStore.getState().bouncyRocketsEnabled,
  );
  const matchOver = isMatchOver(state);

  useEffect(() => {
    const id = window.setInterval(() => {
      gameStore.clearExpiredAnnouncement();
      gameStore.tickBallComboExpiry();
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  const handlePlayAgain = () => {
    inputManager.exitPointerLock();
    inputManager.flushFireInput();
    gameStore.playAgain();
    inputManager.refreshPointerLockState();
  };

  useEffect(() => {
    if (!matchOver) return;
    inputManager.exitPointerLock();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.code !== MATCH_PLAY_AGAIN_KEY) return;
      if (shouldIgnoreGameplayKeys()) return;
      if (!isMatchOver(gameStore.getState())) return;
      e.preventDefault();
      inputManager.exitPointerLock();
      inputManager.flushFireInput();
      gameStore.playAgain();
      inputManager.refreshPointerLockState();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [matchOver]);

  useEffect(() => {
    const bannerId = state.goalBanner?.id;
    if (!bannerId || matchOver) return;
    const timeout = window.setTimeout(() => {
      if (gameStore.getState().goalBanner?.id === bannerId) {
        gameStore.clearScorePopup();
      }
    }, 5200);
    return () => window.clearTimeout(timeout);
  }, [matchOver, state.goalBanner?.id]);

  if (state.phase === 'menu') return null;

  const comboActive =
    state.ballCombo >= 2 && performance.now() <= state.ballComboExpiresAt;

  return (
    <div className={`hud ${state.energyFlash ? 'hud--flash' : ''}`}>
      <FpsCounter />
      {multiplayerEnabled && (
        <div className="hud-online-status">
          <strong>Online</strong>
          <span>
            {(multiplayerRoomName ?? `Room ${multiplayerRoomId}`)} ·{' '}
            {multiplayerPlayerCount}/{multiplayerMaxPlayers} players
          </span>
        </div>
      )}
      <BallBoundaryHelpBadge />
      {state.debugFreelook && (
        <div className="debug-freelook-hint" role="status">
          Debug fly - cursor on - RMB hold to look - WASD fly - U exit - Tab respawn ball
        </div>
      )}
      <StadiumLightEditorPanel />
      <div className="hud-top">
        <div className="hud-top-center">
          <MatchScoreboard
            red={state.score.red}
            blue={state.score.blue}
            timeLabel={formatTime(state.timeLeft)}
          />
          {(state.announcement && performance.now() < state.announcement.expiresAt) ||
          comboActive ? (
            <div className="hud-top-overlays">
              {state.announcement && performance.now() < state.announcement.expiresAt && (
                <div className="hud-announcement">{state.announcement.message}</div>
              )}
              {comboActive && (
                <div className="hud-combo" aria-live="polite">
                  <div className="hud-combo-label">Combo</div>
                  <div className="hud-combo-mult">x{state.ballCombo}</div>
                </div>
              )}
            </div>
          ) : null}
        </div>
        <div className="hud-top-right">
          <div className="hud-speed-panel">
            <div className="hud-speed-row">
              <svg className="hud-speed-icon" viewBox="0 0 24 24" aria-hidden>
                <circle cx="12" cy="5" r="3" fill="currentColor" />
                <path
                  d="M6 21v-2a6 6 0 0 1 12 0v2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span className="hud-speed-value">{state.playerSpeed.toFixed(1)}</span>
              <span className="hud-speed-unit">m/s</span>
            </div>
            <div className="hud-speed-row">
              <svg className="hud-speed-icon hud-speed-icon--ball" viewBox="0 0 24 24" aria-hidden>
                <circle cx="12" cy="12" r="7" fill="currentColor" />
                <path
                  d="M4 12h2M18 12h2M12 4v2M12 18v2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span className="hud-speed-value">{state.ballSpeed.toFixed(1)}</span>
              <span className="hud-speed-unit">m/s</span>
            </div>
          </div>
        </div>
      </div>

      {state.botsEnabled && (
        <div className="hud-bot-energies">
          {(['bot-0', 'bot-1', 'bot-2'] as const).map((id, i) => {
            const pct = state.botEnergies[id] ?? 0;
            const ally = id === 'bot-2';
            return (
              <div key={id} className="hud-bot-energy">
                <span
                  className={`hud-bot-energy-label ${ally ? 'hud-bot-energy-label--ally' : ''}`}
                >
                  {ally ? 'ALLY' : `BOT ${i + 1}`}
                </span>
                <div className="hud-bot-energy-track">
                  <div
                    className={`hud-bot-energy-fill ${ally ? 'hud-bot-energy-fill--ally' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!matchOver && !state.debugFreelook && (
        <HudCrosshairEnergy energy={state.energy} lowEnergy={state.energy < 25} />
      )}

      {!state.pointerLocked &&
        state.phase === 'playing' &&
        !matchOver &&
        !state.debugFreelook && (
          <div
            className="hud-hint"
            role="button"
            tabIndex={0}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              if (tuningStore.getState().showMenu) return;
              const canvas = document.querySelector<HTMLCanvasElement>(
                '.game-canvas canvas',
              );
              if (!canvas) return;
              resumeAudio();
              warmAudio();
              inputManager.requestPointerLock(canvas);
            }}
          >
            Click arena to capture mouse (needed after menu or alt-tab) - LMB rocket - RMB beam - Q
            grapple - F spawn ball
          </div>
        )}

      {state.lastScorePopup && !matchOver && (
        <div className={`hud-popup team-${state.lastScorePopup.team}`}>
          +{state.lastScorePopup.points}
        </div>
      )}

      {state.goalBanner && !matchOver && (
        <div className={`hud-goal-banner hud-goal-banner--${state.goalBanner.team}`}>
          <div className="hud-goal-banner-portrait" aria-hidden>
            <div className="hud-goal-banner-orb">
              {state.goalBanner.team === 'blue' ? 'B' : 'R'}
            </div>
          </div>
          <div className="hud-goal-banner-copy">
            <p className="hud-goal-banner-overline">
              {state.goalBanner.team.toUpperCase()} goal
            </p>
            <h3>{state.goalBanner.scorerName}</h3>
            <p className="hud-goal-banner-result">Scored for {state.goalBanner.team}</p>
            <div className="hud-goal-banner-meta">
              <span>
                <strong>+{state.goalBanner.points}</strong>
                <em>{state.goalBanner.points === 1 ? 'point' : 'points'}</em>
              </span>
              <span>
                <strong>
                  {formatShotDistance(state.goalBanner.shotDistanceM) ?? 'Unknown'}
                </strong>
                <em>shot distance</em>
              </span>
            </div>
          </div>
        </div>
      )}

      {state.phase === 'playing' &&
        state.arenaSettleCountdown === 0 &&
        state.countdown > 0 &&
        !matchOver && <div className="hud-countdown">{state.countdown}</div>}

      {state.showScoreboard && (
        <div className="hud-scoreboard">
          <h3>Scoreboard</h3>
          <p>
            Red {state.score.red} - Blue {state.score.blue}
          </p>
          <p className="muted">Hold Tab</p>
        </div>
      )}

      {!matchOver && (
        <div className="hud-controls">
          <span>
            {bouncy ? 'LMB Tap explosive / Hold bouncer' : 'LMB Explosive rockets'}
          </span>
          <span>RMB Beam</span>
          <span>Q Grapple</span>
          <span>F Spawn ball</span>
          <span>1 Tuning</span>
          <span>Shift Sprint</span>
        </div>
      )}

      {matchOver && (
        <div className="hud-match-end-overlay" role="dialog" aria-modal="true">
          <div className="hud-match-end">
            <p className="hud-match-end-title">{matchEndHeadline(state)}</p>
            <p className="hud-match-end-score">
              Red {state.score.red} - Blue {state.score.blue}
            </p>
            <div className="hud-match-stats">
              <p className="hud-match-stats-heading">Your stats</p>
              <dl className="hud-match-stats-grid">
                {matchStatRows(state.matchStats).map((row) => (
                  <div key={row.label} className="hud-match-stat">
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="hud-match-end-actions">
              <button type="button" className="hud-match-end-btn" onClick={handlePlayAgain}>
                Play again <kbd className="hud-match-end-kbd">{MATCH_PLAY_AGAIN_KEY_LABEL}</kbd>
              </button>
              {onMainMenu && (
                <button
                  type="button"
                  className="hud-match-end-btn hud-match-end-btn--secondary"
                  onClick={onMainMenu}
                >
                  Main menu
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
