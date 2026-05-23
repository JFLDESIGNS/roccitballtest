import { MATCH } from '../shared/Constants';
import { clearBotTeamRelease } from './botTeamRelease';
import type { BallStateKind, GoalSize, MatchScore, Team } from '../shared/Types';

export type BotId = 'bot-0' | 'bot-1' | 'bot-2';

export type GamePhase = 'menu' | 'playing' | 'paused' | 'countdown';

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
};

const listeners = new Set<() => void>();

const BOTS_ENABLED_KEY = 'rocketball-bots-enabled';

function loadBotsEnabled(): boolean {
  try {
    return localStorage.getItem(BOTS_ENABLED_KEY) !== 'false';
  } catch {
    return true;
  }
}

let celebrationId = 0;

let state: GameStoreState = {
  phase: 'menu',
  score: { red: 0, blue: 0 },
  timeLeft: MATCH.durationSec,
  energy: 100,
  energyFlash: false,
  lastScorePopup: null,
  countdown: 0,
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
    state = {
      ...state,
      phase: 'countdown',
      score: { red: 0, blue: 0 },
      timeLeft: MATCH.durationSec,
      energy: 100,
      lastScorePopup: null,
      countdown: MATCH.startCountdownSec,
      ballFrozen: true,
      ballHolderId: null,
      isHoldingBall: false,
      ballState: 'loose',
      botEnergies: { 'bot-0': 100, 'bot-1': 100, 'bot-2': 100 },
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
    state = {
      ...state,
      score: { ...state.score, [team]: state.score[team] + points },
      lastScorePopup: { points, team },
      ballFrozen: true,
      phase: 'countdown',
      countdown: MATCH.resetCountdownSec,
      goalCelebration: goalPos
        ? { id: ++celebrationId, ...goalPos, team }
        : state.goalCelebration,
      lastScoringTeam: team,
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
    state = {
      ...state,
      ballHolderId: holder,
      isHoldingBall: holder === 'local',
      ballState: holder ? 'held' : state.ballState === 'held' ? 'loose' : state.ballState,
    };
    notify();
  },
  clearBallHolder: () => {
    if (state.ballHolderId === null) return;
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
};

export function goalPoints(size: GoalSize): number {
  const map = { large: 1, medium: 3, small: 5 } as const;
  return map[size];
}
