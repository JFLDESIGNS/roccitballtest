import { BOT, MOVEMENT, ROCKET } from '../shared/Constants';

const SPRINT_RATIO = MOVEMENT.sprintSpeed / MOVEMENT.walkSpeed;
const STORAGE_KEY = 'rocketball-tuning-v4';

export type TuningValues = {
  jumpForce: number;
  walkSpeed: number;
  sprintSpeed: number;
  rocketSpeed: number;
  gravity: number;
  ballKnockStrength: number;
  carryMomentumToShot: number;
  baseLaunchForce: number;
  swingToShot: number;
  moveSpeedToShot: number;
  releaseSwingMinSpeed: number;
  releaseMomentumScale: number;
  releaseIdleSwingScale: number;
  releaseIdlePlayerScale: number;
  releaseIdleMaxSpeed: number;
  releaseMaxActiveSpeed: number;
  pullStrength: number;
  masterVolume: number;
  impactVolume: number;
  /** Ball shot + rocket fire sample loudness (0–1, × internal base) */
  shotVolume: number;
  /** Bot hit reward ching (0–1, × internal base) */
  chingVolume: number;
  /** Goal scored goal1.WAV sting (0–1, × internal base) */
  goal1Volume: number;
  botPressure: number;
  /** Hold LMB bouncer rockets (off = tap/hold only explosive) */
  bouncyRocketsEnabled: boolean;
  /** Trampoline launch multiplier (1 = ~20 ft apex) */
  trampolineStrength: number;
  botBeamPullScale: number;
  botAllyBeamScale: number;
  botEnemyBeamScale: number;
  botRocketAimErrorM: number;
  botBallLaunchAimErrorM: number;
  botWalkSpeedScale: number;
  botLaunchForceScale: number;
  botFollowRocketChance: number;
  botEnemyVolleyChance: number;
  /** Enemy bots shoot at local player while they hold the ball (0–1, per-bot rolls) */
  botPlayerCarrierShotChance: number;
  /** Multiplier on CAMERA.mouseSensitivityX/Y */
  mouseSensitivity: number;
};

type TuningState = TuningValues & {
  showMenu: boolean;
  menuTab: TuningTabId;
};

export type TuningTabId =
  | 'player'
  | 'rockets'
  | 'ball'
  | 'bots'
  | 'arena'
  | 'graphics'
  | 'audio';

export const TUNING_TABS: { id: TuningTabId; label: string }[] = [
  { id: 'player', label: 'Player' },
  { id: 'rockets', label: 'Rockets' },
  { id: 'ball', label: 'Ball & beam' },
  { id: 'bots', label: 'Bots' },
  { id: 'arena', label: 'Arena' },
  { id: 'graphics', label: 'Graphics' },
  { id: 'audio', label: 'Audio' },
];

const defaults: TuningValues = {
  jumpForce: MOVEMENT.jumpForce,
  walkSpeed: MOVEMENT.walkSpeed,
  sprintSpeed: MOVEMENT.sprintSpeed,
  rocketSpeed: ROCKET.speed,
  gravity: MOVEMENT.gravity,
  ballKnockStrength: 2.5,
  carryMomentumToShot: 1,
  baseLaunchForce: 0.82,
  swingToShot: 1.05,
  moveSpeedToShot: 0.75,
  releaseSwingMinSpeed: 2.2,
  releaseMomentumScale: 0.9,
  releaseIdleSwingScale: 0.14,
  releaseIdlePlayerScale: 0.06,
  releaseIdleMaxSpeed: 2.5,
  releaseMaxActiveSpeed: 58,
  pullStrength: 0.864,
  masterVolume: 0.85,
  impactVolume: 0.45,
  shotVolume: 0.33,
  chingVolume: 0.4,
  goal1Volume: 0.55,
  botPressure: 0.25,
  bouncyRocketsEnabled: false,
  trampolineStrength: 3.5,
  botBeamPullScale: BOT.beamPullScale,
  botAllyBeamScale: BOT.allyBeamPullScale,
  botEnemyBeamScale: BOT.enemyBeamPullScale,
  botRocketAimErrorM: BOT.rocketAimErrorM,
  botBallLaunchAimErrorM: BOT.ballLaunchAimErrorM,
  botWalkSpeedScale: 1,
  botLaunchForceScale: 1,
  botFollowRocketChance: BOT.followPlayerRocketChance,
  botEnemyVolleyChance: BOT.enemyRocketVolleyChance,
  botPlayerCarrierShotChance: BOT.enemyPlayerCarrierShotChance,
  /** Multiplier on CAMERA.mouseSensitivityX/Y */
  mouseSensitivity: 1,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function valuesFromState(s: TuningState): TuningValues {
  const { showMenu: _s, menuTab: _t, ...v } = s;
  return v;
}

function loadStored(): Partial<TuningValues> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<TuningValues>;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function persistValues(v: TuningValues) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

function mergeStored(base: TuningValues): TuningValues {
  const stored = loadStored();
  return { ...base, ...stored };
}

let state: TuningState = {
  ...mergeStored(defaults),
  showMenu: false,
  menuTab: 'player',
};

function patch(partial: Partial<TuningValues>) {
  state = { ...state, ...partial };
  persistValues(valuesFromState(state));
  notify();
}

export const tuningStore = {
  getState: () => state,
  getDefaults: () => ({ ...defaults }),
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  toggleMenu: () => {
    const opening = !state.showMenu;
    state = { ...state, showMenu: opening };
    if (opening) {
      document.exitPointerLock();
    } else {
      void import('./InputManager').then(({ inputManager }) =>
        inputManager.onGameplayResume(),
      );
    }
    notify();
  },
  setMenuTab: (tab: TuningTabId) => {
    state = { ...state, menuTab: tab };
    notify();
  },
  setJumpForce: (v: number) => patch({ jumpForce: v }),
  setWalkSpeed: (v: number) =>
    patch({ walkSpeed: v, sprintSpeed: v * SPRINT_RATIO }),
  setRocketSpeed: (v: number) => patch({ rocketSpeed: v }),
  setGravity: (v: number) => patch({ gravity: v }),
  setBallKnockStrength: (v: number) => patch({ ballKnockStrength: v }),
  setCarryMomentumToShot: (v: number) => patch({ carryMomentumToShot: v }),
  setBaseLaunchForce: (v: number) => patch({ baseLaunchForce: v }),
  setSwingToShot: (v: number) => patch({ swingToShot: v }),
  setMoveSpeedToShot: (v: number) => patch({ moveSpeedToShot: v }),
  setReleaseSwingMinSpeed: (v: number) => patch({ releaseSwingMinSpeed: v }),
  setReleaseMomentumScale: (v: number) => patch({ releaseMomentumScale: v }),
  setReleaseIdleSwingScale: (v: number) => patch({ releaseIdleSwingScale: v }),
  setReleaseIdlePlayerScale: (v: number) => patch({ releaseIdlePlayerScale: v }),
  setReleaseIdleMaxSpeed: (v: number) => patch({ releaseIdleMaxSpeed: v }),
  setReleaseMaxActiveSpeed: (v: number) => patch({ releaseMaxActiveSpeed: v }),
  setPullStrength: (v: number) => patch({ pullStrength: v }),
  setMasterVolume: (v: number) => patch({ masterVolume: v }),
  setImpactVolume: (v: number) => patch({ impactVolume: v }),
  setShotVolume: (v: number) => patch({ shotVolume: v }),
  setChingVolume: (v: number) => patch({ chingVolume: v }),
  setGoal1Volume: (v: number) => patch({ goal1Volume: v }),
  setBotPressure: (v: number) =>
    patch({ botPressure: Math.max(0.25, Math.min(2, v)) }),
  setBouncyRocketsEnabled: (v: boolean) => patch({ bouncyRocketsEnabled: v }),
  setTrampolineStrength: (v: number) => patch({ trampolineStrength: v }),
  setBotBeamPullScale: (v: number) => patch({ botBeamPullScale: v }),
  setBotAllyBeamScale: (v: number) => patch({ botAllyBeamScale: v }),
  setBotEnemyBeamScale: (v: number) => patch({ botEnemyBeamScale: v }),
  setBotRocketAimErrorM: (v: number) => patch({ botRocketAimErrorM: v }),
  setBotBallLaunchAimErrorM: (v: number) => patch({ botBallLaunchAimErrorM: v }),
  setBotWalkSpeedScale: (v: number) => patch({ botWalkSpeedScale: v }),
  setBotLaunchForceScale: (v: number) => patch({ botLaunchForceScale: v }),
  setBotFollowRocketChance: (v: number) => patch({ botFollowRocketChance: v }),
  setBotEnemyVolleyChance: (v: number) => patch({ botEnemyVolleyChance: v }),
  setBotPlayerCarrierShotChance: (v: number) =>
    patch({ botPlayerCarrierShotChance: Math.max(0.05, Math.min(0.95, v)) }),
  setMouseSensitivity: (v: number) =>
    patch({ mouseSensitivity: Math.max(0.2, Math.min(2.5, v)) }),
  resetDefaults: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    state = {
      ...defaults,
      showMenu: state.showMenu,
      menuTab: state.menuTab,
    };
    notify();
  },
  getDoubleJumpForce: () => state.jumpForce * (MOVEMENT.doubleJumpForce / MOVEMENT.jumpForce),
  getTripleJumpForce: () => state.jumpForce * (MOVEMENT.tripleJumpForce / MOVEMENT.jumpForce),
  getJumpImpulse: (jumpIndex: number) => {
    if (jumpIndex <= 0) return state.jumpForce;
    if (jumpIndex === 1) return state.jumpForce * (MOVEMENT.doubleJumpForce / MOVEMENT.jumpForce);
    return state.jumpForce * (MOVEMENT.tripleJumpForce / MOVEMENT.jumpForce);
  },
};
