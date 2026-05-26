import { MATCH } from '../shared/Constants';
import { arenaRoofStore } from './arenaRoofStore';
import { stadiumLightStore } from './stadiumLightStore';
import { clearBotTeamRelease } from './botTeamRelease';
import { EMPTY_MATCH_STATS, type MatchStats } from './matchStats';
import { tuningStore } from './tuningStore';
import type { BallStateKind, GoalSize, MatchScore, Team } from '../shared/Types';

function holdImmunityDurationMs(): number {
  return tuningStore.getState().holdConnectImmunitySec * 1000;
}

export type BotId = 'bot-0' | 'bot-1' | 'bot-2';

export type GamePhase =
  | 'menu'
  | 'intro'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'countdown';

export type BallHolderId = null | 'local' | 'bot-0' | 'bot-1' | 'bot-2';

const BOT_HOLDER_IDS = ['bot-0', 'bot-1', 'bot-2'] as const;

export function isBotHolderId(id: BallHolderId): id is 'bot-0' | 'bot-1' | 'bot-2' {
  return id !== null && id !== 'local' && BOT_HOLDER_IDS.includes(id);
}

type GameStoreState = {
  phase: GamePhase;
  score: MatchScore;
  timeLeft: number;
  energy: number;
  energyFlash: boolean;
  lastScorePopup: { points: number; team: Team } | null;
  countdown: number;
  /** Post-load arena settle (5-4-3-2-1) before kickoff 3-2-1 */
  arenaSettleCountdown: number;
  /** Map load-in timer (seconds remaining) */
  loadCountdown: number;
  ballFrozen: boolean;
  pointerLocked: boolean;
  showScoreboard: boolean;
  localTeam: Team;
  ballState: BallStateKind;
  isHoldingBall: boolean;
  ballHolderId: BallHolderId;
  isBeaming: boolean;
  isSprinting: boolean;
  playerSpeed: number;
  ballSpeed: number;
  goalCelebration: { id: number; x: number; y: number; z: number; team: Team } | null;
  /** Team that scored last (for bot celebration, etc.) */
  lastScoringTeam: Team | null;
  botsEnabled: boolean;
  botEnergies: Record<BotId, number>;
  /** U during match — fly camera, no player collision, hidden avatar */
  debugFreelook: boolean;
  /** Rapier collider wireframes — off by default, G to toggle */
  showColliderDebug: boolean;
  /** Goal zone debug meshes (scoring / shoot / net-finish cylinders) */
  showGoalZoneDebug: boolean;
  /** Show real physics ball mesh (hides proxy) — 2 to toggle */
  showPhysicsBall: boolean;
  /** Smooth display model for local player — 4 to toggle; off = locked to physics */
  playerVisualProxy: boolean;
  /** Increments on local jump — drives hat pop animation */
  playerHatPopSeq: number;
  /** Debug: show "helping" badge until this timestamp (performance.now) */
  ballBoundaryHelpUntil: number;
  /** Kill-feed style callout (performance.now ms when it expires) */
  announcement: { message: string; expiresAt: number } | null;
  /** Consecutive mid-air hits by local player (display from 2+) */
  ballCombo: number;
  /** performance.now() — combo resets after BALL_COMBO_TIMEOUT_MS idle */
  ballComboExpiresAt: number;
  /** Block rockets + combat SFX until this timestamp (performance.now) */
  combatGraceUntilMs: number;
  /** Rocket knock tumble — no movement input until this time */
  playerKnockStunUntilMs: number;
  /** Goal eject — WASD blocked; mouse look still works */
  playerGoalEjectMoveLockUntilMs: number;
  /** Increments on each new match — resets timers in MatchLoop */
  matchGeneration: number;
  /** Local-player totals for the end-game stats screen */
  matchStats: MatchStats;
  /** performance.now() — held ball cannot be knocked loose until this time */
  holdImmunityUntilMs: number;
};

const listeners = new Set<() => void>();

import { MENU_BOTS_ENABLED_DEFAULT } from './menuOptionDefaults';

const BOTS_ENABLED_KEY = 'rocketball-bots-enabled';

function loadBotsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(BOTS_ENABLED_KEY);
    if (raw === null) return MENU_BOTS_ENABLED_DEFAULT;
    return raw !== 'false';
  } catch {
    return MENU_BOTS_ENABLED_DEFAULT;
  }
}

let celebrationId = 0;

function armCombatGrace(): void {
  state = {
    ...state,
    combatGraceUntilMs: performance.now() + MATCH.combatGraceSec * 1000,
  };
}

export function isCombatGraceActive(): boolean {
  return performance.now() < state.combatGraceUntilMs;
}

let state: GameStoreState = {
  phase: 'menu',
  score: { red: 0, blue: 0 },
  timeLeft: MATCH.durationSec,
  energy: 100,
  energyFlash: false,
  lastScorePopup: null,
  countdown: 0,
  arenaSettleCountdown: 0,
  loadCountdown: 0,
  ballFrozen: false,
  pointerLocked: false,
  showScoreboard: false,
  localTeam: 'blue',
  ballState: 'loose',
  isHoldingBall: false,
  ballHolderId: null,
  isBeaming: false,
  isSprinting: false,
  playerSpeed: 0,
  ballSpeed: 0,
  goalCelebration: null,
  lastScoringTeam: null,
  botsEnabled: loadBotsEnabled(),
  botEnergies: { 'bot-0': 100, 'bot-1': 100, 'bot-2': 100 },
  debugFreelook: false,
  showColliderDebug: false,
  showGoalZoneDebug: false,
  showPhysicsBall: false,
  playerVisualProxy: true,
  playerHatPopSeq: 0,
  ballBoundaryHelpUntil: 0,
  announcement: null,
  ballCombo: 0,
  ballComboExpiresAt: 0,
  combatGraceUntilMs: 0,
  playerKnockStunUntilMs: 0,
  playerGoalEjectMoveLockUntilMs: 0,
  matchGeneration: 0,
  matchStats: { ...EMPTY_MATCH_STATS },
  holdImmunityUntilMs: 0,
};

function notify() {
  listeners.forEach((l) => l());
}

export const gameStore = {
  getState: () => state,
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  setPhase: (phase: GamePhase) => {
    state = { ...state, phase };
    notify();
  },
  setBotsEnabled: (enabled: boolean) => {
    try {
      localStorage.setItem(BOTS_ENABLED_KEY, String(enabled));
    } catch {
      /* ignore */
    }
    state = { ...state, botsEnabled: enabled };
    if (!enabled && isBotHolderId(state.ballHolderId)) {
      state = {
        ...state,
        ballHolderId: null,
        isHoldingBall: false,
        ballState: state.ballState === 'held' ? 'loose' : state.ballState,
      };
    }
    notify();
  },
  startMatch: () => {
    clearBotTeamRelease();
    arenaRoofStore.reset();
    state = {
      ...state,
      phase: 'intro',
      pointerLocked: false,
      score: { red: 0, blue: 0 },
      timeLeft: MATCH.durationSec,
      energy: 100,
      lastScorePopup: null,
      countdown: 0,
      arenaSettleCountdown: 0,
      loadCountdown: 0,
      ballFrozen: true,
      ballHolderId: null,
      isHoldingBall: false,
      ballState: 'loose',
      botEnergies: { 'bot-0': 100, 'bot-1': 100, 'bot-2': 100 },
      ballBoundaryHelpUntil: 0,
      ballCombo: 0,
      ballComboExpiresAt: 0,
      playerKnockStunUntilMs: 0,
      playerGoalEjectMoveLockUntilMs: 0,
      matchGeneration: state.matchGeneration + 1,
      matchStats: { ...EMPTY_MATCH_STATS },
      holdImmunityUntilMs: 0,
      debugFreelook: false,
    };
    notify();
  },
  playAgain: () => {
    gameStore.startMatch();
  },
  armPlayerKnockStun: (untilMs: number) => {
    state = { ...state, playerKnockStunUntilMs: untilMs };
    notify();
  },
  clearPlayerKnockStun: () => {
    if (state.playerKnockStunUntilMs === 0) return;
    state = { ...state, playerKnockStunUntilMs: 0 };
    notify();
  },
  armPlayerGoalEjectMoveLock: (untilMs: number) => {
    state = { ...state, playerGoalEjectMoveLockUntilMs: untilMs };
    notify();
  },
  /** Flash top-left debug badge when ball boundary assist runs */
  notifyBallBoundaryHelp: () => {
    state = {
      ...state,
      ballBoundaryHelpUntil: performance.now() + 700,
    };
    notify();
  },
  setPointerLocked: (locked: boolean) => {
    state = { ...state, pointerLocked: locked };
    notify();
  },
  setShowScoreboard: (show: boolean) => {
    state = { ...state, showScoreboard: show };
    notify();
  },
  toggleDebugFreelook: () => {
    const entering = !state.debugFreelook;
    const releaseBall =
      entering &&
      (state.ballHolderId === 'local' || state.isHoldingBall);
    state = { ...state, debugFreelook: entering };
    if (!entering) {
      stadiumLightStore.deselect();
      stadiumLightStore.setGizmoDragging(false);
    }
    notify();
    if (releaseBall) {
      requestAnimationFrame(() => {
        if (!state.debugFreelook) return;
        state = {
          ...state,
          ballHolderId: null,
          isHoldingBall: false,
          ballState: 'loose',
        };
        notify();
      });
    }
  },
  toggleColliderDebug: () => {
    state = { ...state, showColliderDebug: !state.showColliderDebug };
    notify();
  },
  setShowGoalZoneDebug: (show: boolean) => {
    state = { ...state, showGoalZoneDebug: show };
    notify();
  },
  setShowPhysicsBall: (show: boolean) => {
    if (state.showPhysicsBall === show) return;
    state = { ...state, showPhysicsBall: show };
    notify();
  },
  toggleShowPhysicsBall: () => {
    state = { ...state, showPhysicsBall: !state.showPhysicsBall };
    notify();
  },
  setPlayerVisualProxy: (enabled: boolean) => {
    if (state.playerVisualProxy === enabled) return;
    state = { ...state, playerVisualProxy: enabled };
    notify();
  },
  togglePlayerVisualProxy: () => {
    state = { ...state, playerVisualProxy: !state.playerVisualProxy };
    notify();
  },
  bumpPlayerHatPop: () => {
    state = { ...state, playerHatPopSeq: state.playerHatPopSeq + 1 };
    notify();
  },
  setEnergy: (energy: number, flash = false) => {
    state = { ...state, energy, energyFlash: flash };
    notify();
  },
  setEnergyFlash: (flash: boolean) => {
    state = { ...state, energyFlash: flash };
    notify();
  },
  setTimeLeft: (t: number) => {
    state = { ...state, timeLeft: t };
    notify();
  },
  addScore: (team: Team, points: number, goalPos?: { x: number; y: number; z: number }) => {
    const nextStats = { ...state.matchStats };
    if (team === state.localTeam) {
      nextStats.goals += 1;
      nextStats.pointsScored += points;
    }
    state = {
      ...state,
      score: { ...state.score, [team]: state.score[team] + points },
      lastScorePopup: { points, team },
      goalCelebration: goalPos
        ? { id: ++celebrationId, ...goalPos, team }
        : state.goalCelebration,
      lastScoringTeam: team,
      ballCombo: 0,
      ballComboExpiresAt: 0,
      matchStats: nextStats,
    };
    notify();
  },
  /** After goal celebration — HUD 3-2-1 only; play continues */
  beginPostScoreKickoff: () => {
    state = {
      ...state,
      phase: 'playing',
      countdown: MATCH.resetCountdownSec,
      ballFrozen: true,
      ballHolderId: null,
      isHoldingBall: false,
    };
    notify();
  },
  /** Goal / manual kickoff — ball waits in drop until flaps release it */
  freezeBallForKickoff: () => {
    state = {
      ...state,
      ballFrozen: true,
      ballHolderId: null,
      isHoldingBall: false,
      ballState: 'loose',
    };
    notify();
  },
  clearScorePopup: () => {
    state = { ...state, lastScorePopup: null };
    notify();
  },
  setCountdown: (n: number) => {
    state = { ...state, countdown: n };
    notify();
  },
  setLoadCountdown: (n: number) => {
    state = { ...state, loadCountdown: n };
    notify();
  },
  setArenaSettleCountdown: (n: number) => {
    state = { ...state, arenaSettleCountdown: Math.max(0, n) };
    notify();
  },
  beginMapLoad: () => {
    if (state.phase !== 'intro') return;
    state = {
      ...state,
      phase: 'loading',
      loadCountdown: MATCH.mapLoadSec,
    };
    notify();
  },
  finishMapLoad: () => {
    armCombatGrace();
    state = {
      ...state,
      phase: 'playing',
      loadCountdown: 0,
      arenaSettleCountdown: MATCH.arenaSettleCountdownSec,
      countdown: 0,
      ballFrozen: true,
    };
    notify();
  },
  /** F key / manual drop — 3-2-1 then flap release */
  beginKickoffDrop: () => {
    state = {
      ...state,
      phase: 'playing',
      countdown: MATCH.resetCountdownSec,
      ballFrozen: true,
      ballHolderId: null,
      isHoldingBall: false,
      ballState: 'loose',
      lastScorePopup: null,
    };
    notify();
  },
  resumeAfterScore: () => {
    state = {
      ...state,
      ballFrozen: false,
      phase: 'playing',
      countdown: 0,
      lastScorePopup: null,
      ballHolderId: null,
      isHoldingBall: false,
    };
    notify();
  },
  /** After 3-2-1 — play continues but ball stays in drop until flaps open */
  resumeKickoffCountdown: () => {
    state = {
      ...state,
      phase: 'playing',
      countdown: 0,
      lastScorePopup: null,
      ballHolderId: null,
      isHoldingBall: false,
      ballFrozen: true,
    };
    notify();
  },
  releaseKickoffBall: () => {
    if (!state.ballFrozen) return;
    state = { ...state, ballFrozen: false };
    notify();
  },
  setBallState: (ballState: BallStateKind) => {
    if (state.ballState === ballState) return;
    state = { ...state, ballState };
    notify();
  },
  setIsHoldingBall: (v: boolean) => {
    state = {
      ...state,
      isHoldingBall: v,
      ballHolderId: v ? 'local' : state.ballHolderId === 'local' ? null : state.ballHolderId,
    };
    notify();
  },
  setBallHolder: (holder: BallHolderId) => {
    if (!state.botsEnabled && isBotHolderId(holder)) return;
    if (
      holder !== null &&
      state.ballHolderId !== null &&
      state.ballHolderId !== holder
    ) {
      return;
    }
    const clearCombo = holder === 'local';
    const newCapture = holder !== null && holder !== state.ballHolderId;
    state = {
      ...state,
      ballHolderId: holder,
      isHoldingBall: holder === 'local',
      ballState: holder ? 'held' : state.ballState === 'held' ? 'loose' : state.ballState,
      ...(clearCombo ? { ballCombo: 0, ballComboExpiresAt: 0 } : {}),
      ...(newCapture
        ? {
            holdImmunityUntilMs:
              performance.now() + holdImmunityDurationMs(),
          }
        : {}),
    };
    notify();
  },
  armHoldImmunity: () => {
    state = {
      ...state,
      holdImmunityUntilMs:
        performance.now() + holdImmunityDurationMs(),
    };
    notify();
  },
  setBallCombo: (combo: number, expiresAt: number) => {
    const maxCombo = Math.max(state.matchStats.maxCombo, combo);
    state = {
      ...state,
      ballCombo: combo,
      ballComboExpiresAt: expiresAt,
      matchStats: { ...state.matchStats, maxCombo },
    };
    notify();
  },
  clearBallCombo: () => {
    if (state.ballCombo === 0 && state.ballComboExpiresAt === 0) return;
    state = { ...state, ballCombo: 0, ballComboExpiresAt: 0 };
    notify();
  },
  tickBallComboExpiry: () => {
    if (state.ballCombo <= 0) return;
    if (performance.now() <= state.ballComboExpiresAt) return;
    state = { ...state, ballCombo: 0, ballComboExpiresAt: 0 };
    notify();
  },
  clearBallHolder: (force = false) => {
    if (state.ballHolderId === null) return;
    if (
      !force &&
      state.holdImmunityUntilMs > performance.now() &&
      state.ballHolderId !== null
    ) {
      return;
    }
    state = {
      ...state,
      ballHolderId: null,
      isHoldingBall: false,
      ballState: state.ballState === 'held' ? 'loose' : state.ballState,
    };
    notify();
  },
  /** Single notify when rocket knocks ball loose */
  setBallLooseAfterHit: () => {
    if (state.ballHolderId === null && state.ballState === 'loose') return;
    if (
      state.holdImmunityUntilMs > performance.now() &&
      state.ballHolderId !== null
    ) {
      return;
    }
    state = {
      ...state,
      isHoldingBall: false,
      ballHolderId: null,
      ballState: 'loose',
    };
    notify();
  },
  setIsBeaming: (v: boolean) => {
    state = { ...state, isBeaming: v };
    notify();
  },
  setIsSprinting: (v: boolean) => {
    state = { ...state, isSprinting: v };
    notify();
  },
  setSpeeds: (playerSpeed: number, ballSpeed: number) => {
    const p = Math.round(playerSpeed * 10) / 10;
    const b = Math.round(ballSpeed * 10) / 10;
    if (state.playerSpeed === p && state.ballSpeed === b) return;
    state = { ...state, playerSpeed: p, ballSpeed: b };
    notify();
  },
  postAnnouncement: (message: string, durationSec = 3.2) => {
    state = {
      ...state,
      announcement: {
        message,
        expiresAt: performance.now() + durationSec * 1000,
      },
    };
    notify();
  },
  clearExpiredAnnouncement: () => {
    const a = state.announcement;
    if (!a || performance.now() < a.expiresAt) return;
    state = { ...state, announcement: null };
    notify();
  },
  setBotEnergies: (energies: Partial<Record<BotId, number>>) => {
    const next = { ...state.botEnergies, ...energies };
    const ids = ['bot-0', 'bot-1', 'bot-2'] as const;
    let changed = false;
    for (const id of ids) {
      const v = Math.round(next[id] ?? 0);
      next[id] = v;
      if (state.botEnergies[id] !== v) changed = true;
    }
    if (!changed) return;
    state = { ...state, botEnergies: next };
    notify();
  },
  recordMidAirHit: () => {
    state = {
      ...state,
      matchStats: {
        ...state.matchStats,
        midAirHits: state.matchStats.midAirHits + 1,
      },
    };
    notify();
  },
  recordKill: () => {
    state = {
      ...state,
      matchStats: {
        ...state.matchStats,
        kills: state.matchStats.kills + 1,
      },
    };
    notify();
  },
  recordRocketHit: () => {
    state = {
      ...state,
      matchStats: {
        ...state.matchStats,
        rocketHits: state.matchStats.rocketHits + 1,
      },
    };
    notify();
  },
};

export function goalPoints(size: GoalSize): number {
  const map = { large: 1, medium: 3, small: 5 } as const;
  return map[size];
}
