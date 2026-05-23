import * as THREE from 'three';
import { ARENA, BALL, BOT } from '../shared/Constants';
import type { BallHolderId, BotId } from './gameStore';
import { isInsideShootZone } from './botShootZone';
import type { Team } from '../shared/Types';

export type BotRole = 'ball' | 'pressure';

export type BotFieldMode =
  | 'runToBall'
  | 'attractBall'
  | 'runToPlayer'
  | 'moveAndShoot'
  | 'allySupport'
  | 'allyReceive';

export type BotFarHoldAction = 'pass' | 'carry' | 'looseShoot';
export type HoldReleaseKind = 'pass' | 'shoot' | 'loft';

/** Where to dribble during the opening hold window */
export type BotHoldCarryFocus = 'goal' | 'teammate';

/** Rolled once after holdCarryMinSec (unless shoot zone overrides) */
export type BotHoldReleasePlan = 'shoot' | 'carry' | 'pass';
export type CarryLookFocus = 'goal' | 'teammate' | 'opponent';

export type CarryLookState = {
  focus: CarryLookFocus;
  focusHoldLeft: number;
  smoothed: THREE.Vector3;
  initialized: boolean;
  preferTeammateLook: boolean;
};

export type BotHoldMode = 'carryToGoal' | 'setupShot' | 'shootGoal';

export type BotMode = BotFieldMode | BotHoldMode;

export type BotHoldPhase = 'advance' | 'setup' | 'shoot';

export function botRole(id: BotId): BotRole {
  if (id === 'bot-2') return 'ball';
  return id === 'bot-0' ? 'ball' : 'pressure';
}

export function ballEngageDistance(): number {
  return BALL.radius * BOT.ballChaseBallRadii;
}

export function ballAttractDistance(): number {
  return BALL.radius * BOT.ballAttractBallRadii;
}

export type BotThinkInput = {
  id: BotId;
  role: BotRole;
  team: Team;
  localTeam: Team;
  isEnemy: boolean;
  pos: THREE.Vector3;
  ballPos: THREE.Vector3;
  playerChest: THREE.Vector3;
  goal: THREE.Vector3;
  otherBotPos: THREE.Vector3 | null;
  ballHolder: BallHolderId;
  ballVel: THREE.Vector3;
  ballState: string;
  holdingBall: boolean;
  holdSec: number;
  holdPhase: BotHoldPhase;
  grounded: boolean;
  inBeamRange: boolean;
  beamDenied: boolean;
  /** Teammate shooting in-zone — stay off ball unless magnet roll won */
  giveShootZoneSpace?: boolean;
  /** Teammate's last pass or shot at goal */
  teammateReleaseKind?: 'pass' | 'shot' | null;
  /** True while waiting out a teammate's goal shot */
  waitForTeammateShot?: boolean;
};

const _flank = new THREE.Vector3();

export function pickBotMode(input: BotThinkInput): BotMode {
  if (input.holdingBall) {
    return pickHoldMode(input);
  }
  return pickFieldMode(input);
}

export function isPlayerChaseMode(mode: BotMode): boolean {
  return mode === 'runToPlayer' || mode === 'moveAndShoot';
}

/** Ball-focused mode when player-chase burst or cooldown is active */
export function pickFieldModeFallback(input: BotThinkInput): BotFieldMode {
  const distBall = input.pos.distanceTo(input.ballPos);
  const attract = ballAttractDistance();
  if (
    distBall <= attract &&
    input.inBeamRange &&
    !input.beamDenied
  ) {
    return 'attractBall';
  }
  return 'runToBall';
}

export type PlayerChaseState = {
  burstSecLeft: number;
  cooldownSecLeft: number;
};

/**
 * Limits runToPlayer / moveAndShoot to ~5s bursts with a 20s cooldown.
 * While the local player holds the ball, chase is always allowed.
 */
export function gatePlayerChaseMode(
  mode: BotMode,
  ballHolder: BallHolderId,
  input: BotThinkInput,
  state: PlayerChaseState,
  dt: number,
): BotMode {
  if (!isPlayerChaseMode(mode)) return mode;

  if (ballHolder === 'local') {
    state.cooldownSecLeft = 0;
    state.burstSecLeft = BOT.followPlayerBurstSec;
    return mode;
  }

  state.cooldownSecLeft = Math.max(0, state.cooldownSecLeft - dt);

  if (state.cooldownSecLeft > 0) {
    return pickFieldModeFallback(input);
  }

  if (state.burstSecLeft <= 0) {
    state.burstSecLeft = BOT.followPlayerBurstSec;
  }
  state.burstSecLeft -= dt;
  if (state.burstSecLeft <= 0) {
    state.cooldownSecLeft = BOT.followPlayerCooldownSec;
    return pickFieldModeFallback(input);
  }

  return mode;
}

function pickHoldMode(input: BotThinkInput): BotHoldMode {
  if (input.holdPhase === 'shoot') return 'shootGoal';
  if (input.holdPhase === 'setup') return 'setupShot';
  return 'carryToGoal';
}

function preferMoveAndShoot(input: BotThinkInput, distBall: number): boolean {
  const engage = ballEngageDistance();
  const attract = ballAttractDistance();
  const distPlayer = input.pos.distanceTo(input.playerChest);

  if (distBall > engage) return true;
  if (input.role === 'pressure' && distBall > attract) return true;
  if (
    input.role === 'pressure' &&
    distPlayer < BOT.moveShootPlayerDist &&
    distBall > distPlayer * 0.45
  ) {
    return true;
  }
  const stagger = input.id === 'bot-0' ? 0.38 : 0.68;
  if (distBall > attract * 1.25 && stagger < BOT.moveShootBias) return true;
  return false;
}

function isFriendlyBallHolder(
  holder: BallHolderId,
  botTeam: Team,
  localTeam: Team,
): boolean {
  if (holder === null) return false;
  if (holder === 'local') return botTeam === localTeam;
  if (holder === 'bot-2') return botTeam === localTeam;
  if (holder === 'bot-0' || holder === 'bot-1') {
    return botTeam !== localTeam;
  }
  return false;
}

function isNonTeammateBallHolder(
  holder: BallHolderId,
  selfId: BotId,
  botTeam: Team,
  localTeam: Team,
): boolean {
  if (!holder || holder === selfId) return false;
  return !isFriendlyBallHolder(holder, botTeam, localTeam);
}

export type AllyShootZoneMagnetState = {
  magnetAllowed: boolean | null;
  shooterId: BotId | null;
};

export type BotZonePosition = {
  id: BotId;
  team: Team;
  x: number;
  z: number;
};

/** True when a teammate is set up to shoot inside the offensive cylinder. */
export function findTeammateShooterInZone(
  selfId: BotId,
  team: Team,
  localTeam: Team,
  holder: BallHolderId,
  positions: BotZonePosition[],
  ballX: number,
  ballZ: number,
): BotId | null {
  if (
    holder &&
    holder !== selfId &&
    isFriendlyBallHolder(holder, team, localTeam)
  ) {
    const shooter = positions.find((p) => p.id === holder);
    if (
      shooter &&
      shooter.team === team &&
      isInsideShootZone(shooter.x, shooter.z, team) &&
      (holder === 'bot-0' || holder === 'bot-1' || holder === 'bot-2')
    ) {
      return holder;
    }
  }

  let bestId: BotId | null = null;
  let bestDist = Infinity;
  for (const p of positions) {
    if (p.id === selfId || p.team !== team) continue;
    if (!isInsideShootZone(p.x, p.z, team)) continue;
    const d = Math.hypot(p.x - ballX, p.z - ballZ);
    if (d < 14 && d < bestDist) {
      bestDist = d;
      bestId = p.id;
    }
  }
  return bestId;
}

/**
 * When a teammate shoots in-zone, roll once whether this bot may magnet the ball.
 * Returns true when the bot should stay off the ball (70% default).
 */
export function shouldGiveShootZoneSpace(
  state: AllyShootZoneMagnetState,
  selfId: BotId,
  team: Team,
  localTeam: Team,
  holder: BallHolderId,
  positions: BotZonePosition[],
  ballX: number,
  ballZ: number,
): boolean {
  const shooterId = findTeammateShooterInZone(
    selfId,
    team,
    localTeam,
    holder,
    positions,
    ballX,
    ballZ,
  );
  if (!shooterId) {
    state.magnetAllowed = null;
    state.shooterId = null;
    return false;
  }

  if (state.shooterId !== shooterId) {
    state.shooterId = shooterId;
    state.magnetAllowed = Math.random() < BOT.allyShootZoneMagnetChance;
  }

  return state.magnetAllowed !== true;
}

const _away = new THREE.Vector3();

/** Move target when yielding the shoot zone to a teammate */
export function pickGiveShootZoneSpaceTarget(
  selfPos: THREE.Vector3,
  shooterX: number,
  shooterZ: number,
  ballPos: THREE.Vector3,
  out: THREE.Vector3,
): THREE.Vector3 {
  _away.set(selfPos.x - shooterX, 0, selfPos.z - shooterZ);
  if (_away.lengthSq() < 0.25) {
    _away.set(selfPos.x - ballPos.x, 0, selfPos.z - ballPos.z);
  }
  if (_away.lengthSq() < 0.25) _away.set(0, 0, 1);
  _away.normalize();
  return out
    .set(shooterX, selfPos.y, shooterZ)
    .addScaledVector(_away, BOT.allyShootZoneGiveSpaceM);
}

function pickFieldMode(input: BotThinkInput): BotFieldMode {
  const distBall = input.pos.distanceTo(input.ballPos);
  const distPlayer = input.pos.distanceTo(input.playerChest);
  const engage = ballEngageDistance();
  const attract = ballAttractDistance();
  const {
    role,
    ballHolder,
    inBeamRange,
    beamDenied,
    id,
    team,
    localTeam,
    isEnemy,
  } = input;

  const allyCanBeam =
    isEnemy || canAllyBeamLooseBall(ballHolder, input.ballPos, input.ballVel);

  if (
    isFriendlyBallHolder(ballHolder, team, localTeam) &&
    ballHolder !== id
  ) {
    if (input.giveShootZoneSpace) return 'allySupport';
    return 'allyReceive';
  }

  if (input.waitForTeammateShot && !ballHolder) {
    return 'allySupport';
  }

  if (input.teammateReleaseKind === 'pass' && !ballHolder) {
    if (
      distBall <= attract * 1.35 &&
      inBeamRange &&
      !beamDenied &&
      allyCanBeam
    ) {
      return 'attractBall';
    }
    if (distBall <= engage * 1.6) return 'runToBall';
  }

  if (!isEnemy) {
    if (ballHolder === 'local') {
      if (
        distBall <= attract * 1.45 &&
        inBeamRange &&
        !beamDenied &&
        allyCanBeam
      ) {
        return 'attractBall';
      }
      if (distBall <= engage * 2.4) return 'runToBall';
      return 'allySupport';
    }
    if (!ballHolder) {
      if (distBall <= engage * 1.5) return 'runToBall';
      if (
        distBall <= attract * 1.85 &&
        inBeamRange &&
        !beamDenied &&
        allyCanBeam
      ) {
        return 'attractBall';
      }
    }
  }

  const canShootPlayer =
    distPlayer < BOT.moveShootPlayerDist && distPlayer > 3.5;

  if (preferMoveAndShoot(input, distBall) && canShootPlayer && isEnemy) {
    return 'moveAndShoot';
  }

  if (ballHolder === 'local' && isEnemy) {
    if (canShootPlayer && distBall > attract) return 'moveAndShoot';
    return distPlayer < BOT.modeRunPlayerDist ? 'runToPlayer' : 'moveAndShoot';
  }

  if (isNonTeammateBallHolder(ballHolder, id, team, localTeam)) {
    if (role === 'pressure' && canShootPlayer && isEnemy) return 'moveAndShoot';
    if (distBall > engage) return canShootPlayer && isEnemy ? 'moveAndShoot' : 'runToBall';
    return 'runToBall';
  }

  const tryAttract = (): BotFieldMode | null => {
    if (input.waitForTeammateShot) return null;
    if (input.giveShootZoneSpace && input.teammateReleaseKind !== 'pass') {
      return null;
    }
    if (
      distBall <= attract &&
      inBeamRange &&
      !beamDenied &&
      allyCanBeam
    ) {
      const otherCloser =
        input.otherBotPos &&
        input.otherBotPos.distanceTo(input.ballPos) <
          input.pos.distanceTo(input.ballPos) - 1.5;
      if (role === 'ball' || !otherCloser) return 'attractBall';
    }
    return null;
  };

  const attracted = tryAttract();
  if (attracted) return attracted;

  if (distBall <= engage) return 'runToBall';

  return canShootPlayer && isEnemy ? 'moveAndShoot' : 'runToBall';
}

export function updateHoldPhase(
  phase: BotHoldPhase,
  distGoal: number,
  holdSec: number,
  setupJumped: boolean,
  setupEnterSec: number,
  inShootZone = false,
  _farAction: BotFarHoldAction | null = null,
): BotHoldPhase {
  if (phase === 'shoot') return 'shoot';

  if (phase === 'advance') {
    if (inShootZone) return 'setup';
    if (distGoal <= BOT.goalSetupJumpDist) return 'setup';
    if (holdSec >= BOT.holdForceShootSec) return 'setup';
    if (holdSec >= BOT.holdMaxCarrySec) return 'setup';
    return 'advance';
  }

  if (phase === 'setup') {
    const setupAge = Math.max(0, holdSec - setupEnterSec);
    if (inShootZone && setupAge >= BOT.quickShotMinHoldSec) return 'shoot';
    if (setupJumped && setupAge >= BOT.holdShootAfterJumpSec) return 'shoot';
    if (setupAge >= BOT.holdSetupMaxSec) return 'shoot';
    if (
      distGoal <= BOT.goalQuickShotDist &&
      setupAge >= BOT.quickShotMinHoldSec
    ) {
      return 'shoot';
    }
  }

  return phase;
}

export function shouldSetupJump(
  holdPhase: BotHoldPhase,
  setupJumped: boolean,
  grounded: boolean,
  jumpsLeft: number,
): boolean {
  return (
    holdPhase === 'setup' &&
    !setupJumped &&
    grounded &&
    jumpsLeft > 0
  );
}

/** Movement target for current mode */
export function pickMoveTarget(
  mode: BotMode,
  input: BotThinkInput,
  out: THREE.Vector3,
): THREE.Vector3 {
  const { ballPos, playerChest, goal, id } = input;

  switch (mode) {
    case 'runToPlayer':
    case 'moveAndShoot':
      return out.copy(playerChest);
    case 'attractBall':
    case 'runToBall':
      out.copy(ballPos);
      if (mode === 'runToBall' && id === 'bot-1') {
        _flank.set(playerChest.x - ballPos.x, 0, playerChest.z - ballPos.z);
        if (_flank.lengthSq() > 0.01) {
          _flank.normalize();
          const perpX = -_flank.z * BOT.flankOffset;
          const perpZ = _flank.x * BOT.flankOffset;
          out.x += perpX;
          out.z += perpZ;
        }
      }
      return out;
    case 'allySupport':
      out.lerpVectors(ballPos, playerChest, 0.38);
      return out.setY(Math.max(out.y, playerChest.y));
    case 'allyReceive':
      return out.copy(ballPos);
    case 'carryToGoal':
    case 'setupShot':
    case 'shootGoal':
      return out.copy(goal);
    default:
      return out.copy(ballPos);
  }
}

/** Look target (aim) */
export function pickLookTarget(
  mode: BotMode,
  input: BotThinkInput,
  moveTarget: THREE.Vector3,
  out: THREE.Vector3,
): THREE.Vector3 {
  if (
    input.holdingBall &&
    (mode === 'carryToGoal' || mode === 'setupShot' || mode === 'shootGoal')
  ) {
    return out.copy(input.goal);
  }
  if (mode === 'runToPlayer' || mode === 'moveAndShoot') {
    return out.copy(input.playerChest);
  }
  if (mode === 'allySupport') return out.copy(input.ballPos);
  if (mode === 'allyReceive') return out.lerpVectors(input.ballPos, input.goal, 0.35);
  if (mode === 'attractBall') return out.copy(input.ballPos);
  return out.copy(moveTarget);
}

export function applyAllBotSeparation(
  wish: THREE.Vector3,
  pos: THREE.Vector3,
  selfId: BotId,
  others: { id: BotId; x: number; z: number }[],
): void {
  for (const o of others) {
    if (o.id === selfId) continue;
    const dx = pos.x - o.x;
    const dz = pos.z - o.z;
    const d = Math.hypot(dx, dz);
    if (d >= BOT.minBotSeparation || d < 0.01) continue;
    const push = ((BOT.minBotSeparation - d) / d) * BOT.separationWeight;
    wish.x += dx * push;
    wish.z += dz * push;
  }
  if (wish.lengthSq() > 0.01) wish.normalize();
}

export function applyBotSeparation(
  wish: THREE.Vector3,
  pos: THREE.Vector3,
  otherBotPos: THREE.Vector3 | null,
): void {
  if (!otherBotPos) return;
  const dx = pos.x - otherBotPos.x;
  const dz = pos.z - otherBotPos.z;
  const d = Math.hypot(dx, dz);
  if (d >= BOT.minBotSeparation || d < 0.01) return;
  const push = (BOT.minBotSeparation - d) / BOT.minBotSeparation;
  wish.x += (dx / d) * push * BOT.separationWeight;
  wish.z += (dz / d) * push * BOT.separationWeight;
  if (wish.lengthSq() > 0.01) wish.normalize();
}

export function modeWantsBeam(mode: BotMode): boolean {
  return mode === 'attractBall';
}

export function modeSprint(mode: BotMode): boolean {
  return (
    mode === 'runToBall' ||
    mode === 'runToPlayer' ||
    mode === 'moveAndShoot' ||
    mode === 'carryToGoal' ||
    mode === 'allySupport'
  );
}

export function canAllyBeamLooseBall(
  ballHolder: BallHolderId,
  ballPos: THREE.Vector3,
  ballVel: THREE.Vector3,
): boolean {
  if (ballHolder === 'local' || ballHolder === 'bot-2') return false;
  const heightAboveFloor = ballPos.y - ARENA.floorY - BALL.radius;
  if (heightAboveFloor > BOT.allyBeamMaxHeightAboveFloor) return false;
  if (ballVel.length() > BOT.allyBeamMaxSpeedForBeam) return false;
  if (
    heightAboveFloor > BOT.allyBeamLowMaxHeight &&
    Math.abs(ballVel.y) > BOT.allyBeamMaxVerticalSpeed
  ) {
    return false;
  }
  return true;
}

export function shouldBotAttemptProjectile(
  holder: BallHolderId,
  selfId: BotId,
  botTeam: Team,
  localTeam: Team,
): boolean {
  if (isFriendlyBallHolder(holder, botTeam, localTeam)) return false;
  if (!holder) return Math.random() < BOT.periodicFireAtLooseBallChance;
  if (isNonTeammateBallHolder(holder, selfId, botTeam, localTeam)) {
    if (holder === 'local') {
      return Math.random() < BOT.periodicFireAtPlayerCarrierChance;
    }
    return Math.random() < BOT.periodicFireAtBotCarrierChance;
  }
  return false;
}

/** True when neither enemy bot nor their ally holds the ball */
export function shouldEnemyTeamRocketVolley(
  holder: BallHolderId,
  localTeam: Team,
): boolean {
  const enemyTeam: Team = localTeam === 'red' ? 'blue' : 'red';
  return !isFriendlyBallHolder(holder, enemyTeam, localTeam);
}

export function teammateCloserToGoal(
  distGoal: number,
  teammateChest: THREE.Vector3,
  goal: THREE.Vector3,
): boolean {
  return (
    teammateChest.distanceTo(goal) < distGoal - BOT.passTeammateCloserBias
  );
}

export function rollHoldPassIntent(hasTeammate: boolean): boolean {
  return hasTeammate && Math.random() < BOT.passToTeammateChance * 0.35;
}

export function rollHoldRelease(
  distGoal: number,
  hasTeammate: boolean,
  teammateCloser: boolean,
  isEnemyPair: boolean,
  wantsPass: boolean,
  inShootZone = false,
): HoldReleaseKind {
  if (inShootZone) return 'shoot';
  if (isEnemyPair) {
    if (hasTeammate && Math.random() < 0.12) return 'pass';
    return 'shoot';
  }
  if (wantsPass && hasTeammate && distGoal > BOT.passPreferDist) return 'pass';
  const r = Math.random();
  const passBoost = teammateCloser ? 1.1 : 1;
  if (distGoal <= BOT.releaseCloseDist) {
    if (hasTeammate && r < 0.2 * passBoost) return 'pass';
    return 'shoot';
  }
  if (distGoal <= BOT.releaseMidDist) {
    if (hasTeammate && r < 0.32 * passBoost) return 'pass';
    return 'shoot';
  }
  if (distGoal <= BOT.releaseFarDist) {
    if (hasTeammate && r < 0.45 * passBoost) return 'pass';
    return r < 0.75 ? 'shoot' : 'loft';
  }
  if (hasTeammate && r < 0.5 * passBoost) return 'pass';
  return r < 0.7 ? 'shoot' : 'loft';
}

export function getHoldReleaseByDistance(
  holdSec: number,
  distGoal: number,
  hasTeammate: boolean,
  teammateCloser: boolean,
  isEnemyPair: boolean,
  wantsPass = false,
  inShootZone = false,
): HoldReleaseKind | null {
  if (holdSec < BOT.releaseMinHoldSec) return null;
  if (inShootZone) return 'shoot';
  if (holdSec >= BOT.holdMaxCarrySec) {
    if (
      hasTeammate &&
      !inShootZone &&
      distGoal > BOT.passPreferDist &&
      (teammateCloser || wantsPass)
    ) {
      return 'pass';
    }
    return distGoal > BOT.releaseCloseDist ? 'loft' : 'shoot';
  }
  return rollHoldRelease(
    distGoal,
    hasTeammate,
    teammateCloser,
    isEnemyPair,
    wantsPass,
    inShootZone,
  );
}

export function pickFarHoldAction(
  _distGoal: number,
  holdSec: number,
  hasTeammate: boolean,
  teammateCloser: boolean,
  isEnemyPair: boolean,
  inShootZone = false,
): BotFarHoldAction {
  if (holdSec < BOT.passHoldMinSec) return 'carry';
  if (inShootZone) {
    if (holdSec >= BOT.looseShootMinHoldSec) return 'looseShoot';
    return 'carry';
  }
  if (isEnemyPair) return 'carry';
  const passP =
    (hasTeammate ? BOT.passToTeammateChance * 0.35 : 0) *
    (teammateCloser ? 1.15 : 1);
  if (!hasTeammate) {
    return holdSec >= BOT.looseShootMinHoldSec ? 'looseShoot' : 'carry';
  }
  const r = Math.random();
  if (r < passP) return 'pass';
  return 'carry';
}

/**
 * Bots only pass to a teammate or shoot at the net — decided once per hold.
 */
export function resolveBotHoldRelease(
  holdSec: number,
  planned: HoldReleaseKind | null,
  hasTeammate: boolean,
): HoldReleaseKind | null {
  if (holdSec < BOT.releaseMinHoldSec) return null;
  const plan = planned ?? 'shoot';
  if (plan === 'pass') {
    if (!hasTeammate) return 'shoot';
    if (holdSec >= BOT.passHoldMinSec) return 'pass';
    if (holdSec >= BOT.holdMaxCarrySec * 0.55) return 'shoot';
    return null;
  }
  return 'shoot';
}

/** Pick pass vs shoot when the bot first grabs the ball. */
export function pickBotHoldAction(
  hasTeammate: boolean,
  teammateCloser: boolean,
): HoldReleaseKind {
  if (
    hasTeammate &&
    (teammateCloser || Math.random() < BOT.passToTeammateChance)
  ) {
    return 'pass';
  }
  return 'shoot';
}

/** 50/50 dribble at goal or teammate when a teammate exists. */
export function pickBotHoldCarryFocus(
  hasTeammate: boolean,
  distGoal = Infinity,
): BotHoldCarryFocus {
  if (!hasTeammate) return 'goal';
  if (distGoal <= BOT.goalQuickShotDist) return 'goal';
  return Math.random() < BOT.holdCarryTeammateChance ? 'teammate' : 'goal';
}

/** One-third each: shoot, keep carrying, pass (no teammate → shoot vs carry). */
export function pickBotHoldReleasePlan(
  hasTeammate: boolean,
): BotHoldReleasePlan {
  if (!hasTeammate) {
    return Math.random() < 0.5 ? 'shoot' : 'carry';
  }
  const r = Math.random();
  if (r < BOT.holdReleaseShootChance) return 'shoot';
  if (r < BOT.holdReleaseShootChance + BOT.holdReleaseCarryChance) {
    return 'carry';
  }
  return 'pass';
}

export function ensureHoldReleasePlan(
  holdSec: number,
  hasTeammate: boolean,
  plan: BotHoldReleasePlan | null,
): BotHoldReleasePlan | null {
  if (holdSec < BOT.holdCarryMinSec) return null;
  return plan ?? pickBotHoldReleasePlan(hasTeammate);
}

/**
 * Carry window, then release per plan. Near net / shoot zone → shoot sooner (LMB release).
 * `carry` plan returns null so the bot keeps dribbling.
 */
export function resolveTimedBotHoldRelease(
  holdSec: number,
  hasTeammate: boolean,
  inShootZone: boolean,
  releasePlan: BotHoldReleasePlan | null,
  distGoal = Infinity,
): HoldReleaseKind | null {
  const nearGoal =
    inShootZone || distGoal <= BOT.goalQuickShotDist;
  const minHold = nearGoal ? BOT.releaseMinHoldSec : BOT.holdCarryMinSec;
  if (holdSec < minHold) return null;

  if (holdSec >= BOT.holdMaxCarrySec) {
    if (inShootZone && hasTeammate) {
      return Math.random() < 0.22 ? 'pass' : 'shoot';
    }
    return 'shoot';
  }

  if (inShootZone) {
    if (!hasTeammate) return 'shoot';
    return Math.random() < 0.84 ? 'shoot' : 'pass';
  }

  if (distGoal <= BOT.goalQuickShotDist) {
    if (!hasTeammate || Math.random() < 0.78) return 'shoot';
    return 'pass';
  }

  if (!releasePlan) return null;
  if (releasePlan === 'carry') return null;
  if (releasePlan === 'pass') {
    return hasTeammate ? 'pass' : 'shoot';
  }
  return 'shoot';
}

const _carryLookRaw = new THREE.Vector3();

export function resetCarryLookState(state: CarryLookState): void {
  state.focus = 'goal';
  state.focusHoldLeft = 0;
  state.initialized = false;
  state.preferTeammateLook = false;
}

function pickCarryLookFocus(
  distGoal: number,
  hasTeammate: boolean,
  teammateCloser: boolean,
): CarryLookFocus {
  if (!hasTeammate) return 'goal';
  if (distGoal <= BOT.carryNearGoalLookDist && teammateCloser) return 'teammate';
  return 'goal';
}

export function updateCarryLook(
  state: CarryLookState,
  mode: 'carryToGoal' | 'setupShot' | 'shootGoal',
  goal: THREE.Vector3,
  teammateChest: THREE.Vector3 | null,
  opponentChest: THREE.Vector3 | null,
  distGoal: number,
  dt: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  if (mode === 'shootGoal' || mode === 'setupShot') {
    state.focus = 'goal';
    return out.copy(goal);
  }

  const hasTm = teammateChest !== null;
  const tmCloser =
    hasTm && teammateChest.distanceTo(goal) < distGoal - BOT.passTeammateCloserBias;
  const nextFocus = pickCarryLookFocus(distGoal, hasTm, tmCloser);

  if (nextFocus !== state.focus) {
    state.focusHoldLeft -= dt;
    if (state.focusHoldLeft <= 0) {
      state.focus = nextFocus;
      state.focusHoldLeft =
        distGoal <= BOT.carryNearGoalLookDist
          ? BOT.carryNearGoalLookHoldSec
          : BOT.carryLookFocusHoldSec;
    }
  } else {
    state.focusHoldLeft = Math.max(
      state.focusHoldLeft,
      distGoal <= BOT.carryNearGoalLookDist
        ? BOT.carryNearGoalLookHoldSec
        : BOT.carryLookFocusHoldSec,
    );
  }

  if (state.focus === 'teammate' && teammateChest) {
    _carryLookRaw.copy(teammateChest);
  } else if (state.focus === 'opponent' && opponentChest) {
    _carryLookRaw.copy(opponentChest);
  } else {
    _carryLookRaw.copy(goal);
  }
  _carryLookRaw.y = Math.max(_carryLookRaw.y, goal.y * 0.72);

  if (!state.initialized) {
    state.smoothed.copy(_carryLookRaw);
    state.initialized = true;
  } else {
    const alpha = 1 - Math.exp(-BOT.carryLookPointSmooth * Math.max(dt, 1 / 120));
    state.smoothed.lerp(_carryLookRaw, alpha);
  }
  return out.copy(state.smoothed);
}
