import { MOVEMENT, ROCKET } from '../shared/Constants';

const SPRINT_RATIO = MOVEMENT.sprintSpeed / MOVEMENT.walkSpeed;
const DOUBLE_JUMP_RATIO = MOVEMENT.doubleJumpForce / MOVEMENT.jumpForce;

export type TuningValues = {
  jumpForce: number;
  walkSpeed: number;
  sprintSpeed: number;
  rocketSpeed: number;
  gravity: number;
  /** Scales rocket explosion knockback on the ball (1 = default constants) */
  ballKnockStrength: number;
  /** Scales averaged player velocity samples while holding (legacy “carry”) */
  carryMomentumToShot: number;
  /** Scales base aim launch force (× BALL.launchForce) */
  baseLaunchForce: number;
  /** Ball swing velocity added to directed shot */
  swingToShot: number;
  /** Live player horizontal speed added to directed shot */
  moveSpeedToShot: number;
  /** Vertical boost on directed shot */
  launchUpBoost: number;
  /** RMB: horizontal swing speed before release uses shot-like momentum */
  releaseSwingMinSpeed: number;
  /** RMB active swing: scale on swing/carry/move (same coeffs as shot) */
  releaseMomentumScale: number;
  /** RMB gentle drop: fraction of ball swing velocity kept */
  releaseIdleSwingScale: number;
  /** RMB gentle drop: fraction of player velocity kept */
  releaseIdlePlayerScale: number;
  /** RMB gentle drop: max speed when barely moving */
  releaseIdleMaxSpeed: number;
  /** RMB active swing release — max exit speed */
  releaseMaxActiveSpeed: number;
  /** Scales magnetic beam pull (player + bots) */
  pullStrength: number;
  /** Master SFX volume (0–1) */
  masterVolume: number;
  /** Rocket fire / explosion volume multiplier (0–1) */
  impactVolume: number;
};

type TuningState = TuningValues & {
  showMenu: boolean;
};

const defaults: TuningValues = {
  jumpForce: MOVEMENT.jumpForce,
  walkSpeed: MOVEMENT.walkSpeed,
  sprintSpeed: MOVEMENT.sprintSpeed,
  rocketSpeed: ROCKET.speed,
  gravity: MOVEMENT.gravity,
  ballKnockStrength: 1,
  carryMomentumToShot: 1,
  baseLaunchForce: 0.82,
  swingToShot: 1.05,
  moveSpeedToShot: 0.75,
  launchUpBoost: 3.5,
  releaseSwingMinSpeed: 2.2,
  releaseMomentumScale: 0.9,
  releaseIdleSwingScale: 0.14,
  releaseIdlePlayerScale: 0.06,
  releaseIdleMaxSpeed: 2.5,
  releaseMaxActiveSpeed: 58,
  pullStrength: 0.72,
  masterVolume: 0.85,
  impactVolume: 0.45,
};

const listeners = new Set<() => void>();

let state: TuningState = {
  ...defaults,
  showMenu: false,
};

function notify() {
  listeners.forEach((l) => l());
}

export const tuningStore = {
  getState: () => state,
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  toggleMenu: () => {
    state = { ...state, showMenu: !state.showMenu };
    if (state.showMenu) document.exitPointerLock();
    notify();
  },
  setJumpForce: (v: number) => {
    state = { ...state, jumpForce: v };
    notify();
  },
  setWalkSpeed: (v: number) => {
    state = {
      ...state,
      walkSpeed: v,
      sprintSpeed: v * SPRINT_RATIO,
    };
    notify();
  },
  setRocketSpeed: (v: number) => {
    state = { ...state, rocketSpeed: v };
    notify();
  },
  setGravity: (v: number) => {
    state = { ...state, gravity: v };
    notify();
  },
  setBallKnockStrength: (v: number) => {
    state = { ...state, ballKnockStrength: v };
    notify();
  },
  setCarryMomentumToShot: (v: number) => {
    state = { ...state, carryMomentumToShot: v };
    notify();
  },
  setBaseLaunchForce: (v: number) => {
    state = { ...state, baseLaunchForce: v };
    notify();
  },
  setSwingToShot: (v: number) => {
    state = { ...state, swingToShot: v };
    notify();
  },
  setMoveSpeedToShot: (v: number) => {
    state = { ...state, moveSpeedToShot: v };
    notify();
  },
  setLaunchUpBoost: (v: number) => {
    state = { ...state, launchUpBoost: v };
    notify();
  },
  setReleaseSwingMinSpeed: (v: number) => {
    state = { ...state, releaseSwingMinSpeed: v };
    notify();
  },
  setReleaseMomentumScale: (v: number) => {
    state = { ...state, releaseMomentumScale: v };
    notify();
  },
  setReleaseIdleSwingScale: (v: number) => {
    state = { ...state, releaseIdleSwingScale: v };
    notify();
  },
  setReleaseIdlePlayerScale: (v: number) => {
    state = { ...state, releaseIdlePlayerScale: v };
    notify();
  },
  setReleaseIdleMaxSpeed: (v: number) => {
    state = { ...state, releaseIdleMaxSpeed: v };
    notify();
  },
  setReleaseMaxActiveSpeed: (v: number) => {
    state = { ...state, releaseMaxActiveSpeed: v };
    notify();
  },
  setPullStrength: (v: number) => {
    state = { ...state, pullStrength: v };
    notify();
  },
  setMasterVolume: (v: number) => {
    state = { ...state, masterVolume: v };
    notify();
  },
  setImpactVolume: (v: number) => {
    state = { ...state, impactVolume: v };
    notify();
  },
  resetDefaults: () => {
    state = { ...state, ...defaults, sprintSpeed: defaults.sprintSpeed };
    notify();
  },
  getDoubleJumpForce: () => state.jumpForce * DOUBLE_JUMP_RATIO,
};
