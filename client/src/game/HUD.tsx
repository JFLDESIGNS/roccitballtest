import { useEffect, useSyncExternalStore } from 'react';
import { tuningStore } from './tuningStore';
import { FpsCounter } from './FpsCounter';
import { BallBoundaryHelpBadge } from './BallBoundaryHelpBadge';
import { gameStore } from './gameStore';
import { HudCrosshairEnergy } from './HudCrosshairEnergy';
import { inputManager } from './InputManager';
import { isMatchOver, matchEndHeadline } from './matchEnd';
import { matchStatRows } from './matchStats';
import { resumeAudio, warmAudio } from './audio';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type HUDProps = {
  onMainMenu?: () => void;
};

export function HUD({ onMainMenu }: HUDProps) {
  const state = useSyncExternalStore(gameStore.subscribe, gameStore.getState);
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
    document.exitPointerLock();
    inputManager.flushFireInput();
    gameStore.playAgain();
  };

  if (state.phase === 'menu') return null;

  const comboActive =
    state.ballCombo >= 2 && performance.now() <= state.ballComboExpiresAt;

  return (
    <div className={`hud ${state.energyFlash ? 'hud--flash' : ''}`}>
      <FpsCounter />
      <BallBoundaryHelpBadge />
      {state.debugFreelook && (
        <div className="debug-freelook-hint" role="status">
          Debug fly (match paused) — U resume · WASD move · Q/E up-down · Shift fast · mouse to look
        </div>
      )}
      <div className="hud-top">
        <div className="hud-top-center">
          {state.announcement && performance.now() < state.announcement.expiresAt && (
            <div className="hud-announcement">{state.announcement.message}</div>
          )}
          {comboActive && (
            <div className="hud-combo" aria-live="polite">
              <div className="hud-combo-label">Combo</div>
              <div className="hud-combo-mult">x{state.ballCombo}</div>
            </div>
          )}
          <div className="hud-score" aria-label="Match score">
            <span className="team-red">{state.score.red}</span>
            <span className="hud-score-div">—</span>
            <span className="team-blue">{state.score.blue}</span>
          </div>
        </div>
        <div className="hud-top-right">
          <div className="hud-timer">{formatTime(state.timeLeft)}</div>
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
        <HudCrosshairEnergy
          energy={state.energy}
          lowEnergy={state.energy < 25}
        />
      )}

      {!state.pointerLocked && state.phase === 'playing' && !matchOver && (
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
          Click arena to capture mouse (needed after menu or alt-tab) · LMB rocket ·
          RMB beam · F spawn ball
        </div>
      )}

      {state.lastScorePopup && !matchOver && (
        <div className={`hud-popup team-${state.lastScorePopup.team}`}>
          +{state.lastScorePopup.points}
        </div>
      )}

      {state.phase === 'playing' &&
        state.arenaSettleCountdown > 0 &&
        !matchOver && (
          <div className="hud-countdown hud-countdown--settle">
            {state.arenaSettleCountdown}
          </div>
        )}

      {state.phase === 'playing' &&
        state.arenaSettleCountdown === 0 &&
        state.countdown > 0 &&
        !matchOver && (
          <div className="hud-countdown">{state.countdown}</div>
        )}

      {state.showScoreboard && (
        <div className="hud-scoreboard">
          <h3>Scoreboard</h3>
          <p>Red {state.score.red} — Blue {state.score.blue}</p>
          <p className="muted">Hold Tab</p>
        </div>
      )}

      {!matchOver && (
        <div className="hud-controls">
          <span>
            {bouncy ? 'LMB Tap explosive / Hold bouncer' : 'LMB Explosive rockets'}
          </span>
          <span>RMB Beam</span>
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
              Red {state.score.red} — Blue {state.score.blue}
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
                Play again
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
