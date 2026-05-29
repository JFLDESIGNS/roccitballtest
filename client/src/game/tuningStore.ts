import { BALL, BOT, MOVEMENT, ROCKET, type BallTypeId, type ReleaseSystemId } from '../shared/Constants';
import { integrateFallGravity } from './movementGravity';
import { inputManager } from './InputManager';

const SPRINT_RATIO = MOVEMENT.sprintSpeed / MOVEMENT.walkSpeed;
const STORAGE_KEY = 'rocketball-tuning-v24';
export type TuningValues = {
  jumpForce: number;
  walkSpeed: number;
  sprintSpeed: number;
  rocketSpeed: number;
  gravity: number;
  /** Extra pull when vy ≤ 0 (1 = default; 2 = fall twice as fast) */
  fallGravityMult: number;
  ballKnockStrength: number;
  carryMomentumToShot: number;
  baseLaunchForce: number;
  /** Vertical lift adjustment (m/s) added to player LMB shot — negative pulls down */
  shortArc: number;
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
  /** Fan glass cheer / away panic (0–1 multiplier on crowd SFX) */
  fanGlassCrowdVolume: number;
  botPressure: number;
  /** Hold LMB bouncer rockets (off = tap/hold only explosive) */
  bouncyRocketsEnabled: boolean;
  /** Trampoline launch multiplier (1 = ~20 ft apex) */
  trampolineStrength: number;
  botBeamPullScale: number;
  /** Seconds bots must beam-pull before capturing the ball */
  botBeamCaptureLatchSec: number;
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
  /** Double-tap W forward dash */
  wwDashEnabled: boolean;
  /** Double-tap S / Down input interval for air ground-smash */
  groundSmashDoubleTapWindowSec: number;
  /** Match ball variant — same entity for beam, bots, and goals */
  ballType: BallTypeId;
  /** Classic momentum release vs Torque-style super release */
  releaseSystem: ReleaseSystemId;
  /** Super release — inherit player velocity on throw (0–1) */
  superReleaseInheritedVel: number;
  /** Super release — aim-direction throw speed (m/s) */
  superReleaseThrowPower: number;
  /** Super release — multiplier on LMB shot power */
  superReleaseShotStrength: number;
  /** Super release — extra upward lift on LMB (m/s) */
  superReleaseArcLift: number;
  /** Super release — hold/spawn forward offset from body (m) */
  superReleaseForwardOffset: number;
  /** Super release — hold/spawn height above body origin (m) */
  superReleaseUpOffset: number;
  /** Super release — skip thrower separation / overlap push (sec) */
  superReleaseThrowerGraceSec: number;
  /** After grabbing the ball — rockets can't knock it loose from holder or ball */
  holdConnectImmunitySec: number;
  /** Carry proxy — extra reach beyond hold socket (m) */
  holdVisualExtraReachM: number;
  /** Carry proxy follow rate — higher = less lag */
  holdVisualLagSmooth: number;
  /** Loose proxy — filter raw physics position (reduces jitter) */
  looseVisualTargetSmooth: number;
  /** Loose proxy display follow — higher = snappier */
  looseVisualPosSmooth: number;
  /** Loose proxy spin follow — higher = snappier */
  looseVisualRotSmooth: number;
  /** Max meters display may trail filtered target before extra catch-up */
  looseVisualMaxLagM: number;
  /** Extra follow strength multiplier cap at high ball speed */
  looseVisualSpeedBoostMax: number;
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
  | 'brightness'
  | 'graphics'
  | 'audio';

export const TUNING_TABS: { id: TuningTabId; label: string }[] = [
  { id: 'player', label: 'Player' },
  { id: 'rockets', label: 'Rockets' },
  { id: 'ball', label: 'Ball & beam' },
  { id: 'bots', label: 'Bots' },
  { id: 'arena', label: 'Arena' },
  { id: 'brightness', label: 'Brightness' },
  { id: 'graphics', label: 'Graphics' },
  { id: 'audio', label: 'Audio' },
];

const defaults: TuningValues = {
  jumpForce: MOVEMENT.jumpForce,
  walkSpeed: MOVEMENT.walkSpeed,
  sprintSpeed: MOVEMENT.sprintSpeed,
  rocketSpeed: ROCKET.speed,
  gravity: MOVEMENT.gravity,
  fallGravityMult: 2,
  ballKnockStrength: 1,
  carryMomentumToShot: 1.05,
  baseLaunchForce: 0.6,
  shortArc: 0.5,
  swingToShot: 1,
  moveSpeedToShot: 0.15,
  releaseSwingMinSpeed: 0.3,
  releaseMomentumScale: 0.85,
  releaseIdleSwingScale: 0.26,
  releaseIdlePlayerScale: 0.16,
  releaseIdleMaxSpeed: 3.8,
  releaseMaxActiveSpeed: 30,
  pullStrength: 1.35,
  masterVolume: 0.85,
  impactVolume: 0.45,
  shotVolume: 0.33,
  chingVolume: 0.4,
  goal1Volume: 0.55,
  fanGlassCrowdVolume: 0.65,
  botPressure: 0.25,
  bouncyRocketsEnabled: false,
  trampolineStrength: 3.5,
  botBeamPullScale: BOT.beamPullScale,
  botBeamCaptureLatchSec: BOT.beamCaptureLatchSec,
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
  wwDashEnabled: false,
  groundSmashDoubleTapWindowSec: MOVEMENT.groundSmashDoubleTapWindowSec,
  ballType: 'superball',
  releaseSystem: 'superrelease',
  superReleaseInheritedVel: 0.75,
  superReleaseThrowPower: 24,
  superReleaseShotStrength: 1,
  superReleaseArcLift: 3,
  superReleaseForwardOffset: 1.5,
  superReleaseUpOffset: 1.2,
  superReleaseThrowerGraceSec: 0.15,
  holdConnectImmunitySec: BALL.holdConnectImmunitySec,
  holdVisualExtraReachM: BALL.holdVisualExtraReachM,
  holdVisualLagSmooth: BALL.holdVisualLagSmooth,
  looseVisualTargetSmooth: BALL.looseVisualTargetSmooth,
  looseVisualPosSmooth: BALL.looseVisualPosSmooth,
  looseVisualRotSmooth: BALL.looseVisualRotSmooth,
  looseVisualMaxLagM: BALL.looseVisualMaxLagM,
  looseVisualSpeedBoostMax: 4,
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
  const merged = { ...base, ...stored };
  if (merged.ballType !== 'original' && merged.ballType !== 'superball') {
    merged.ballType = 'original';
  }
  if (merged.releaseSystem !== 'classic' && merged.releaseSystem !== 'superrelease') {
    merged.releaseSystem = 'superrelease';
  }
  return merged;
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
    state = {
      ...state,
      showMenu: opening,
      menuTab: opening ? 'brightness' : state.menuTab,
    };
    if (opening) {
      document.exitPointerLock();
    } else {
      inputManager.onGameplayResume();
      inputManager.refreshPointerLockState();
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
  setFallGravityMult: (v: number) =>
    patch({ fallGravityMult: Math.max(1, Math.min(4, v)) }),
  /** Player / bot vertical integration — ascent uses gravity only, descent uses × fallGravityMult */
  integrateGravity: (vy: number, dt: number) => {
    const { gravity, fallGravityMult } = state;
    return integrateFallGravity(vy, gravity, dt, fallGravityMult);
  },
  setBallKnockStrength: (v: number) => patch({ ballKnockStrength: v }),
  setCarryMomentumToShot: (v: number) => patch({ carryMomentumToShot: v }),
  setBaseLaunchForce: (v: number) => patch({ baseLaunchForce: v }),
  setShortArc: (v: number) => patch({ shortArc: Math.max(-18, Math.min(18, v)) }),
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
  setFanGlassCrowdVolume: (v: number) =>
    patch({ fanGlassCrowdVolume: Math.max(0, Math.min(1.5, v)) }),
  setBotPressure: (v: number) =>
    patch({ botPressure: Math.max(0.25, Math.min(2, v)) }),
  setBouncyRocketsEnabled: (v: boolean) => patch({ bouncyRocketsEnabled: v }),
  setTrampolineStrength: (v: number) => patch({ trampolineStrength: v }),
  setBotBeamPullScale: (v: number) => patch({ botBeamPullScale: v }),
  setBotBeamCaptureLatchSec: (v: number) =>
    patch({ botBeamCaptureLatchSec: Math.max(0.1, Math.min(3, v)) }),
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
  setWwDashEnabled: (v: boolean) => patch({ wwDashEnabled: v }),
  setGroundSmashDoubleTapWindowSec: (v: number) =>
    patch({ groundSmashDoubleTapWindowSec: Math.max(0.12, Math.min(0.6, v)) }),
  setBallType: (v: BallTypeId) => patch({ ballType: v }),
  setReleaseSystem: (v: ReleaseSystemId) => patch({ releaseSystem: v }),
  setSuperReleaseInheritedVel: (v: number) =>
    patch({ superReleaseInheritedVel: Math.max(0, Math.min(1.2, v)) }),
  setSuperReleaseThrowPower: (v: number) =>
    patch({ superReleaseThrowPower: Math.max(6, Math.min(48, v)) }),
  setSuperReleaseShotStrength: (v: number) =>
    patch({ superReleaseShotStrength: Math.max(0.25, Math.min(2.5, v)) }),
  setSuperReleaseArcLift: (v: number) =>
    patch({ superReleaseArcLift: Math.max(-6, Math.min(12, v)) }),
  setSuperReleaseForwardOffset: (v: number) =>
    patch({ superReleaseForwardOffset: Math.max(0.5, Math.min(4, v)) }),
  setSuperReleaseUpOffset: (v: number) =>
    patch({ superReleaseUpOffset: Math.max(0.4, Math.min(2.5, v)) }),
  setSuperReleaseThrowerGraceSec: (v: number) =>
    patch({ superReleaseThrowerGraceSec: Math.max(0.05, Math.min(0.6, v)) }),
  setHoldConnectImmunitySec: (v: number) =>
    patch({ holdConnectImmunitySec: Math.max(0, Math.min(3, v)) }),
  setHoldVisualExtraReachM: (v: number) =>
    patch({ holdVisualExtraReachM: Math.max(0, Math.min(2.5, v)) }),
  setHoldVisualLagSmooth: (v: number) =>
    patch({ holdVisualLagSmooth: Math.max(4, Math.min(60, v)) }),
  setLooseVisualTargetSmooth: (v: number) =>
    patch({ looseVisualTargetSmooth: Math.max(4, Math.min(120, v)) }),
  setLooseVisualPosSmooth: (v: number) =>
    patch({ looseVisualPosSmooth: Math.max(4, Math.min(120, v)) }),
  setLooseVisualRotSmooth: (v: number) =>
    patch({ looseVisualRotSmooth: Math.max(8, Math.min(160, v)) }),
  setLooseVisualMaxLagM: (v: number) =>
    patch({ looseVisualMaxLagM: Math.max(0.05, Math.min(2, v)) }),
  setLooseVisualSpeedBoostMax: (v: number) =>
    patch({ looseVisualSpeedBoostMax: Math.max(0, Math.min(32, v)) }),
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
