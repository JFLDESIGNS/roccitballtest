import { useEffect, useSyncExternalStore } from 'react';
import { tuningStore } from './tuningStore';
import { MATCH } from '../shared/Constants';
import { BallBoundaryHelpBadge } from './BallBoundaryHelpBadge';
import { gameStore } from './gameStore';
import { HudCrosshairEnergy } from './HudCrosshairEnergy';
import { inputManager } from './InputManager';
import { resumeAudio, warmAudio } from './audio';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function HUD() {
  const state = useSyncExternalStore(gameStore.subscribe, gameStore.getState);
  const bouncy = useSyncExternalStore(
    tuningStore.subscribe,
    () => tuningStore.getState().bouncyRocketsEnabled,
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      gameStore.clearExpiredAnnouncement();
      gameStore.tickBallComboExpiry();
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  if (state.phase === 'menu') return null;

  const comboActive =
    state.ballCombo >= 2 && performance.now() <= state.ballComboExpiresAt;

  return (
    <div className={`hud ${state.energyFlash ? 'hud--flash' : ''}`}>
      <BallBoundaryHelpBadge />
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

      <HudCrosshairEnergy
        energy={state.energy}
        lowEnergy={state.energy < 25}
      />

      {!state.pointerLocked && state.phase === 'playing' && (
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
          Click arena to capture mouse · LMB rocket · RMB beam · F spawn ball
        </div>
      )}

      {state.lastScorePopup && (
        <div className={`hud-popup team-${state.lastScorePopup.team}`}>
          +{state.lastScorePopup.points}
        </div>
      )}

      {state.phase === 'loading' && state.loadCountdown > 0 && (
        <div className="hud-loading">
          <span className="hud-loading-label">Loading arena</span>
          <span className="hud-loading-time">{state.loadCountdown}</span>
        </div>
      )}

      {state.phase === 'playing' && state.countdown > 0 && (
        <div className="hud-countdown">{state.countdown}</div>
      )}

      {state.showScoreboard && (
        <div className="hud-scoreboard">
          <h3>Scoreboard</h3>
          <p>Red {state.score.red} — Blue {state.score.blue}</p>
          <p className="muted">Hold Tab</p>
        </div>
      )}

      <div className="hud-controls">
        <span>
          {bouncy ? 'LMB Tap explosive / Hold bouncer' : 'LMB Explosive rockets'}
        </span>
        <span>RMB Beam</span>
        <span>F Spawn ball</span>
        <span>1 Tuning</span>
        <span>Shift Sprint</span>
      </div>

      {state.score.red >= MATCH.scoreLimit || state.score.blue >= MATCH.scoreLimit ? (
        <div className="hud-match-end">
          Match over —{' '}
          {state.score.blue >= MATCH.scoreLimit ? 'Blue wins!' : 'Red wins!'}
        </div>
      ) : null}
    </div>
  );
}
