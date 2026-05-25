import { useFrame } from '@react-three/fiber';
import {
  CapsuleCollider,
  interactionGroups,
  RigidBody,
  useAfterPhysicsStep,
  useRapier,
  type RapierRigidBody,
} from '@react-three/rapier';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  ARENA,
  BALL,
  BEAM,
  BOT,
  ENERGY,
  MOVEMENT,
  TEAM_SPAWN,
} from '../shared/Constants';
import { tuningStore } from './tuningStore';
import { PLAYER_RIM_PROBE_RADIUS } from './goalRingBounce';
import { tickGoalEntryCharacterBounce } from './goalNetBounce';
import { getArenaStandY } from './arenaSpawn';
import { isInsideHex } from './arenaHex';
import {
  applyEscapeImpulse,
  clampMoveTargetFromBackWall,
  createBotStuckState,
  softenHexBoundaryVelocity,
  tickBotBackWallEscape,
  tickBotBackWallKeepOut,
  tickBotWallEscape,
  type BotStuckState,
} from './botWallEscape';
import type { Team } from '../shared/Types';
import { canCaptureWithContest, recordBeamPull } from './ballBeamContest';
import {
  applyBeamAttraction,
  beamGrabDistance,
  beamTraceBallAnchor,
} from './beamPhysics';
import { botFireHeldBall, type BotLaunchKind } from './botHeldBallShot';
import { canKnockLooseHeldBall } from './ballHoldImmunity';
import { setBotBallChaseActive } from './botTeamBallChase';
import { tryBallGoalScoreAtPoint } from './goalScoreHandler';
import {
  captureBallSocket,
  releaseBallPhysics,
  smoothHoldSocketTarget,
  updateBallSocketSmooth,
} from './ballAttach';
import {
  aimAnglesToward,
  getEnemyGoalTarget,
  pickAllyProjectileTarget,
  pickAllySaveBallTarget,
  applyBotLaunchAimError,
  pickBotLoftLaunchTarget,
  pickEnemyVolleyRocketTarget,
  pickRetaliationAimTarget,
  pickFollowPlayerProjectileTarget,
  pickTeammatePassTarget,
} from './botGoals';
import { getBotPressureScalars } from './botTuning';
import { createRocket, type ActiveRocket } from './rocketSystem';
import { CHARACTER_MESH_RENDER_ORDER, GroundJerseyDecal } from './JerseyDecal';
import { PlayerAvatar } from './PlayerAvatar';
import { TeamOrb } from './TeamOrb';
import {
  createBotCombatState,
  registerPlayerHitOnBot,
  tickBotRagdoll,
  type BotCombatState,
} from './botCombat';
import { tickBotKnockStun } from './rocketKnockStun';
import { DroneThrusterFlames } from './DroneThrusterFlames';
import { VelocityPathRibbon } from './VelocityPathRibbon';
import {
  alignCharacterVisualUpright,
  createKnockVisualTumbleState,
  createVisualRecoveryState,
  forceCharacterUpright,
  impulseKnockVisualTumble,
  syncCharacterVisualPresentation,
  tickCharacterVisualRecovery,
  tickKnockVisualTumble,
  type VisualRecoveryState,
} from './characterVisual';
import {
  assignBotProfiles,
  getJerseyNumber,
  type ActorId,
} from './playerRoster';
import {
  applyAllBotSeparation,
  botRole,
  modeSprint,
  canAllyBeamLooseBall,
  modeWantsBeam,
  gatePlayerChaseMode,
  isPlayerChaseMode,
  isBallGrabMode,
  pickBotMode,
  stunnedBallFallbackMode,
  pickGiveShootZoneSpaceTarget,
  shouldGiveShootZoneSpace,
  applyTeammateBallChaseMode,
  isBallChaseBroadcastMode,
  type AllyShootZoneMagnetState,
  type TeammateBallChaseState,
  type BotZonePosition,
  pickLookTarget,
  pickMoveTarget,
  type PlayerChaseState,
  shouldSetupJump,
  ensureHoldReleasePlan,
  pickBotHoldCarryFocus,
  resolveTimedBotHoldRelease,
  updateHoldPhase,
  type BotHoldCarryFocus,
  type BotHoldReleasePlan,
  resetCarryLookState,
  createEnemyPlayerCarrierShotGate,
  tickEnemyPlayerCarrierShotGate,
  shouldBotAttemptProjectile,
  shouldEnemyTeamRocketVolley,
  updateCarryLook,
  type BotFarHoldAction,
  type BotHoldPhase,
  type BotMode,
  type CarryLookState,
} from './botBrain';
import {
  armBotRetaliation,
  clearBotRetaliation,
  createBotRetaliationState,
  isBotRetaliationActive,
  isHostileRocketHit,
  snapBotRetaliationAim,
  tickBotRetaliation,
  type BotRetaliationState,
} from './botRetaliation';
import { applyDirectRocketToBot, applyExplosionToBot } from './explosions';
import { createFallTracker, type SafePosition } from './fallRecovery';
import { isBeamDenied } from './beamDenyZones';
import {
  getTeammateReleaseIntent,
  recordBotTeamRelease,
  shouldAllyReactSaveToOpponentShot,
  shouldWaitForTeammateShot,
  type BotTeamReleaseKind,
} from './botTeamRelease';
import { isInsideShootZone } from './botShootZone';
import {
  getKickoffBallAimPoint,
  beginKickoffAllyOopReturnHome,
  clearKickoffAllyOopReturnHome,
  endKickoffAllyOopForBot,
  getKickoffAllyOopReturnCenter,
  isKickoffAllyOopBot,
  isKickoffAllyOopReturningHome,
  isKickoffContestPhase,
  kickoffAllyOopPassWaitExceeded,
  noteKickoffAllyOopAtRim,
  kickoffContestHorizDistToAim,
  kickoffContestJumpForce,
  kickoffContestShouldDoubleJump,
  kickoffContestShouldJump,
  kickoffContestSprintSpeed,
  pickKickoffContestMoveTarget,
  tickKickoffState,
} from './botKickoff';
import { isBotTeamAllyDunkPoster } from './botAllyDunkRole';
import {
  clampAllyDunkMoveTarget,
  dunkPitchOffsetRad,
  getHolderDistGoal,
  isBallPassingToAlly,
  isFriendlyHolderNearGoal,
  isHolderSettingUpShot,
  getDistToBottomRingMouth,
  pickAllyDunkSpot,
  pickBotGoalOffenseMoveTarget,
  pickBotStyledLaunchTarget,
  rollBotShotStyle,
  type BotShotStyle,
} from './botGoalOffense';
import { gameStore, type BallHolderId } from './gameStore';
import { writeLookDirection } from './CameraController';
import { BeamPullTrace } from './BeamPullTrace';

export type BotId = 'bot-0' | 'bot-1' | 'bot-2';

export type BotSpawnConfig = {
  id: BotId;
  team: Team;
  x: number;
  z: number;
};

const HEX_SPAWN_PAD = 6;

/** Enemy pair on their end wall; ally on player end — attack opposite-colored goals */
export function buildBotRoster(localTeam: Team): BotSpawnConfig[] {
  const enemyTeam: Team = localTeam === 'blue' ? 'red' : 'blue';
  const enemyBase = TEAM_SPAWN[enemyTeam];
  const allyBase = TEAM_SPAWN[localTeam];

  const towardCenter = localTeam === 'blue' ? 1 : -1;
  return [
    {
      id: 'bot-0',
      team: enemyTeam,
      x: enemyBase.x + towardCenter * 14,
      z: enemyBase.z,
    },
    {
      id: 'bot-1',
      team: enemyTeam,
      x: enemyBase.x + towardCenter * 14,
      z: enemyBase.z + 22,
    },
    {
      id: 'bot-2',
      team: localTeam,
      x: allyBase.x - towardCenter * 14,
      z: allyBase.z + 10,
    },
  ];
}

function assertSpawnInArena(spawns: BotSpawnConfig[]): void {
  const r = ARENA.hexRadius - HEX_SPAWN_PAD;
  for (const s of spawns) {
    if (!isInsideHex(s.x, s.z, r)) {
      console.warn(`[bots] spawn ${s.id} outside arena`, s);
    }
  }
}

export type BotRuntime = {
  id: BotId;
  team: 'red' | 'blue';
  bodyRef: React.RefObject<RapierRigidBody | null>;
  holdingBall: boolean;
  combat: BotCombatState;
  spawn: SafePosition;
  fallTrack: ReturnType<typeof createFallTracker>;
  beamLockUntil: number;
  /** Wall-clock sec — no ball chase / grab after rocket hit */
  ballDenyUntil: number;
  /** Wall-clock sec — block beam until this time after pass/shoot */
  beamRegrabUntil: number;
  onRecovered: () => void;
  onRagdollBurst?: (
    anchor: { x: number; y: number; z: number },
    follow: () => { x: number; y: number; z: number } | null,
    team: Team,
  ) => void;
  retaliation: BotRetaliationState;
  visualRecovery: VisualRecoveryState;
};

type BotsProps = {
  botsRef: React.MutableRefObject<BotRuntime[]>;
  ballBodyRef: React.RefObject<RapierRigidBody | null>;
  playerChestRef: React.RefObject<THREE.Vector3>;
  playerBodyRef: React.RefObject<RapierRigidBody | null>;
  onRocketFired: (rocket: ActiveRocket) => void;
  botEnergyLevelsRef: React.MutableRefObject<Record<BotId, number>>;
  onBotRagdollBurst?: (
    anchor: { x: number; y: number; z: number },
    follow: () => { x: number; y: number; z: number } | null,
    team: Team,
  ) => void;
};

const _pos = new THREE.Vector3();
const _chest = new THREE.Vector3();
const _ballPos = new THREE.Vector3();
const _ballVel = new THREE.Vector3();
const _goal = new THREE.Vector3();
const _lookDir = new THREE.Vector3();
const _wish = new THREE.Vector3();
const _center = new THREE.Vector3();
const _kickoffAim = new THREE.Vector3();
const _shootTarget = new THREE.Vector3();
const _teammateVel = new THREE.Vector3();
const _playerChest = new THREE.Vector3();
const _moveTarget = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _otherBotPos = new THREE.Vector3();
const _opponentChest = new THREE.Vector3();
const _opponentVel = new THREE.Vector3();
const _playerVel = new THREE.Vector3();
const _launchSpawn = new THREE.Vector3();
const _botSepScratch: {
  id: BotId;
  team: 'red' | 'blue';
  x: number;
  z: number;
}[] = [];

function collectBotSepPositions(
  allBots: BotRuntime[],
  out: typeof _botSepScratch,
): void {
  out.length = 0;
  for (const b of allBots) {
    const body = b.bodyRef.current;
    if (!body) continue;
    const t = body.translation();
    out.push({ id: b.id, team: b.team, x: t.x, z: t.z });
  }
}

function smoothAimToward(
  yawRef: React.MutableRefObject<number>,
  pitchRef: React.MutableRefObject<number>,
  chest: THREE.Vector3,
  target: THREE.Vector3,
  dt: number,
  smoothing: number = BOT.aimSmoothing,
) {
  const aim = aimAnglesToward(chest, target);
  const s = 1 - Math.exp(-smoothing * dt);
  yawRef.current = THREE.MathUtils.lerp(yawRef.current, aim.yaw, s);
  pitchRef.current = THREE.MathUtils.lerp(pitchRef.current, aim.pitch, s);
}

function writeBotRocketLook(
  yaw: React.MutableRefObject<number>,
  pitch: React.MutableRefObject<number>,
  lookDir: THREE.Vector3,
) {
  pitch.current = Math.min(
    1.22,
    pitch.current + THREE.MathUtils.degToRad(BOT.rocketPitchOffsetDeg),
  );
  writeLookDirection(yaw.current, pitch.current, lookDir);
}

function resolveRetaliationAttackerChest(
  retaliation: BotRetaliationState,
  allBots: BotRuntime[],
  playerChest: THREE.Vector3,
  playerVel: THREE.Vector3,
  chestOut: THREE.Vector3,
  velOut: THREE.Vector3,
): void {
  const attackerId = retaliation.attackerId;
  if (!attackerId || attackerId === 'local') {
    chestOut.copy(playerChest);
    velOut.copy(playerVel);
    return;
  }
  const attacker = allBots.find((b) => b.id === attackerId);
  const body = attacker?.bodyRef.current;
  if (!body) {
    chestOut.copy(playerChest);
    velOut.copy(playerVel);
    return;
  }
  const t = body.translation();
  const lv = body.linvel();
  chestOut.set(t.x, t.y + BEAM.chestHeight, t.z);
  velOut.set(lv.x, lv.y, lv.z);
}

function applyBotRetaliationAim(
  chest: THREE.Vector3,
  retaliation: BotRetaliationState,
  allBots: BotRuntime[],
  playerChest: THREE.Vector3,
  playerVel: THREE.Vector3,
  lookTarget: THREE.Vector3,
  lookDir: THREE.Vector3,
  yaw: React.MutableRefObject<number>,
  pitch: React.MutableRefObject<number>,
  dt: number,
) {
  resolveRetaliationAttackerChest(
    retaliation,
    allBots,
    playerChest,
    playerVel,
    _opponentChest,
    _teammateVel,
  );
  pickRetaliationAimTarget(chest, _opponentChest, _teammateVel, lookTarget);
  smoothAimToward(
    yaw,
    pitch,
    chest,
    lookTarget,
    dt,
    BOT.retaliateAimSmoothing,
  );
  writeLookDirection(yaw.current, pitch.current, lookDir);
}

function applyBotMovementEscape(
  pos: THREE.Vector3,
  wish: THREE.Vector3,
  vel: THREE.Vector3,
  stuck: BotStuckState,
  dt: number,
  attackingTeam: Team | null = null,
): boolean {
  tickBotBackWallKeepOut(pos, wish, attackingTeam);
  const backWish = tickBotBackWallEscape(pos, wish, dt, attackingTeam);
  if (backWish) {
    wish.copy(backWish);
    applyEscapeImpulse(vel, backWish);
    return true;
  }
  const escape = tickBotWallEscape(stuck, pos, wish, dt);
  if (!escape.escapeWish) return false;
  wish.copy(escape.escapeWish);
  applyEscapeImpulse(vel, escape.escapeWish);
  return escape.requestJump;
}

function staggerTimer(botId: BotId, interval: number): number {
  if (botId === 'bot-0') return interval * 0.35;
  if (botId === 'bot-1') return interval * 0.7;
  return interval * 0.5;
}

function updateBotGrounded(
  bodyY: number,
  linvelY: number,
  airGrace: number,
  grounded: React.MutableRefObject<boolean>,
  jumpsLeft: React.MutableRefObject<number>,
  wasGrounded: React.MutableRefObject<boolean>,
): void {
  if (airGrace > 0.08) {
    grounded.current = false;
    return;
  }
  const onFloor = bodyY <= MOVEMENT.capsuleHeight + 0.3;
  const slowY = Math.abs(linvelY) < 1.35;
  const nowGrounded = onFloor && slowY;
  if (nowGrounded && !wasGrounded.current) {
    jumpsLeft.current = BOT.maxJumps;
  }
  wasGrounded.current = nowGrounded;
  grounded.current = nowGrounded;
}

function botApplyJump(
  body: RapierRigidBody,
  feetY: number,
  vy: number,
  linvel: { x: number; y: number; z: number },
  velocity: React.MutableRefObject<THREE.Vector3>,
  airGrace: React.MutableRefObject<number>,
  grounded: React.MutableRefObject<boolean>,
  jumpsLeft: React.MutableRefObject<number>,
): number {
  jumpsLeft.current = Math.max(0, jumpsLeft.current - 1);
  grounded.current = false;
  airGrace.current = BOT.jumpAirGraceSec;
  velocity.current.x = linvel.x * MOVEMENT.jumpMomentumBoost;
  velocity.current.z = linvel.z * MOVEMENT.jumpMomentumBoost;
  const t = body.translation();
  body.setTranslation(
    {
      x: t.x,
      y: Math.max(t.y, feetY) + BOT.jumpLiftY,
      z: t.z,
    },
    true,
  );
  return vy;
}

type BotJumpState = {
  grounded: React.MutableRefObject<boolean>;
  jumpsLeft: React.MutableRefObject<number>;
  airGrace: React.MutableRefObject<number>;
  velocity: React.MutableRefObject<THREE.Vector3>;
  groundJumpTimer: React.MutableRefObject<number>;
  doubleJumpDelay: React.MutableRefObject<number>;
  doubleJumpPending: React.MutableRefObject<boolean>;
};

function tickBotJumpCycle(
  dt: number,
  body: RapierRigidBody,
  feetY: number,
  linvel: { x: number; y: number; z: number },
  tune: { jumpForce: number },
  intervalSec: number,
  state: BotJumpState,
  moving: boolean,
  hopChance: number,
): number | null {
  state.groundJumpTimer.current -= dt;

  if (state.doubleJumpPending.current && state.airGrace.current > 0.15) {
    state.doubleJumpDelay.current -= dt;
    if (
      state.doubleJumpDelay.current <= 0 &&
      state.jumpsLeft.current > 0
    ) {
      state.doubleJumpPending.current = false;
      return botApplyJump(
        body,
        feetY,
        tuningStore.getDoubleJumpForce(),
        linvel,
        state.velocity,
        state.airGrace,
        state.grounded,
        state.jumpsLeft,
      );
    }
  } else if (state.grounded.current && state.airGrace.current <= 0.06) {
    state.doubleJumpPending.current = false;
  }

  const hopRoll = Math.random() < hopChance;
  const wantHop =
    moving &&
    hopRoll &&
    state.groundJumpTimer.current <= 0 &&
    state.grounded.current &&
    state.jumpsLeft.current > 0;

  if (wantHop) {
    const jitter = 1 + Math.random() * BOT.jumpIntervalJitter;
    state.groundJumpTimer.current = intervalSec * jitter;
    state.doubleJumpPending.current =
      Math.random() < BOT.chaseDoubleJumpChance;
    if (state.doubleJumpPending.current) {
      state.doubleJumpDelay.current = BOT.doubleJumpDelaySec;
    }
    return botApplyJump(
      body,
      feetY,
      tune.jumpForce,
      linvel,
      state.velocity,
      state.airGrace,
      state.grounded,
      state.jumpsLeft,
    );
  }

  return null;
}

function releaseBotBall(
  bot: BotRuntime,
  ball: RapierRigidBody | null,
  force = false,
) {
  if (
    !force &&
    gameStore.getState().ballHolderId === bot.id &&
    !canKnockLooseHeldBall()
  ) {
    return;
  }
  bot.holdingBall = false;
  if (gameStore.getState().ballHolderId === bot.id) {
    gameStore.clearBallHolder(true);
  }
  if (ball) releaseBallPhysics(ball);
  gameStore.setBallState('loose');
}

function botFireRocket(
  botId: BotId,
  body: RapierRigidBody,
  chest: THREE.Vector3,
  lookDir: THREE.Vector3,
  onRocketFired: (rocket: ActiveRocket) => void,
  explosive = true,
) {
  _launchSpawn.copy(chest).addScaledVector(lookDir, 1.2);
  const lv = body.linvel();
  onRocketFired(
    createRocket(
      { x: _launchSpawn.x, y: _launchSpawn.y, z: _launchSpawn.z },
      { x: lookDir.x, y: lookDir.y, z: lookDir.z },
      botId,
      { x: lv.x, y: lv.y, z: lv.z },
      explosive,
      BOT.rocketSpeedScale,
    ),
  );
}

function executeBotHoldRelease(
  bot: BotRuntime,
  ball: RapierRigidBody,
  body: RapierRigidBody,
  chest: THREE.Vector3,
  target: THREE.Vector3,
  kind: BotLaunchKind,
  dt: number,
  yaw: React.MutableRefObject<number>,
  pitch: React.MutableRefObject<number>,
  lookDir: THREE.Vector3,
  shotStyle: BotShotStyle = 'normal',
) {
  applyBotLaunchAimError(chest, target, _shootTarget);
  smoothAimToward(yaw, pitch, chest, _shootTarget, dt, BOT.aimSmoothing);
  const stylePitch = dunkPitchOffsetRad(shotStyle);
  if (kind === 'shoot' || kind === 'loft') {
    const loftExtra =
      kind === 'loft' ? THREE.MathUtils.degToRad(BOT.loftPitchOffsetDeg) : 0;
    pitch.current = Math.min(
      1.22,
      pitch.current +
        THREE.MathUtils.degToRad(BOT.shotPitchOffsetDeg) +
        stylePitch +
        loftExtra,
    );
  } else if (stylePitch !== 0) {
    pitch.current = Math.max(-0.35, Math.min(1.22, pitch.current + stylePitch));
  }
  writeLookDirection(yaw.current, pitch.current, lookDir);
  const lv = body.linvel();
  bot.holdingBall = false;
  botFireHeldBall(
    bot.id,
    ball,
    chest,
    new THREE.Vector3(lv.x, lv.y, lv.z),
    lookDir,
    kind,
    shotStyle,
  );
  bot.beamRegrabUntil =
    performance.now() / 1000 + BOT.postReleaseBeamCooldownSec;
  const teamKind: BotTeamReleaseKind = kind === 'pass' ? 'pass' : 'shot';
  recordBotTeamRelease(bot.team, bot.id, teamKind);
}

function getFriendlyHolderChest(
  holder: BallHolderId,
  bot: BotRuntime,
  allBots: BotRuntime[],
  localTeam: Team,
  playerChest: THREE.Vector3,
  out: THREE.Vector3,
): THREE.Vector3 | null {
  if (!holder || holder === bot.id) return null;
  if (holder === 'local') {
    if (bot.team !== localTeam) return null;
    return out.copy(playerChest);
  }
  for (const other of allBots) {
    if (other.id !== holder) continue;
    if (other.team !== bot.team) return null;
    const body = other.bodyRef.current;
    if (!body) return null;
    const t = body.translation();
    return out.set(t.x, t.y + BEAM.chestHeight, t.z);
  }
  return null;
}

function collectBotZonePositions(
  allBots: BotRuntime[],
  out: BotZonePosition[],
): BotZonePosition[] {
  out.length = 0;
  for (const b of allBots) {
    const body = b.bodyRef.current;
    if (!body) continue;
    const t = body.translation();
    out.push({ id: b.id, team: b.team, x: t.x, z: t.z });
  }
  return out;
}

function getNearestOtherBotPosition(
  bot: BotRuntime,
  allBots: BotRuntime[],
  out: THREE.Vector3,
): THREE.Vector3 | null {
  const self = bot.bodyRef.current;
  if (!self) return null;
  const st = self.translation();
  let bestD = Infinity;
  let found = false;
  for (const other of allBots) {
    if (other.id === bot.id) continue;
    const body = other.bodyRef.current;
    if (!body) continue;
    const t = body.translation();
    const d = (t.x - st.x) ** 2 + (t.z - st.z) ** 2;
    if (d < bestD) {
      bestD = d;
      out.set(t.x, t.y, t.z);
      found = true;
    }
  }
  return found ? out : null;
}

function getTeammateChest(
  bot: BotRuntime,
  allBots: BotRuntime[],
  localTeam: Team,
  playerChest: THREE.Vector3,
  playerVel: THREE.Vector3,
  out: THREE.Vector3,
  velOut: THREE.Vector3,
): THREE.Vector3 | null {
  const selfBody = bot.bodyRef.current;
  if (!selfBody) return null;
  const st = selfBody.translation();
  let best: THREE.Vector3 | null = null;
  let bestD = Infinity;
  for (const other of allBots) {
    if (other.id === bot.id || other.team !== bot.team) continue;
    const body = other.bodyRef.current;
    if (!body) continue;
    const t = body.translation();
    const dist = (t.x - st.x) ** 2 + (t.z - st.z) ** 2;
    if (dist < bestD) {
      bestD = dist;
      const lv = body.linvel();
      best = out.set(t.x, t.y + BEAM.chestHeight, t.z);
      velOut.set(lv.x, lv.y, lv.z);
    }
  }
  if (!best && bot.team === localTeam) {
    velOut.copy(playerVel);
    return out.copy(playerChest);
  }
  return best;
}

function getNearestEnemyBotChest(
  bot: BotRuntime,
  allBots: BotRuntime[],
  out: THREE.Vector3,
  velOut: THREE.Vector3,
): THREE.Vector3 | null {
  const self = bot.bodyRef.current;
  if (!self) return null;
  const st = self.translation();
  let bestD = Infinity;
  let found = false;
  for (const other of allBots) {
    if (other.id === bot.id || other.team === bot.team) continue;
    const body = other.bodyRef.current;
    if (!body) continue;
    const t = body.translation();
    const d = (t.x - st.x) ** 2 + (t.z - st.z) ** 2;
    if (d < bestD) {
      bestD = d;
      const lv = body.linvel();
      out.set(t.x, t.y + BEAM.chestHeight, t.z);
      velOut.set(lv.x, lv.y, lv.z);
      found = true;
    }
  }
  return found ? out : null;
}

function getOpponentChest(
  bot: BotRuntime,
  allBots: BotRuntime[],
  localTeam: Team,
  playerChest: THREE.Vector3,
  out: THREE.Vector3,
): THREE.Vector3 | null {
  const selfBody = bot.bodyRef.current;
  if (!selfBody) return null;
  const st = selfBody.translation();
  let best: THREE.Vector3 | null = null;
  let bestD = Infinity;
  for (const other of allBots) {
    if (other.id === bot.id || other.team === bot.team) continue;
    const body = other.bodyRef.current;
    if (!body) continue;
    const t = body.translation();
    const dist = (t.x - st.x) ** 2 + (t.z - st.z) ** 2;
    if (dist < bestD) {
      bestD = dist;
      best = out.set(t.x, t.y + BEAM.chestHeight, t.z);
    }
  }
  if (bot.team !== localTeam) {
    const px = playerChest.x;
    const pz = playerChest.z;
    const dist = (px - st.x) ** 2 + (pz - st.z) ** 2;
    if (dist < bestD) {
      return out.copy(playerChest);
    }
  }
  return best;
}

function BotAvatar({
  bot,
  allBots,
  ballBodyRef,
  playerChestRef,
  playerBodyRef,
  onRocketFired,
  botEnergyLevelsRef,
  pendingEnemyRocketBot,
}: {
  bot: BotRuntime;
  allBots: BotRuntime[];
  ballBodyRef: React.RefObject<RapierRigidBody | null>;
  playerChestRef: React.RefObject<THREE.Vector3>;
  playerBodyRef: React.RefObject<RapierRigidBody | null>;
  onRocketFired: (rocket: ActiveRocket) => void;
  botEnergyLevelsRef: React.MutableRefObject<Record<BotId, number>>;
  pendingEnemyRocketBot: React.MutableRefObject<BotId | null>;
}) {
  const bodyRef = bot.bodyRef;
  const { world } = useRapier();
  const velocity = useRef(new THREE.Vector3());
  const grounded = useRef(true);
  const wasGrounded = useRef(true);
  const jumpsLeft = useRef(BOT.maxJumps);
  const yaw = useRef(0);
  const pitch = useRef(0.15);
  const energy = useRef(100);
  const holdTimer = useRef(0);
  const holdCarryFocus = useRef<BotHoldCarryFocus>('goal');
  const holdReleasePlan = useRef<BotHoldReleasePlan | null>(null);
  const shotStyle = useRef<BotShotStyle>('normal');
  const holdPhase = useRef<BotHoldPhase>('advance');
  const setupJumped = useRef(false);
  const setupDoubleJumped = useRef(false);
  const setupEnterSec = useRef(0);
  const modeRef = useRef<BotMode>('runToBall');
  const allyDunkCatchHold = useRef(false);
  const groundJumpTimer = useRef(staggerTimer(bot.id, BOT.groundJumpIntervalSec));
  const kickoffContestJumpTimer = useRef(
    staggerTimer(bot.id, BOT.kickoffContestJumpIntervalSec),
  );
  const passCooldown = useRef(0);
  const holdFarAction = useRef<BotFarHoldAction | null>(null);
  const holdFarActionTimer = useRef(0);
  const doubleJumpDelay = useRef(0);
  const doubleJumpPending = useRef(false);
  const projectileTimer = useRef(
    staggerTimer(bot.id, BOT.periodicProjectileIntervalSec),
  );
  const followProjectileTimer = useRef(
    staggerTimer(bot.id, BOT.followPlayerProjectileIntervalSec),
  );
  const followRocketTimer = useRef(
    staggerTimer(bot.id, BOT.followPlayerRocketIntervalSec),
  );
  const followModeRocketCooldown = useRef(0);
  const shotIndex = useRef(
    bot.id === 'bot-0' ? 0 : bot.id === 'bot-1' ? 1 : 2,
  );
  const isEnemyBot = bot.team !== gameStore.getState().localTeam;
  const airGrace = useRef(0);
  const goalNetCooldown = useRef(0);
  const goalRimCooldown = useRef(0);
  const stuckState = useRef<BotStuckState | null>(null);
  const jumpState: BotJumpState = {
    grounded,
    jumpsLeft,
    airGrace,
    velocity,
    groundJumpTimer,
    doubleJumpDelay,
    doubleJumpPending,
  };
  const role = botRole(bot.id);
  const beamPullActive = useRef(false);
  const beamFrom = useRef(new THREE.Vector3());
  const beamTo = useRef(new THREE.Vector3());
  const holdLatchT = useRef(1);
  /** Beam attract time before a bot can socket the ball */
  const botBeamCaptureT = useRef(0);
  const holdSocketSmoothed = useRef(new THREE.Vector3());
  const holdSocketSmoothReady = useRef(false);
  const playerChaseState = useRef<PlayerChaseState>({
    burstSecLeft: 0,
    cooldownSecLeft: 0,
  });
  const playerCarrierShotGate = useRef(
    isEnemyBot ? createEnemyPlayerCarrierShotGate(bot.id) : null,
  );
  const shootZoneMagnetState = useRef<AllyShootZoneMagnetState>({
    magnetAllowed: null,
    shooterId: null,
  });
  const teammateBallChaseState = useRef<TeammateBallChaseState>({
    chaserId: null,
    response: null,
    centerUntilMs: 0,
  });
  const botZoneScratch = useRef<BotZonePosition[]>([]);
  const carryLookState = useRef<CarryLookState>({
    focus: 'goal',
    focusHoldLeft: 0,
    smoothed: new THREE.Vector3(),
    initialized: false,
    preferTeammateLook: false,
  });
  const capHalfH = MOVEMENT.capsuleHeight / 2 - MOVEMENT.capsuleRadius;
  const capCenterY = capHalfH + MOVEMENT.capsuleRadius;
  const feetY = ARENA.floorY;
  const visualRef = useRef<THREE.Group>(null);
  const tiltRef = useRef<THREE.Group>(null);
  const bobRef = useRef<THREE.Group>(null);
  const pitchSmooth = useRef(0);
  const bobPhase = useRef(0);
  const knockTumble = useRef(createKnockVisualTumbleState());
  const knockStunWasActive = useRef(false);
  const trailPos = useRef(new THREE.Vector3());

  const applyBotVisual = (
    lv: { x: number; y: number; z: number },
    frameDt: number,
    bodyForUpright?: RapierRigidBody | null,
  ) => {
    const refs = {
      visual: visualRef.current,
      tilt: tiltRef.current,
      bob: bobRef.current,
      pitchSmooth,
      bobPhase,
    };
    if (
      bodyForUpright &&
      tickCharacterVisualRecovery(
        bodyForUpright,
        bot.visualRecovery,
        refs,
        yaw.current,
        pitch.current,
        Math.hypot(lv.x, lv.z),
        frameDt,
      )
    ) {
      return;
    }
    if (bodyForUpright) {
      syncCharacterVisualPresentation(
        bodyForUpright,
        refs,
        yaw.current,
        pitch.current,
        Math.hypot(lv.x, lv.z),
        frameDt,
      );
    }
  };

  useAfterPhysicsStep(() => {
    const body = bodyRef.current;
    if (!body || bot.combat.isRagdoll) return;

    const t = body.translation();
    const lv = body.linvel();
    if (airGrace.current > 0.08 || lv.y > 0.8) return;
    if (t.y < feetY - 0.02) {
      body.setTranslation({ x: t.x, y: feetY, z: t.z }, true);
      if (lv.y < 0) {
        body.setLinvel({ x: lv.x, y: 0, z: lv.z }, true);
      }
    }
  });

  bot.onRecovered = () => {
    bot.holdingBall = false;
    resetCarryLookState(carryLookState.current);
    holdPhase.current = 'advance';
    setupJumped.current = false;
    setupEnterSec.current = 0;
    holdTimer.current = 0;
    velocity.current.set(0, 0, 0);
    if (gameStore.getState().ballHolderId === bot.id) {
      gameStore.clearBallHolder(true);
    }
  };

  useFrame((_, dt) => {
    const syncedEnergy = botEnergyLevelsRef.current[bot.id];
    if (typeof syncedEnergy === 'number') {
      energy.current = syncedEnergy;
    }

    const body = bodyRef.current;
    const ball = ballBodyRef.current;
    const gs = gameStore.getState();
    const phase = gs.phase;
    if (!body) {
      beamPullActive.current = false;
      return;
    }

    if (bot.combat.isRagdoll) {
      beamPullActive.current = false;
      if (tickBotRagdoll(bot, body)) return;
      forceCharacterUpright(
        body,
        {
          visual: visualRef.current,
          tilt: tiltRef.current,
          bob: bobRef.current,
          pitchSmooth,
          bobPhase,
        },
        bot.visualRecovery,
        knockTumble.current,
      );
    }

    const tEarly = body.translation();
    _pos.set(tEarly.x, tEarly.y, tEarly.z);
    _chest.set(tEarly.x, tEarly.y + BEAM.chestHeight, tEarly.z);
    _playerChest.copy(playerChestRef.current);
    const playerBodyEarly = playerBodyRef.current;
    if (playerBodyEarly) {
      const pv = playerBodyEarly.linvel();
      _playerVel.set(pv.x, pv.y, pv.z);
    } else {
      _playerVel.set(0, 0, 0);
    }

    const knockTick = tickBotKnockStun(body, bot.combat);
    if (knockTick === 'ended') {
      knockStunWasActive.current = false;
      forceCharacterUpright(
        body,
        {
          visual: visualRef.current,
          tilt: tiltRef.current,
          bob: bobRef.current,
          pitchSmooth,
          bobPhase,
        },
        bot.visualRecovery,
        knockTumble.current,
      );
    }
    if (knockTick === 'active') {
      if (!knockStunWasActive.current) {
        impulseKnockVisualTumble(knockTumble.current);
      }
      knockStunWasActive.current = true;
      tickKnockVisualTumble(knockTumble.current, dt);
      beamPullActive.current = false;
      const knockNowSec = performance.now() / 1000;
      if (isBotRetaliationActive(bot.retaliation, knockNowSec)) {
        applyBotRetaliationAim(
          _chest,
          bot.retaliation,
          allBots,
          _playerChest,
          _playerVel,
          _lookTarget,
          _lookDir,
          yaw,
          pitch,
          dt,
        );
      }
      alignCharacterVisualUpright(
        body,
        {
          visual: visualRef.current,
          tilt: tiltRef.current,
          bob: bobRef.current,
          pitchSmooth,
          bobPhase,
        },
        yaw.current,
        knockTumble.current,
        pitch.current,
      );
      return;
    }
    knockStunWasActive.current = false;

    const tune = tuningStore.getState();
    const botScalars = getBotPressureScalars();
    airGrace.current = Math.max(0, airGrace.current - dt);
    const t = body.translation();
    _pos.set(t.x, t.y, t.z);
    _chest.set(t.x, t.y + BEAM.chestHeight, t.z);
    if (!stuckState.current) {
      stuckState.current = createBotStuckState(_pos.x, _pos.z);
    }

    const nowSecKick = performance.now() / 1000;
    tickKickoffState(
      phase,
      gs.countdown,
      nowSecKick,
      allBots.map((b) => ({ id: b.id, team: b.team })),
    );

    if (phase === 'playing' && isKickoffAllyOopReturningHome(bot.id)) {
      beamPullActive.current = false;
      getKickoffAllyOopReturnCenter(feetY, _moveTarget);
      _wish.set(_moveTarget.x - _pos.x, 0, _moveTarget.z - _pos.z);
      const distHome = _wish.length();
      if (distHome > 0.05) _wish.normalize();

      const linvelHome = body.linvel();
      updateBotGrounded(
        _pos.y,
        linvelHome.y,
        airGrace.current,
        grounded,
        jumpsLeft,
        wasGrounded,
      );

      const homeSpeed = BOT.sprintSpeed * tune.botWalkSpeedScale;
      velocity.current.x = THREE.MathUtils.lerp(
        velocity.current.x,
        _wish.x * homeSpeed,
        BOT.groundAccel * dt,
      );
      velocity.current.z = THREE.MathUtils.lerp(
        velocity.current.z,
        _wish.z * homeSpeed,
        BOT.groundAccel * dt,
      );

      getKickoffBallAimPoint(_kickoffAim);
      smoothAimToward(yaw, pitch, _chest, _kickoffAim, dt);
      writeLookDirection(yaw.current, pitch.current, _lookDir);

      let vyHome = linvelHome.y;
      vyHome += tune.gravity * dt;
      velocity.current.y = vyHome;
      body.setLinvel(
        {
          x: velocity.current.x,
          y: velocity.current.y,
          z: velocity.current.z,
        },
        true,
      );
      applyBotVisual(linvelHome, dt);

      if (distHome <= BOT.kickoffAllyOopReturnArriveDist) {
        clearKickoffAllyOopReturnHome(bot.id);
      }
      return;
    }

    if (
      phase === 'playing' &&
      isKickoffAllyOopBot(bot.id, nowSecKick) &&
      gs.ballHolderId !== bot.id
    ) {
      beamPullActive.current = false;
      const holderOop = gs.ballHolderId;
      pickAllyDunkSpot(bot.team, _pos, _moveTarget);
      clampAllyDunkMoveTarget(_moveTarget, bot.team);
      clampMoveTargetFromBackWall(_moveTarget, bot.team);
      _wish.set(_moveTarget.x - _pos.x, 0, _moveTarget.z - _pos.z);
      const distSpot = _wish.length();
      if (distSpot > 0.05) _wish.normalize();

      const linvelOop = body.linvel();
      updateBotGrounded(
        _pos.y,
        linvelOop.y,
        airGrace.current,
        grounded,
        jumpsLeft,
        wasGrounded,
      );

      const holderChestOop = getFriendlyHolderChest(
        holderOop,
        bot,
        allBots,
        gs.localTeam,
        _playerChest,
        _opponentChest,
      );
      const teammateHasBall =
        holderChestOop !== null && holderOop !== null && holderOop !== bot.id;
      const playerPassToRim =
        holderOop === 'local' && teammateHasBall;
      const distGoalOop = getDistToBottomRingMouth(
        _chest.x,
        _chest.y,
        _chest.z,
        bot.team,
      );
      const atRim =
        distGoalOop <= BOT.allyDunkPrepDist && distSpot < BOT.kickoffAllyOopSpotRadius;

      if (atRim) {
        noteKickoffAllyOopAtRim(bot.id, nowSecKick);
      }
      if (kickoffAllyOopPassWaitExceeded(bot.id, nowSecKick)) {
        beginKickoffAllyOopReturnHome(bot.id);
        return;
      }

      const oopSpeed =
        (atRim && teammateHasBall ? BOT.walkSpeed : BOT.sprintSpeed) *
        tune.botWalkSpeedScale;
      velocity.current.x = THREE.MathUtils.lerp(
        velocity.current.x,
        _wish.x * oopSpeed,
        BOT.groundAccel * dt,
      );
      velocity.current.z = THREE.MathUtils.lerp(
        velocity.current.z,
        _wish.z * oopSpeed,
        BOT.groundAccel * dt,
      );

      getKickoffBallAimPoint(_kickoffAim);
      if (teammateHasBall && holderChestOop) {
        _kickoffAim.set(holderChestOop.x, holderChestOop.y + 1.2, holderChestOop.z);
      }
      smoothAimToward(yaw, pitch, _chest, _kickoffAim, dt);
      writeLookDirection(yaw.current, pitch.current, _lookDir);

      let vyOop = linvelOop.y;
      if (
        grounded.current &&
        jumpsLeft.current > 0 &&
        teammateHasBall &&
        atRim &&
        (playerPassToRim ||
          Math.random() < BOT.allyDunkPreJumpChance * dt * 3.2 ||
          Math.random() < BOT.kickoffAllyOopJumpChance)
      ) {
        const jumpScale = playerPassToRim
          ? BOT.allyDunkCatchJumpScale
          : BOT.dunkJumpForceScale;
        vyOop = botApplyJump(
          body,
          feetY,
          tune.jumpForce * jumpScale,
          linvelOop,
          velocity,
          airGrace,
          grounded,
          jumpsLeft,
        );
        doubleJumpPending.current = jumpsLeft.current > 0;
        if (doubleJumpPending.current) {
          doubleJumpDelay.current = BOT.doubleJumpDelaySec * 0.55;
        }
      } else if (
        grounded.current &&
        jumpsLeft.current > 0 &&
        !atRim &&
        distSpot < 3 &&
        Math.random() < 0.08 * dt * 3
      ) {
        vyOop = botApplyJump(
          body,
          feetY,
          tune.jumpForce * 0.9,
          linvelOop,
          velocity,
          airGrace,
          grounded,
          jumpsLeft,
        );
      }

      if (doubleJumpPending.current && airGrace.current > 0.12) {
        doubleJumpDelay.current -= dt;
        if (doubleJumpDelay.current <= 0 && jumpsLeft.current > 0) {
          doubleJumpPending.current = false;
          vyOop = botApplyJump(
            body,
            feetY,
            tuningStore.getDoubleJumpForce(),
            linvelOop,
            velocity,
            airGrace,
            grounded,
            jumpsLeft,
          );
        }
      }

      vyOop += tune.gravity * dt;
      velocity.current.y = vyOop;
      body.setLinvel(
        {
          x: velocity.current.x,
          y: velocity.current.y,
          z: velocity.current.z,
        },
        true,
      );
      applyBotVisual(linvelOop, dt);
      return;
    }

    if (
      phase === 'playing' &&
      gs.ballHolderId === bot.id &&
      (isKickoffAllyOopBot(bot.id, nowSecKick) ||
        isKickoffAllyOopReturningHome(bot.id))
    ) {
      endKickoffAllyOopForBot(bot.id);
    }

    if (
      phase === 'playing' &&
      gs.countdown > 0 &&
      !gs.ballFrozen &&
      gs.lastScoringTeam === bot.team &&
      !isKickoffAllyOopBot(bot.id, nowSecKick)
    ) {
      beamPullActive.current = false;
      _center.set(BOT.celebrateCenterX, _pos.y, BOT.celebrateCenterZ);
      _wish.set(_center.x - _pos.x, 0, _center.z - _pos.z);
      const distCenter = _wish.length();
      if (distCenter > 0.05) _wish.normalize();

      const linvel = body.linvel();
      updateBotGrounded(
        _pos.y,
        linvel.y,
        airGrace.current,
        grounded,
        jumpsLeft,
        wasGrounded,
      );

      const celebrateSpeed = BOT.sprintSpeed;
      velocity.current.x = THREE.MathUtils.lerp(
        velocity.current.x,
        _wish.x * celebrateSpeed,
        BOT.groundAccel * dt,
      );
      velocity.current.z = THREE.MathUtils.lerp(
        velocity.current.z,
        _wish.z * celebrateSpeed,
        BOT.groundAccel * dt,
      );

      let vy = linvel.y;
      if (
        grounded.current &&
        distCenter < BOT.celebrateRadius &&
        jumpsLeft.current > 0
      ) {
        vy = BOT.jumpForce;
        jumpsLeft.current -= 1;
        grounded.current = false;
        airGrace.current = 0.5;
      } else if (
        grounded.current &&
        distCenter > 2 &&
        jumpsLeft.current > 0 &&
        Math.random() < 0.12 * dt * 3
      ) {
        vy = BOT.jumpForce * 0.95;
        jumpsLeft.current -= 1;
        grounded.current = false;
        airGrace.current = 0.45;
      }
      vy += tune.gravity * dt;
      velocity.current.y = vy;
      body.setLinvel(
        { x: velocity.current.x, y: velocity.current.y, z: velocity.current.z },
        true,
      );
      applyBotVisual(linvel, dt, body);
      return;
    }

    if (
      isKickoffContestPhase(phase, gs.countdown, gs.ballFrozen) &&
      !isKickoffAllyOopBot(bot.id, nowSecKick)
    ) {
      beamPullActive.current = false;
      getKickoffBallAimPoint(_kickoffAim);
      pickKickoffContestMoveTarget(bot.id, feetY, _kickoffAim, _moveTarget);
      _wish.set(
        _moveTarget.x - _pos.x,
        _moveTarget.y - _pos.y,
        _moveTarget.z - _pos.z,
      );
      const distDrop = _wish.length();
      if (distDrop > 0.05) _wish.normalize();

      const linvelKick = body.linvel();
      updateBotGrounded(
        _pos.y,
        linvelKick.y,
        airGrace.current,
        grounded,
        jumpsLeft,
        wasGrounded,
      );

      const contestSpeed = kickoffContestSprintSpeed() * tune.botWalkSpeedScale;
      velocity.current.x = THREE.MathUtils.lerp(
        velocity.current.x,
        _wish.x * contestSpeed,
        BOT.groundAccel * dt,
      );
      velocity.current.z = THREE.MathUtils.lerp(
        velocity.current.z,
        _wish.z * contestSpeed,
        BOT.groundAccel * dt,
      );

      smoothAimToward(yaw, pitch, _chest, _kickoffAim, dt, BOT.aimSmoothing * 1.15);
      writeLookDirection(yaw.current, pitch.current, _lookDir);

      const horizToAim = kickoffContestHorizDistToAim(
        _chest.x,
        _chest.z,
        _kickoffAim,
      );
      const gapToBall = _kickoffAim.y - _chest.y;

      let vyKick = linvelKick.y;
      kickoffContestJumpTimer.current -= dt;
      if (
        kickoffContestJumpTimer.current <= 0 &&
        kickoffContestShouldJump(
          _chest.y,
          _kickoffAim.y,
          horizToAim,
          grounded.current,
          jumpsLeft.current,
        )
      ) {
        kickoffContestJumpTimer.current =
          BOT.kickoffContestJumpIntervalSec * (0.75 + Math.random() * 0.4);
        vyKick = botApplyJump(
          body,
          feetY,
          kickoffContestJumpForce(tune.jumpForce),
          linvelKick,
          velocity,
          airGrace,
          grounded,
          jumpsLeft,
        );
        doubleJumpPending.current = kickoffContestShouldDoubleJump(
          _chest.y,
          _kickoffAim.y,
          horizToAim,
        );
        if (doubleJumpPending.current) {
          doubleJumpDelay.current = BOT.doubleJumpDelaySec * 0.32;
        }
      }

      if (doubleJumpPending.current && airGrace.current > 0.08) {
        doubleJumpDelay.current -= dt;
        if (
          doubleJumpDelay.current <= 0 &&
          jumpsLeft.current > 0 &&
          kickoffContestShouldDoubleJump(_chest.y, _kickoffAim.y, horizToAim)
        ) {
          doubleJumpPending.current = false;
          vyKick = botApplyJump(
            body,
            feetY,
            kickoffContestJumpForce(tuningStore.getDoubleJumpForce()),
            linvelKick,
            velocity,
            airGrace,
            grounded,
            jumpsLeft,
          );
        }
      } else if (grounded.current && airGrace.current <= 0.06) {
        doubleJumpPending.current = false;
      }

      if (
        !grounded.current &&
        horizToAim < BOT.kickoffContestReachHorizM &&
        gapToBall > 2.5 &&
        vyKick < 6
      ) {
        vyKick += BOT.kickoffContestClimbAccel * dt;
      }

      vyKick += tune.gravity * dt;
      velocity.current.y = vyKick;
      body.setLinvel(
        {
          x: velocity.current.x,
          y: velocity.current.y,
          z: velocity.current.z,
        },
        true,
      );
      applyBotVisual(linvelKick, dt);
      return;
    }

    if (phase !== 'playing') {
      beamPullActive.current = false;
      return;
    }

    const holder = gs.ballHolderId;
    const iHold = holder === bot.id;
    if (iHold) bot.holdingBall = true;

    _playerChest.copy(playerChestRef.current);
    const playerBody = playerBodyRef.current;
    if (playerBody) {
      const pv = playerBody.linvel();
      _playerVel.set(pv.x, pv.y, pv.z);
    } else {
      _playerVel.set(0, 0, 0);
    }
    getEnemyGoalTarget(bot.team, _goal);

    if (ball) {
      const bt = ball.translation();
      _ballPos.set(bt.x, bt.y, bt.z);
      const bv = ball.linvel();
      _ballVel.set(bv.x, bv.y, bv.z);
    } else {
      _ballPos.set(0, 0, 0);
      _ballVel.set(0, 0, 0);
    }

    const ballState = gs.ballState;

    const otherBotPos = getNearestOtherBotPosition(bot, allBots, _otherBotPos);
    const linvel = body.linvel();
    updateBotGrounded(
      _pos.y,
      linvel.y,
      airGrace.current,
      grounded,
      jumpsLeft,
      wasGrounded,
    );

    const localTeam = gs.localTeam;
    const distBall = _chest.distanceTo(_ballPos);
    const distGoal = getDistToBottomRingMouth(
      _chest.x,
      _chest.y,
      _chest.z,
      bot.team,
    );
    const now = performance.now() / 1000;
    const beamLocked = now < bot.beamLockUntil;
    const ballGrabLocked = now < bot.ballDenyUntil;
    const regrabLocked = now < bot.beamRegrabUntil;
    const denyHere =
      isBeamDenied(_chest.x, _chest.y, _chest.z) ||
      isBeamDenied(_ballPos.x, _ballPos.y, _ballPos.z);

    if (!iHold) {
      allyDunkCatchHold.current = false;
      resetCarryLookState(carryLookState.current);
      holdSocketSmoothReady.current = false;
      holdFarAction.current = null;
      holdReleasePlan.current = null;
    }

    if (iHold && ball) {
      beamPullActive.current = false;
      if (ball.bodyType() !== 2) {
        writeLookDirection(yaw.current, pitch.current, _lookDir);
        holdLatchT.current = 0;
        holdSocketSmoothed.current.copy(_ballPos);
        holdSocketSmoothReady.current = true;
        captureBallSocket(ball, holdSocketSmoothed.current, _ballPos);
      }
      const teammateChest = getTeammateChest(
        bot,
        allBots,
        localTeam,
        _playerChest,
        _playerVel,
        _shootTarget,
        _teammateVel,
      );
      const hasTeammate = teammateChest !== null;

      holdTimer.current += dt;
      passCooldown.current -= dt;
      holdFarActionTimer.current -= dt;

      energy.current = Math.max(
        0,
        energy.current - BOT.holdBallEnergyDrain * dt,
      );
      botEnergyLevelsRef.current[bot.id] = energy.current;
      if (energy.current <= 0) {
        releaseBotBall(bot, ball, true);
        applyBotVisual(linvel, dt, body);
        return;
      }

      const inShootZone = isInsideShootZone(_pos.x, _pos.z, bot.team);
      const nearGoal =
        inShootZone || distGoal <= BOT.goalQuickShotDist;

      const prevHoldPhase = holdPhase.current;
      holdPhase.current = updateHoldPhase(
        holdPhase.current,
        distGoal,
        holdTimer.current,
        setupJumped.current,
        setupEnterSec.current,
        inShootZone,
      );
      if (holdPhase.current === 'setup' && prevHoldPhase === 'advance') {
        setupEnterSec.current = holdTimer.current;
        setupJumped.current = false;
        setupDoubleJumped.current = false;
        shotStyle.current = rollBotShotStyle(inShootZone, distGoal);
      }

      if (modeRef.current === 'allyDunk') {
        allyDunkCatchHold.current = true;
      }

      holdReleasePlan.current = ensureHoldReleasePlan(
        holdTimer.current,
        hasTeammate,
        holdReleasePlan.current,
        allyDunkCatchHold.current,
      );

      let releaseKind = resolveTimedBotHoldRelease(
        holdTimer.current,
        hasTeammate,
        inShootZone,
        holdReleasePlan.current,
        distGoal,
      );
      if (holdPhase.current === 'shoot') {
        releaseKind =
          distGoal > BOT.farHoldLoftMinDist &&
          Math.random() < BOT.farHoldLoftShotChance
            ? 'loft'
            : 'shoot';
      }
      if (
        releaseKind &&
        shotStyle.current === 'dunk' &&
        !setupJumped.current
      ) {
        releaseKind = null;
      }

      if (releaseKind) {
        const doPass =
          releaseKind === 'pass' &&
          teammateChest !== null &&
          passCooldown.current <= 0;
        const launchKind: BotLaunchKind = doPass
          ? 'pass'
          : releaseKind === 'loft'
            ? 'loft'
            : 'shoot';

        if (doPass) {
          pickTeammatePassTarget(
            _chest,
            teammateChest,
            _teammateVel,
            _shootTarget,
          );
          passCooldown.current = BOT.passToTeammateCooldownSec;
        } else if (launchKind === 'loft') {
          pickBotLoftLaunchTarget(
            bot.team,
            shotIndex.current,
            _shootTarget,
            _chest,
          );
        } else {
          pickBotStyledLaunchTarget(
            shotStyle.current,
            bot.team,
            shotIndex.current,
            _shootTarget,
            _chest,
          );
        }

        executeBotHoldRelease(
          bot,
          ball,
          body,
          _chest,
          _shootTarget,
          launchKind,
          dt,
          yaw,
          pitch,
          _lookDir,
          launchKind === 'pass' ? 'normal' : shotStyle.current,
        );
        if (launchKind === 'shoot') {
          energy.current = 0;
        }
        holdFarAction.current = null;
        shotIndex.current += 1;
        holdPhase.current = 'advance';
        setupJumped.current = false;
        setupEnterSec.current = 0;
        holdTimer.current = 0;
        holdReleasePlan.current = null;
        shotStyle.current = 'normal';
        airGrace.current = BOT.jumpAirGraceSec * 0.35;
        applyBotVisual(linvel, dt, body);
        return;
      }

      const think = {
        id: bot.id,
        role,
        team: bot.team,
        localTeam,
        isEnemy: isEnemyBot,
        pos: _pos,
        ballPos: _ballPos,
        playerChest: _playerChest,
        goal: _goal,
        otherBotPos,
        ballHolder: holder,
        ballVel: _ballVel,
        ballState,
        holdingBall: true,
        holdSec: holdTimer.current,
        holdPhase: holdPhase.current,
        grounded: grounded.current,
        inBeamRange: false,
        beamDenied: denyHere,
      };

      const opponentChest = getOpponentChest(
        bot,
        allBots,
        localTeam,
        _playerChest,
        _opponentChest,
      );

      const mode = pickBotMode(think);
      modeRef.current = mode;
      pickMoveTarget(mode, think, _moveTarget);
      if (nearGoal || inShootZone) {
        pickBotGoalOffenseMoveTarget(
          bot.team,
          shotStyle.current,
          holdPhase.current,
          setupJumped.current,
          _pos,
          _moveTarget,
        );
      }
      clampMoveTargetFromBackWall(_moveTarget, bot.team);
      const dribbleToTeammate =
        !nearGoal &&
        (mode === 'carryToGoal' || mode === 'setupShot') &&
        holdCarryFocus.current === 'teammate' &&
        teammateChest;
      if (dribbleToTeammate) {
        _moveTarget.copy(teammateChest);
        _moveTarget.y = Math.max(_moveTarget.y, _goal.y);
        clampMoveTargetFromBackWall(_moveTarget, bot.team);
      }
      carryLookState.current.preferTeammateLook =
        !nearGoal && holdCarryFocus.current === 'teammate';
      updateCarryLook(
        carryLookState.current,
        mode as 'carryToGoal' | 'setupShot' | 'shootGoal',
        _goal,
        teammateChest,
        opponentChest,
        distGoal,
        dt,
        _lookTarget,
      );

      const carryAimSmooth =
        mode === 'shootGoal' ? BOT.aimSmoothing : BOT.carryAimSmoothing;
      smoothAimToward(yaw, pitch, _chest, _lookTarget, dt, carryAimSmooth);
      writeLookDirection(yaw.current, pitch.current, _lookDir);

      _wish.set(_moveTarget.x - _pos.x, 0, _moveTarget.z - _pos.z);
      if (_wish.lengthSq() > 0.01) _wish.normalize();
      collectBotSepPositions(allBots, _botSepScratch);
      applyAllBotSeparation(
        _wish,
        _pos,
        bot.id,
        bot.team,
        _botSepScratch,
        isInsideShootZone(_pos.x, _pos.z, bot.team),
      );

      const wallEscapeJump = applyBotMovementEscape(
        _pos,
        _wish,
        velocity.current,
        stuckState.current!,
        dt,
        bot.team,
      );

      const holdSpeed =
        mode === 'setupShot'
          ? BOT.walkSpeed * 0.65
          : BOT.sprintSpeed * BOT.holdSprintSpeedScale;

      velocity.current.x = THREE.MathUtils.lerp(
        velocity.current.x,
        _wish.x * holdSpeed,
        BOT.groundAccel * dt,
      );
      velocity.current.z = THREE.MathUtils.lerp(
        velocity.current.z,
        _wish.z * holdSpeed,
        BOT.groundAccel * dt,
      );

      let vy = linvel.y;

      const carryHopVy = tickBotJumpCycle(
        dt,
        body,
        feetY,
        linvel,
        tune,
        BOT.carryJumpIntervalSec,
        jumpState,
        _wish.lengthSq() > 0.04,
        BOT.carryJumpChance,
      );
      if (carryHopVy !== null) vy = carryHopVy;
      else if (
        wallEscapeJump &&
        grounded.current &&
        jumpsLeft.current > 0
      ) {
        vy = botApplyJump(
          body,
          feetY,
          tune.jumpForce,
          linvel,
          velocity,
          airGrace,
          grounded,
          jumpsLeft,
        );
      } else if (
        shouldSetupJump(
          holdPhase.current,
          setupJumped.current,
          grounded.current,
          jumpsLeft.current,
        )
      ) {
        const jumpForce =
          shotStyle.current === 'dunk'
            ? tune.jumpForce * BOT.dunkJumpForceScale
            : tune.jumpForce;
        vy = botApplyJump(
          body,
          feetY,
          jumpForce,
          linvel,
          velocity,
          airGrace,
          grounded,
          jumpsLeft,
        );
        setupJumped.current = true;
        if (shotStyle.current === 'dunk') {
          setupDoubleJumped.current = false;
        }
      } else if (
        shotStyle.current === 'dunk' &&
        setupJumped.current &&
        !setupDoubleJumped.current &&
        jumpsLeft.current > 0 &&
        (holdPhase.current === 'setup' || holdPhase.current === 'shoot') &&
        !grounded.current &&
        airGrace.current > 0.05
      ) {
        const mouthDist = getDistToBottomRingMouth(
          _pos.x,
          _pos.y,
          _pos.z,
          bot.team,
        );
        if (mouthDist <= BOT.goalDunkMaxDist * 0.65) {
          vy = botApplyJump(
            body,
            feetY,
            tune.jumpForce * BOT.dunkJumpForceScale * 0.92,
            linvel,
            velocity,
            airGrace,
            grounded,
            jumpsLeft,
          );
          setupDoubleJumped.current = true;
        }
      }

      vy += tune.gravity * dt;
      velocity.current.y = vy;
      if (
        tickGoalEntryCharacterBounce(
          body,
          _pos.x,
          _pos.y + BEAM.chestHeight * 0.35,
          _pos.z,
          PLAYER_RIM_PROBE_RADIUS,
          tune.gravity,
          goalNetCooldown,
          goalRimCooldown,
          dt,
        )
      ) {
        velocity.current.set(body.linvel().x, body.linvel().y, body.linvel().z);
        grounded.current = false;
        airGrace.current = Math.max(airGrace.current, 0.2);
      }
      body.setLinvel(
        { x: velocity.current.x, y: velocity.current.y, z: velocity.current.z },
        true,
      );
      softenHexBoundaryVelocity(_pos, velocity.current);

      holdSocketSmoothReady.current = smoothHoldSocketTarget(
        holdSocketSmoothed.current,
        _chest,
        _lookDir,
        BEAM.holdDistance,
        BALL.radius,
        dt,
        BOT.holdSocketTargetSmooth,
        holdSocketSmoothReady.current,
        body,
      );
      holdLatchT.current = Math.min(
        1,
        holdLatchT.current + dt / BALL.holdLatchDurationSec,
      );
      updateBallSocketSmooth(
        ball,
        holdSocketSmoothed.current,
        dt,
        holdLatchT.current,
        BOT.holdBotFollowSmooth,
        world,
        body,
        _chest,
      );

      const bt = ball.translation();
      tryBallGoalScoreAtPoint({ x: bt.x, y: bt.y, z: bt.z }, ball);

      softenHexBoundaryVelocity(_pos, velocity.current);
      applyBotVisual(linvel, dt, body);
      return;
    }

    holdTimer.current = 0;
    holdReleasePlan.current = null;
    holdPhase.current = 'advance';
    if (holder !== bot.id) {
      bot.holdingBall = false;
    }

    const zonePositions = collectBotZonePositions(allBots, botZoneScratch.current);
    const teammateRelease = getTeammateReleaseIntent(bot.id, bot.team, now);
    const waitForTeammateShot = shouldWaitForTeammateShot(teammateRelease, now);
    const giveShootZoneSpace =
      !waitForTeammateShot &&
      teammateRelease?.kind !== 'pass' &&
      shouldGiveShootZoneSpace(
        shootZoneMagnetState.current,
        bot.id,
        bot.team,
        localTeam,
        holder,
        zonePositions,
        _ballPos.x,
        _ballPos.z,
      );

    const deferPlayerCarrierShot =
      isEnemyBot &&
      playerCarrierShotGate.current !== null &&
      tickEnemyPlayerCarrierShotGate(
        playerCarrierShotGate.current,
        holder,
        dt,
      );

    const holderChest = getFriendlyHolderChest(
      holder,
      bot,
      allBots,
      localTeam,
      _playerChest,
      _opponentChest,
    );
    const holderNearGoal =
      holderChest !== null &&
      isFriendlyHolderNearGoal(holderChest.x, holderChest.z, bot.team);
    const holderAimX = holderChest?.x ?? _playerChest.x;
    const holderAimZ = holderChest?.z ?? _playerChest.z;
    const teamAllyDunkPoster = isBotTeamAllyDunkPoster(
      bot.id,
      bot.team,
      holder,
      localTeam,
      allBots,
      holderAimX,
      holderAimZ,
    );
    const selfNearGoal = distGoal <= BOT.allyDunkPrepDist;
    const holderDistGoal =
      holderChest !== null
        ? getHolderDistGoal(holderChest.x, holderChest.z, bot.team)
        : Infinity;

    const think = {
      id: bot.id,
      role,
      team: bot.team,
      localTeam,
      isEnemy: isEnemyBot,
      pos: _pos,
      ballPos: _ballPos,
      playerChest: _playerChest,
      goal: _goal,
      otherBotPos,
      ballHolder: holder,
      ballVel: _ballVel,
      ballState,
      holdingBall: false,
      holdSec: 0,
      holdPhase: holdPhase.current,
      grounded: grounded.current,
      inBeamRange: distBall < BEAM.range,
      beamDenied: denyHere,
      giveShootZoneSpace,
      teammateReleaseKind: teammateRelease?.kind ?? null,
      waitForTeammateShot,
      deferPlayerCarrierShot,
      holderNearGoal,
      selfNearGoal,
    };

    const nowSec = performance.now() / 1000;
    let retaliating =
      !iHold && isBotRetaliationActive(bot.retaliation, nowSec);

    let mode = pickBotMode(think);
    if (retaliating) {
      mode = 'runToPlayer';
    } else if (isEnemyBot) {
      mode = gatePlayerChaseMode(
        mode,
        holder,
        think,
        playerChaseState.current,
        dt,
      );
    }
    if (ballGrabLocked && !iHold && holder === null && isBallGrabMode(mode)) {
      mode = stunnedBallFallbackMode(isEnemyBot, holder);
    }
    if (mode === 'allyDunk' && !teamAllyDunkPoster) {
      mode = holderNearGoal ? 'allyReceive' : 'allySupport';
    }
    if (
      isEnemyBot &&
      !retaliating &&
      !iHold &&
      !isPlayerChaseMode(mode)
    ) {
      mode = applyTeammateBallChaseMode(
        teammateBallChaseState.current,
        bot.id,
        bot.team,
        true,
        mode,
      );
    }
    modeRef.current = mode;
    setBotBallChaseActive(
      bot.id,
      bot.team,
      isEnemyBot && isBallChaseBroadcastMode(mode),
    );
    pickMoveTarget(mode, think, _moveTarget);
    if (mode === 'allyDunk') {
      pickAllyDunkSpot(bot.team, _pos, _moveTarget);
      clampAllyDunkMoveTarget(_moveTarget, bot.team);
    }
    clampMoveTargetFromBackWall(_moveTarget, bot.team);
    if (giveShootZoneSpace && shootZoneMagnetState.current.shooterId) {
      const shooter = zonePositions.find(
        (p) => p.id === shootZoneMagnetState.current.shooterId,
      );
      if (shooter) {
        pickGiveShootZoneSpaceTarget(
          _pos,
          shooter.x,
          shooter.z,
          _ballPos,
          _moveTarget,
        );
      }
    }
    if (retaliating) {
      applyBotRetaliationAim(
        _chest,
        bot.retaliation,
        allBots,
        _playerChest,
        _playerVel,
        _lookTarget,
        _lookDir,
        yaw,
        pitch,
        dt,
      );
      _moveTarget.copy(_lookTarget);
      _moveTarget.y = _pos.y;
    } else {
      pickLookTarget(mode, think, _moveTarget, _lookTarget);
    }

    if (retaliating) {
      if (
        tickBotRetaliation(
          bot.retaliation,
          dt,
          nowSec,
          yaw.current,
          pitch.current,
          _chest,
          _lookTarget,
          true,
        )
      ) {
        snapBotRetaliationAim(yaw, pitch, _chest, _lookTarget);
        writeLookDirection(yaw.current, pitch.current, _lookDir);
        botFireRocket(bot.id, body, _chest, _lookDir, onRocketFired, true);
      }

      if (!isBotRetaliationActive(bot.retaliation, nowSec)) {
        retaliating = false;
      }
    } else {
      smoothAimToward(yaw, pitch, _chest, _lookTarget, dt);
      writeLookDirection(yaw.current, pitch.current, _lookDir);
    }

    applyBotVisual(linvel, dt, body);

    if (
      isEnemyBot &&
      pendingEnemyRocketBot.current === bot.id &&
      !iHold
    ) {
      pendingEnemyRocketBot.current = null;
      if (
        shouldEnemyTeamRocketVolley(holder, localTeam) &&
        !deferPlayerCarrierShot
      ) {
        const volleyBotChest = getNearestEnemyBotChest(
          bot,
          allBots,
          _opponentChest,
          _opponentVel,
        );
        pickEnemyVolleyRocketTarget(
          _playerChest,
          _playerVel,
          _ballPos,
          _chest,
          holder,
          _shootTarget,
          volleyBotChest,
          _opponentVel,
        );
        smoothAimToward(yaw, pitch, _chest, _shootTarget, dt, BOT.aimSmoothing);
        writeBotRocketLook(yaw, pitch, _lookDir);
        botFireRocket(bot.id, body, _chest, _lookDir, onRocketFired);
      }
    }

    const inFollowPlayerMode =
      isEnemyBot && !iHold && !retaliating && isPlayerChaseMode(mode);

    if (inFollowPlayerMode && !deferPlayerCarrierShot) {
      followModeRocketCooldown.current = Math.max(
        0,
        followModeRocketCooldown.current - dt,
      );

      if (followModeRocketCooldown.current <= 0) {
        followProjectileTimer.current -= dt;
        followRocketTimer.current -= dt;

        let firedFollowRocket = false;
        if (followProjectileTimer.current <= 0) {
          followProjectileTimer.current =
            botScalars.followPlayerProjectileIntervalSec *
            (0.75 + Math.random() * 0.5);
          pickFollowPlayerProjectileTarget(
            _chest,
            _playerChest,
            _playerVel,
            _shootTarget,
          );
          smoothAimToward(yaw, pitch, _chest, _shootTarget, dt, BOT.aimSmoothing);
          writeBotRocketLook(yaw, pitch, _lookDir);
          botFireRocket(bot.id, body, _chest, _lookDir, onRocketFired, false);
          firedFollowRocket = true;
        } else if (
          followRocketTimer.current <= 0 &&
          Math.random() < botScalars.followPlayerRocketChance
        ) {
          followRocketTimer.current =
            botScalars.followPlayerRocketIntervalSec *
            (0.75 + Math.random() * 0.5);
          pickFollowPlayerProjectileTarget(
            _chest,
            _playerChest,
            _playerVel,
            _shootTarget,
          );
          smoothAimToward(yaw, pitch, _chest, _shootTarget, dt, BOT.aimSmoothing);
          writeBotRocketLook(yaw, pitch, _lookDir);
          botFireRocket(bot.id, body, _chest, _lookDir, onRocketFired, true);
          firedFollowRocket = true;
        }

        if (firedFollowRocket) {
          followModeRocketCooldown.current =
            botScalars.followPlayerRocketCooldownSec;
        }
      }
    } else {
      followModeRocketCooldown.current = 0;
    }

    if (
      !isEnemyBot &&
      !iHold &&
      !holder &&
      !retaliating &&
      shouldAllyReactSaveToOpponentShot(bot.id, bot.team, now)
    ) {
      pickAllySaveBallTarget(_ballPos, _ballVel, _shootTarget);
      smoothAimToward(yaw, pitch, _chest, _shootTarget, dt, BOT.aimSmoothing);
      writeBotRocketLook(yaw, pitch, _lookDir);
      botFireRocket(bot.id, body, _chest, _lookDir, onRocketFired);
    }

    projectileTimer.current -= dt;
    const allySupport = !isEnemyBot && holder === 'local';
    if (
      !isEnemyBot &&
      projectileTimer.current <= 0 &&
      !allySupport &&
      !iHold
    ) {
      projectileTimer.current = BOT.periodicProjectileIntervalSec;
      if (
        shouldBotAttemptProjectile(holder, bot.id, bot.team, localTeam)
      ) {
        if (holder !== 'local') {
          const enemyChest = getNearestEnemyBotChest(
            bot,
            allBots,
            _shootTarget,
            _playerVel,
          );
          pickAllyProjectileTarget(
            _chest,
            enemyChest,
            _playerVel,
            _ballPos,
            _shootTarget,
          );
        }
        smoothAimToward(yaw, pitch, _chest, _shootTarget, dt);
        writeBotRocketLook(yaw, pitch, _lookDir);
        botFireRocket(bot.id, body, _chest, _lookDir, onRocketFired);
      }
    }

    _wish.set(_moveTarget.x - _pos.x, 0, _moveTarget.z - _pos.z);
    if (_wish.lengthSq() > 0.01) _wish.normalize();
    if (
      (mode === 'attractBall' || mode === 'runToBall') &&
      !holder &&
      !iHold
    ) {
      const distApproach = Math.hypot(
        _moveTarget.x - _pos.x,
        _moveTarget.z - _pos.z,
      );
      if (
        mode === 'attractBall' &&
        distApproach < BOT.ballApproachArriveM
      ) {
        _wish.set(0, 0, 0);
      }
    }
    collectBotSepPositions(allBots, _botSepScratch);
    applyAllBotSeparation(
      _wish,
      _pos,
      bot.id,
      bot.team,
      _botSepScratch,
      isInsideShootZone(_pos.x, _pos.z, bot.team),
    );

    const wallEscapeJump = applyBotMovementEscape(
      _pos,
      _wish,
      velocity.current,
      stuckState.current!,
      dt,
      bot.team,
    );

    const sprint = modeSprint(mode) && !retaliating;
    let speed =
      (sprint ? BOT.sprintSpeed : BOT.walkSpeed) * tune.botWalkSpeedScale;
    if (retaliating) {
      speed *= BOT.retaliateMoveSpeedScale;
    }
    const control = grounded.current ? 1 : BOT.airControl;
    const targetVel = _wish.multiplyScalar(speed * control);
    const accel = grounded.current ? BOT.groundAccel : BOT.groundAccel * 0.6;
    if (grounded.current) {
      velocity.current.x = THREE.MathUtils.lerp(velocity.current.x, linvel.x, 0.2);
      velocity.current.z = THREE.MathUtils.lerp(velocity.current.z, linvel.z, 0.2);
    }
    velocity.current.x = THREE.MathUtils.lerp(velocity.current.x, targetVel.x, accel * dt);
    velocity.current.z = THREE.MathUtils.lerp(velocity.current.z, targetVel.z, accel * dt);

    let vy = linvel.y;
    const passToMe =
      teammateRelease?.kind === 'pass' &&
      nowSec - teammateRelease.at < 1.35;
    const lobIncoming =
      !holder &&
      mode === 'allyDunk' &&
      isBallPassingToAlly(_ballPos, _ballVel, _chest);
    const holderSettingUp =
      holderNearGoal &&
      holder !== null &&
      holder !== bot.id &&
      isHolderSettingUpShot(
        holderChest !== null &&
          isInsideShootZone(holderChest.x, holderChest.z, bot.team),
        holderDistGoal,
      );
    const playerLobToPoster =
      holder === 'local' && (lobIncoming || passToMe);
    const allyDunkLeap =
      mode === 'allyDunk' &&
      jumpsLeft.current > 0 &&
      (lobIncoming ||
        passToMe ||
        (holderSettingUp && grounded.current));
    if (
      allyDunkLeap &&
      grounded.current &&
      (playerLobToPoster ||
        lobIncoming ||
        passToMe ||
        Math.random() < BOT.allyDunkPreJumpChance * dt * 2.8)
    ) {
      const leapChance =
        lobIncoming || passToMe ? BOT.allyDunkLeapOnPassChance : 1;
      if (playerLobToPoster || Math.random() < leapChance) {
        const jumpScale = playerLobToPoster
          ? BOT.allyDunkCatchJumpScale
          : BOT.dunkJumpForceScale;
        vy = botApplyJump(
          body,
          feetY,
          tune.jumpForce * jumpScale,
          linvel,
          velocity,
          airGrace,
          grounded,
          jumpsLeft,
        );
        if (lobIncoming || passToMe) {
          doubleJumpPending.current = jumpsLeft.current > 0;
          doubleJumpDelay.current = BOT.doubleJumpDelaySec * 0.55;
        }
      }
    }

    const ballAbove =
      grounded.current &&
      _ballPos.y > _chest.y + 0.75 &&
      distBall < BEAM.range &&
      (mode === 'runToBall' || mode === 'attractBall' || mode === 'allySupport');

    const fieldMoving = _wish.lengthSq() > 0.04;
    const jumpInterval = BOT.chaseJumpIntervalSec;

    if (
      ballAbove &&
      jumpsLeft.current > 0 &&
      Math.random() < BOT.ballAboveJumpChance
    ) {
      vy = botApplyJump(
        body,
        feetY,
        tune.jumpForce,
        linvel,
        velocity,
        airGrace,
        grounded,
        jumpsLeft,
      );
      doubleJumpPending.current =
        Math.random() < BOT.chaseDoubleJumpChance;
      if (doubleJumpPending.current) {
        doubleJumpDelay.current = BOT.doubleJumpDelaySec;
      }
      groundJumpTimer.current =
        jumpInterval * (0.85 + Math.random() * BOT.jumpIntervalJitter);
    } else {
      const hopVy = tickBotJumpCycle(
        dt,
        body,
        feetY,
        linvel,
        tune,
        jumpInterval,
        jumpState,
        fieldMoving,
        BOT.chaseJumpChance,
      );
      if (hopVy !== null) vy = hopVy;
    }

    if (
      wallEscapeJump &&
      grounded.current &&
      jumpsLeft.current > 0 &&
      vy === linvel.y
    ) {
      vy = botApplyJump(
        body,
        feetY,
        tune.jumpForce,
        linvel,
        velocity,
        airGrace,
        grounded,
        jumpsLeft,
      );
    }

    vy += tune.gravity * dt;
    velocity.current.y = vy;
    if (
      tickGoalEntryCharacterBounce(
        body,
        _pos.x,
        _pos.y + BEAM.chestHeight * 0.35,
        _pos.z,
        PLAYER_RIM_PROBE_RADIUS,
        tune.gravity,
        goalNetCooldown,
        goalRimCooldown,
        dt,
      )
    ) {
      velocity.current.set(body.linvel().x, body.linvel().y, body.linvel().z);
      grounded.current = false;
      airGrace.current = Math.max(airGrace.current, 0.2);
    }
    body.setLinvel(
      { x: velocity.current.x, y: velocity.current.y, z: velocity.current.z },
      true,
    );
    softenHexBoundaryVelocity(_pos, velocity.current);

    const allyBeamOk =
      isEnemyBot ||
      canAllyBeamLooseBall(holder, _ballPos, _ballVel);

    const beaming =
      !!ball &&
      holder === null &&
      !waitForTeammateShot &&
      !giveShootZoneSpace &&
      allyBeamOk &&
      modeWantsBeam(mode) &&
      distBall < BEAM.range &&
      distBall <= BALL.radius * BOT.ballAttractBallRadii &&
      !beamLocked &&
      !ballGrabLocked &&
      !regrabLocked &&
      !denyHere &&
      energy.current > ENERGY.minBeam;

    beamPullActive.current = beaming;
    if (beaming) {
      beamFrom.current.copy(_chest);
      beamTraceBallAnchor(_ballPos, _chest, beamTo.current);
    }

    if (beaming && ball) {
      energy.current = Math.max(0, energy.current - ENERGY.beamDrain * dt);
      const { grabDist, chestDist } = beamGrabDistance(_ballPos, _chest, _pos);
      if (grabDist < BEAM.range) {
        const scalars = getBotPressureScalars();
        const pullScale =
          (isEnemyBot
            ? scalars.enemyBeamPullScale
            : bot.id === 'bot-2'
              ? scalars.allyBeamPullScale
              : scalars.beamPullScale) * tune.pullStrength;
        const pull = applyBeamAttraction(
          ball,
          _ballPos,
          _chest,
          dt,
          pullScale,
        );
        if (pull.pullWeight > 0) {
          recordBeamPull(bot.team, pull.pullWeight);
        }
        botBeamCaptureT.current += dt;
        if (
          botBeamCaptureT.current >= tune.botBeamCaptureLatchSec &&
          canCaptureWithContest(
            bot.team,
            pull.analysis,
            grabDist,
            true,
            chestDist,
          )
        ) {
          botBeamCaptureT.current = 0;
          holdLatchT.current = 0;
          holdSocketSmoothed.current.copy(_ballPos);
          holdSocketSmoothReady.current = true;
          captureBallSocket(ball, holdSocketSmoothed.current, _ballPos);
          bot.holdingBall = true;
          gameStore.setBallHolder(bot.id);
          gameStore.setBallState('held');
          holdTimer.current = 0;
          holdPhase.current = 'advance';
          setupJumped.current = false;
          setupEnterSec.current = 0;
          holdFarAction.current = null;
          holdFarActionTimer.current = 0;
          passCooldown.current = 0;
          const tmOnGrab =
            getTeammateChest(
              bot,
              allBots,
              localTeam,
              _playerChest,
              _playerVel,
              _shootTarget,
              _teammateVel,
            ) !== null;
          holdCarryFocus.current = pickBotHoldCarryFocus(
            tmOnGrab,
            distGoal,
            bot.id,
          );
          holdReleasePlan.current =
            bot.id === 'bot-2' &&
            tmOnGrab &&
            Math.random() < BOT.allyPassToPlayerChance
              ? 'pass'
              : null;
          resetCarryLookState(carryLookState.current);
          carryLookState.current.preferTeammateLook =
            holdCarryFocus.current === 'teammate';
          shotIndex.current =
            bot.id === 'bot-0' ? 0 : bot.id === 'bot-1' ? 1 : 2;
          groundJumpTimer.current = 0.2;
          airGrace.current = Math.max(airGrace.current, 0.45);
          writeLookDirection(yaw.current, pitch.current, _lookDir);
          holdLatchT.current = 0;
        } else if (pull.applied) {
          gameStore.setBallState('pulled');
        }
      } else {
        botBeamCaptureT.current = 0;
      }
    } else {
      botBeamCaptureT.current = 0;
      if (energy.current < ENERGY.max) {
        energy.current = Math.min(
          ENERGY.max,
          energy.current + ENERGY.regen * 0.85 * dt,
        );
      }
    }

    botEnergyLevelsRef.current[bot.id] = energy.current;
  });

  return (
    <>
      <BeamPullTrace
        active={() => beamPullActive.current}
        from={() => beamFrom.current}
        to={() => beamTo.current}
        team={isEnemyBot ? 'enemy' : bot.team}
      />
      <VelocityPathRibbon
        opacity={0.22}
        maxPoints={10}
        minStep={0.32}
        samplePosition={() => {
          const b = bodyRef.current;
          if (!b) return null;
          const t = b.translation();
          trailPos.current.set(t.x, t.y + BEAM.chestHeight * 0.45, t.z);
          return trailPos.current;
        }}
      />
      <RigidBody
        ref={bodyRef}
        colliders={false}
        mass={12}
        lockRotations
        gravityScale={0}
        ccd
        position={[bot.spawn.x, bot.spawn.y, bot.spawn.z]}
        userData={{
          character: true,
          hitTarget: true,
          actorId: bot.id as ActorId,
        }}
      >
        <CapsuleCollider
          args={[capHalfH, MOVEMENT.capsuleRadius]}
          position={[0, capCenterY, 0]}
          friction={0.85}
          collisionGroups={interactionGroups(0, [0, 1, 2, 4])}
        />
        <group ref={visualRef} position={[0, capCenterY, 0]}>
          <group ref={tiltRef}>
            <group ref={bobRef}>
              <group renderOrder={CHARACTER_MESH_RENDER_ORDER}>
                <PlayerAvatar rotationY={0} team={bot.team} />
                <DroneThrusterFlames team={bot.team} />
                <TeamOrb team={bot.team} combat={bot.combat} />
              </group>
            </group>
          </group>
        </group>
      </RigidBody>
      <GroundJerseyDecal
        bodyRef={bodyRef}
        jerseyNumber={getJerseyNumber(bot.id)}
        fillColor="#b8f4ff"
      />
    </>
  );
}

function EnemyRocketVolley({
  bots,
  pendingEnemyRocketBot,
}: {
  bots: BotRuntime[];
  pendingEnemyRocketBot: React.MutableRefObject<BotId | null>;
}) {
  const timer = useRef<number>(BOT.enemyRocketVolleyIntervalSec);

  useFrame((_, dt) => {
    const gs = gameStore.getState();
    if (!gs.botsEnabled || gs.phase !== 'playing') return;

    const botScalars = getBotPressureScalars();
    timer.current -= dt;
    if (timer.current > 0) return;
    timer.current = botScalars.enemyRocketVolleyIntervalSec;

    if (Math.random() >= botScalars.enemyRocketVolleyChance) return;
    if (!shouldEnemyTeamRocketVolley(gs.ballHolderId, gs.localTeam)) return;

    const enemies = bots.filter(
      (b) => b.team !== gs.localTeam && !b.combat.isRagdoll,
    );
    if (enemies.length === 0) return;

    const shooter = enemies[Math.floor(Math.random() * enemies.length)];
    pendingEnemyRocketBot.current = shooter.id;
  });

  return null;
}

export function Bots({
  botsRef,
  ballBodyRef,
  playerChestRef,
  playerBodyRef,
  onRocketFired,
  botEnergyLevelsRef,
  onBotRagdollBurst,
}: BotsProps) {
  const pendingEnemyRocketBot = useRef<BotId | null>(null);
  const localTeam = gameStore.getState().localTeam;
  const bot0Body = useRef<RapierRigidBody | null>(null);
  const bot1Body = useRef<RapierRigidBody | null>(null);
  const bot2Body = useRef<RapierRigidBody | null>(null);
  const bodyById = useMemo(
    () =>
      ({
        'bot-0': bot0Body,
        'bot-1': bot1Body,
        'bot-2': bot2Body,
      }) as Record<BotId, React.RefObject<RapierRigidBody | null>>,
    [],
  );

  const configs = useMemo(() => {
    const roster = buildBotRoster(localTeam);
    assertSpawnInArena(roster);
    assignBotProfiles(roster.map((c) => c.id));
    return roster;
  }, [localTeam]);

  const runtimes = useMemo((): BotRuntime[] => {
    return configs.map((c) => {
      const spawn: SafePosition = {
        x: c.x,
        y: getArenaStandY(c.x, c.z),
        z: c.z,
      };
      return {
        id: c.id,
        team: c.team,
        bodyRef: bodyById[c.id],
        holdingBall: false,
        combat: createBotCombatState(),
        spawn,
        fallTrack: createFallTracker(spawn),
        beamLockUntil: 0,
        ballDenyUntil: 0,
        beamRegrabUntil: 0,
        onRecovered: () => {},
        onRagdollBurst: onBotRagdollBurst,
        retaliation: createBotRetaliationState(),
        visualRecovery: createVisualRecoveryState(),
      };
    });
  }, [configs, bodyById, onBotRagdollBurst]);

  botsRef.current = runtimes;

  return (
    <>
      <EnemyRocketVolley
        bots={runtimes}
        pendingEnemyRocketBot={pendingEnemyRocketBot}
      />
      {runtimes.map((bot) => (
        <BotAvatar
          key={bot.id}
          bot={bot}
          allBots={runtimes}
          ballBodyRef={ballBodyRef}
          playerChestRef={playerChestRef}
          playerBodyRef={playerBodyRef}
          onRocketFired={onRocketFired}
          botEnergyLevelsRef={botEnergyLevelsRef}
          pendingEnemyRocketBot={pendingEnemyRocketBot}
        />
      ))}
    </>
  );
}

/** Called when rocket/explosion hits near a bot — knockback only (no hit count / energy) */
export function botHitByExplosion(
  bots: BotRuntime[],
  ex: number,
  ey: number,
  ez: number,
  radius: number,
  rocketVx?: number,
  rocketVy?: number,
  rocketVz?: number,
): void {
  const reach = radius + BOT.rocketHitRadius + 2;
  const reachSq = reach * reach;

  for (const bot of bots) {
    const body = bot.bodyRef.current;
    if (!body) continue;
    const t = body.translation();
    const chestY = t.y + BEAM.chestHeight;
    const dx = t.x - ex;
    const dy = chestY - ey;
    const dz = t.z - ez;
    if (dx * dx + dy * dy + dz * dz > reachSq) continue;

    const hit = applyExplosionToBot(
      body,
      t.x,
      chestY,
      t.z,
      ex,
      ey,
      ez,
      radius,
      bot.combat,
      rocketVx,
      rocketVy,
      rocketVz,
    );
    if (!hit) continue;
    if (bot.combat.isRagdoll) continue;
    /* Explosion knockback only — bot damage / ragdoll hits need a direct rocket body hit */
  }
}

/** @returns true if the bot entered ragdoll from this hit */
export function botDirectRocketHit(
  bots: BotRuntime[],
  hitBotId: BotId,
  rocketVx: number,
  rocketVy: number,
  rocketVz: number,
  ballBodyRef: React.RefObject<RapierRigidBody | null>,
  botEnergyLevelsRef: React.MutableRefObject<Record<BotId, number>>,
  hitByOwnerId = 'local',
): boolean {
  const victim = bots.find((b) => b.id === hitBotId);
  if (!victim) return false;
  const body = victim.bodyRef.current;
  if (!body) return false;

  const gs = gameStore.getState();
  const attacker = bots.find((b) => b.id === hitByOwnerId);
  const attackerTeam =
    hitByOwnerId === 'local' ? gs.localTeam : (attacker?.team ?? null);
  const hostile = isHostileRocketHit(
    hitByOwnerId,
    victim.team,
    attackerTeam,
    gs.localTeam,
  );

  applyDirectRocketToBot(body, rocketVx, rocketVy, rocketVz, victim.combat);

  if (victim.combat.isRagdoll) return false;

  if (!hostile) {
    botEnergyLevelsRef.current[hitBotId] = 0;
    if (victim.holdingBall) {
      releaseBotBall(victim, ballBodyRef.current);
    }
    const denyUntil = performance.now() / 1000 + BOT.rocketBallDenySec;
    victim.beamLockUntil = denyUntil;
    victim.ballDenyUntil = denyUntil;
    return false;
  }

  if (hitByOwnerId === 'local') {
    const ragdolled = registerPlayerHitOnBot(victim, body);
    if (ragdolled) {
      clearBotRetaliation(victim.retaliation);
      botEnergyLevelsRef.current[hitBotId] = 0;
      if (victim.holdingBall) {
        releaseBotBall(victim, ballBodyRef.current);
      }
      return true;
    }
    botEnergyLevelsRef.current[hitBotId] = Math.max(
      0,
      (botEnergyLevelsRef.current[hitBotId] ?? 100) - 35,
    );
  }

  armBotRetaliation(
    victim.retaliation,
    hitBotId,
    hitByOwnerId,
    gs.ballHolderId,
    victim.holdingBall,
  );

  return false;
}

/** Ball body hits bots — physics only; combat damage is direct rocket hits */
export function botBallStrikeFromPlayer(
  _bots: BotRuntime[],
  _hitBotId: BotId,
  _ballBodyRef: React.RefObject<RapierRigidBody | null>,
  _botEnergyLevelsRef: React.MutableRefObject<Record<BotId, number>>,
): void {}

export function getBotChestPositions(
  bots: BotRuntime[],
  out: { id: BotId; x: number; y: number; z: number }[],
) {
  out.length = 0;
  for (const bot of bots) {
    const body = bot.bodyRef.current;
    if (!body) continue;
    const t = body.translation();
    out.push({
      id: bot.id,
      x: t.x,
      y: t.y + BEAM.chestHeight,
      z: t.z,
    });
  }
}
