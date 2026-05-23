import { useFrame } from '@react-three/fiber';
import {
  CapsuleCollider,
  interactionGroups,
  RigidBody,
  useAfterPhysicsStep,
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
  ROCKET,
  TEAM_SPAWN,
} from '../shared/Constants';
import { tuningStore } from './tuningStore';
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
import {
  captureBallSocket,
  getBallSocketPosition,
  releaseBallPhysics,
  smoothHoldSocketTarget,
  updateBallSocketSmooth,
} from './ballAttach';
import {
  aimAnglesToward,
  getEnemyGoalTarget,
  pickAllyProjectileTarget,
  applyBotLaunchAimError,
  pickBotGoalLaunchTarget,
  pickEnemyVolleyRocketTarget,
  pickFollowPlayerProjectileTarget,
  pickTeammatePassTarget,
} from './botGoals';
import { createRocket, type ActiveRocket } from './rocketSystem';
import {
  applyAllBotSeparation,
  botRole,
  modeSprint,
  canAllyBeamLooseBall,
  modeWantsBeam,
  gatePlayerChaseMode,
  isPlayerChaseMode,
  pickBotMode,
  pickGiveShootZoneSpaceTarget,
  shouldGiveShootZoneSpace,
  type AllyShootZoneMagnetState,
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
  shouldBotAttemptProjectile,
  shouldEnemyTeamRocketVolley,
  updateCarryLook,
  type BotFarHoldAction,
  type BotHoldPhase,
  type BotMode,
  type CarryLookState,
} from './botBrain';
import { applyDirectRocketToBot, applyExplosionToBot } from './explosions';
import { createFallTracker, type SafePosition } from './fallRecovery';
import { isBeamDenied } from './beamDenyZones';
import {
  getTeammateReleaseIntent,
  recordBotTeamRelease,
  shouldWaitForTeammateShot,
  type BotTeamReleaseKind,
} from './botTeamRelease';
import { isInsideShootZone } from './botShootZone';
import { gameStore } from './gameStore';
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
  spawn: SafePosition;
  fallTrack: ReturnType<typeof createFallTracker>;
  beamLockUntil: number;
  /** Wall-clock sec — block beam until this time after pass/shoot */
  beamRegrabUntil: number;
  onRecovered: () => void;
};

type BotsProps = {
  botsRef: React.MutableRefObject<BotRuntime[]>;
  ballBodyRef: React.RefObject<RapierRigidBody | null>;
  playerChestRef: React.RefObject<THREE.Vector3>;
  playerBodyRef: React.RefObject<RapierRigidBody | null>;
  onRocketFired: (rocket: ActiveRocket) => void;
  botEnergyLevelsRef: React.MutableRefObject<Record<BotId, number>>;
};

const _pos = new THREE.Vector3();
const _chest = new THREE.Vector3();
const _ballPos = new THREE.Vector3();
const _ballVel = new THREE.Vector3();
const _goal = new THREE.Vector3();
const _lookDir = new THREE.Vector3();
const _wish = new THREE.Vector3();
const _shootTarget = new THREE.Vector3();
const _teammateVel = new THREE.Vector3();
const _playerChest = new THREE.Vector3();
const _moveTarget = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _otherBotPos = new THREE.Vector3();
const _opponentChest = new THREE.Vector3();
const _playerVel = new THREE.Vector3();
const _center = new THREE.Vector3();
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

function botBodyColor(id: BotId, team: 'red' | 'blue'): string {
  if (team === 'red') {
    return id === 'bot-0' ? '#ff5533' : '#e88833';
  }
  return id === 'bot-2' ? '#66ccff' : '#5599dd';
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

function applyBotMovementEscape(
  pos: THREE.Vector3,
  wish: THREE.Vector3,
  vel: THREE.Vector3,
  stuck: BotStuckState,
  dt: number,
): boolean {
  tickBotBackWallKeepOut(pos, wish);
  const backWish = tickBotBackWallEscape(pos, wish, dt);
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

function releaseBotBall(bot: BotRuntime, ball: RapierRigidBody | null) {
  bot.holdingBall = false;
  if (gameStore.getState().ballHolderId === bot.id) {
    gameStore.clearBallHolder();
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
) {
  applyBotLaunchAimError(chest, target, _shootTarget);
  smoothAimToward(yaw, pitch, chest, _shootTarget, dt, BOT.aimSmoothing);
  if (kind === 'shoot' || kind === 'loft') {
    pitch.current = Math.min(
      1.05,
      pitch.current + THREE.MathUtils.degToRad(BOT.shotPitchOffsetDeg),
    );
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
  );
  bot.beamRegrabUntil =
    performance.now() / 1000 + BOT.postReleaseBeamCooldownSec;
  const teamKind: BotTeamReleaseKind = kind === 'pass' ? 'pass' : 'shot';
  recordBotTeamRelease(bot.team, bot.id, teamKind);
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
  const holdPhase = useRef<BotHoldPhase>('advance');
  const setupJumped = useRef(false);
  const setupEnterSec = useRef(0);
  const modeRef = useRef<BotMode>('runToBall');
  const groundJumpTimer = useRef(staggerTimer(bot.id, BOT.groundJumpIntervalSec));
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
  const holdSocketSmoothed = useRef(new THREE.Vector3());
  const holdSocketSmoothReady = useRef(false);
  const playerChaseState = useRef<PlayerChaseState>({
    burstSecLeft: 0,
    cooldownSecLeft: 0,
  });
  const shootZoneMagnetState = useRef<AllyShootZoneMagnetState>({
    magnetAllowed: null,
    shooterId: null,
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
  const color = botBodyColor(bot.id, bot.team);

  useAfterPhysicsStep(() => {
    const body = bodyRef.current;
    if (!body) return;
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
      gameStore.clearBallHolder();
    }
  };

  useFrame((_, dt) => {
    const body = bodyRef.current;
    const ball = ballBodyRef.current;
    const gs = gameStore.getState();
    const phase = gs.phase;
    if (!body) {
      beamPullActive.current = false;
      return;
    }

    const tune = tuningStore.getState();
    airGrace.current = Math.max(0, airGrace.current - dt);
    const t = body.translation();
    _pos.set(t.x, t.y, t.z);
    _chest.set(t.x, t.y + BEAM.chestHeight, t.z);
    if (!stuckState.current) {
      stuckState.current = createBotStuckState(_pos.x, _pos.z);
    }

    if (phase === 'countdown' && gs.lastScoringTeam === bot.team) {
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
      return;
    }

    if (phase !== 'playing' || gs.ballFrozen) {
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
    const distGoal = _chest.distanceTo(_goal);
    const now = performance.now() / 1000;
    const beamLocked = now < bot.beamLockUntil;
    const regrabLocked = now < bot.beamRegrabUntil;
    const denyHere =
      isBeamDenied(_chest.x, _chest.y, _chest.z) ||
      isBeamDenied(_ballPos.x, _ballPos.y, _ballPos.z);

    if (!iHold) {
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
        const cap = getBallSocketPosition(
          _chest,
          _lookDir,
          BEAM.holdDistance,
          BALL.radius,
        );
        holdSocketSmoothed.current.copy(cap);
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
      }

      holdReleasePlan.current = ensureHoldReleasePlan(
        holdTimer.current,
        hasTeammate,
        holdReleasePlan.current,
      );

      let releaseKind = resolveTimedBotHoldRelease(
        holdTimer.current,
        hasTeammate,
        inShootZone,
        holdReleasePlan.current,
        distGoal,
      );
      if (holdPhase.current === 'shoot') {
        releaseKind = 'shoot';
      }

      if (releaseKind) {
        const doPass =
          releaseKind === 'pass' &&
          teammateChest !== null &&
          passCooldown.current <= 0;
        const launchKind: BotLaunchKind = doPass ? 'pass' : 'shoot';

        if (doPass) {
          pickTeammatePassTarget(
            _chest,
            teammateChest,
            _teammateVel,
            _shootTarget,
          );
          passCooldown.current = BOT.passToTeammateCooldownSec;
        } else {
          pickBotGoalLaunchTarget(
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
        airGrace.current = BOT.jumpAirGraceSec * 0.35;
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
      clampMoveTargetFromBackWall(_moveTarget);
      const dribbleToTeammate =
        !nearGoal &&
        (mode === 'carryToGoal' || mode === 'setupShot') &&
        holdCarryFocus.current === 'teammate' &&
        teammateChest;
      if (dribbleToTeammate) {
        _moveTarget.copy(teammateChest);
        _moveTarget.y = Math.max(_moveTarget.y, _goal.y);
        clampMoveTargetFromBackWall(_moveTarget);
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
      applyAllBotSeparation(_wish, _pos, bot.id, _botSepScratch);

      const wallEscapeJump = applyBotMovementEscape(
        _pos,
        _wish,
        velocity.current,
        stuckState.current!,
        dt,
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
        setupJumped.current = true;
      }

      vy += tune.gravity * dt;
      velocity.current.y = vy;
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
      );

      softenHexBoundaryVelocity(_pos, velocity.current);
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
    };

    let mode = pickBotMode(think);
    if (isEnemyBot) {
      mode = gatePlayerChaseMode(
        mode,
        holder,
        think,
        playerChaseState.current,
        dt,
      );
    }
    modeRef.current = mode;
    pickMoveTarget(mode, think, _moveTarget);
    clampMoveTargetFromBackWall(_moveTarget);
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
    pickLookTarget(mode, think, _moveTarget, _lookTarget);

    smoothAimToward(yaw, pitch, _chest, _lookTarget, dt);
    writeLookDirection(yaw.current, pitch.current, _lookDir);

    if (
      isEnemyBot &&
      pendingEnemyRocketBot.current === bot.id &&
      !iHold
    ) {
      pendingEnemyRocketBot.current = null;
      if (shouldEnemyTeamRocketVolley(holder, localTeam)) {
        pickEnemyVolleyRocketTarget(
          _playerChest,
          _playerVel,
          _ballPos,
          _chest,
          holder,
          _shootTarget,
        );
        smoothAimToward(yaw, pitch, _chest, _shootTarget, dt, BOT.aimSmoothing);
        writeLookDirection(yaw.current, pitch.current, _lookDir);
        botFireRocket(bot.id, body, _chest, _lookDir, onRocketFired);
      }
    }

    const inFollowPlayerMode =
      isEnemyBot && !iHold && isPlayerChaseMode(mode);

    if (inFollowPlayerMode) {
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
            BOT.followPlayerProjectileIntervalSec;
          pickFollowPlayerProjectileTarget(
            _chest,
            _playerChest,
            _playerVel,
            _shootTarget,
          );
          smoothAimToward(yaw, pitch, _chest, _shootTarget, dt, BOT.aimSmoothing);
          writeLookDirection(yaw.current, pitch.current, _lookDir);
          botFireRocket(bot.id, body, _chest, _lookDir, onRocketFired, false);
          firedFollowRocket = true;
        } else if (
          followRocketTimer.current <= 0 &&
          Math.random() < BOT.followPlayerRocketChance
        ) {
          followRocketTimer.current = BOT.followPlayerRocketIntervalSec;
          pickFollowPlayerProjectileTarget(
            _chest,
            _playerChest,
            _playerVel,
            _shootTarget,
          );
          smoothAimToward(yaw, pitch, _chest, _shootTarget, dt, BOT.aimSmoothing);
          writeLookDirection(yaw.current, pitch.current, _lookDir);
          botFireRocket(bot.id, body, _chest, _lookDir, onRocketFired, true);
          firedFollowRocket = true;
        }

        if (firedFollowRocket) {
          followModeRocketCooldown.current =
            BOT.followPlayerRocketCooldownSec;
        }
      }
    } else {
      followModeRocketCooldown.current = 0;
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
        writeLookDirection(yaw.current, pitch.current, _lookDir);
        botFireRocket(bot.id, body, _chest, _lookDir, onRocketFired);
      }
    }

    _wish.set(_moveTarget.x - _pos.x, 0, _moveTarget.z - _pos.z);
    if (_wish.lengthSq() > 0.01) _wish.normalize();
    collectBotSepPositions(allBots, _botSepScratch);
    applyAllBotSeparation(_wish, _pos, bot.id, _botSepScratch);

    const wallEscapeJump = applyBotMovementEscape(
      _pos,
      _wish,
      velocity.current,
      stuckState.current!,
      dt,
    );

    const sprint = modeSprint(mode);
    const speed = sprint ? BOT.sprintSpeed : BOT.walkSpeed;
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
        const pullScale =
          (isEnemyBot ? BOT.enemyBeamPullScale : BOT.beamPullScale) *
          tune.pullStrength;
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
        if (
          canCaptureWithContest(
            bot.team,
            pull.analysis,
            grabDist,
            true,
            chestDist,
          )
        ) {
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
          holdCarryFocus.current = pickBotHoldCarryFocus(tmOnGrab, distGoal);
          holdReleasePlan.current = null;
          resetCarryLookState(carryLookState.current);
          carryLookState.current.preferTeammateLook =
            holdCarryFocus.current === 'teammate';
          shotIndex.current =
            bot.id === 'bot-0' ? 0 : bot.id === 'bot-1' ? 1 : 2;
          groundJumpTimer.current = 0.2;
          airGrace.current = Math.max(airGrace.current, 0.45);
          writeLookDirection(yaw.current, pitch.current, _lookDir);
          holdLatchT.current = 0;
          const cap = getBallSocketPosition(
            _chest,
            _lookDir,
            BEAM.holdDistance,
            BALL.radius,
          );
          holdSocketSmoothed.current.copy(cap);
          holdSocketSmoothReady.current = true;
          captureBallSocket(ball, holdSocketSmoothed.current, _ballPos);
        } else if (pull.applied) {
          gameStore.setBallState('pulled');
        }
      }
    } else if (energy.current < ENERGY.max) {
      energy.current = Math.min(
        ENERGY.max,
        energy.current + ENERGY.regen * 0.85 * dt,
      );
    }

    botEnergyLevelsRef.current[bot.id] = energy.current;
  });

  return (
    <>
      <BeamPullTrace
        active={() => beamPullActive.current}
        from={() => beamFrom.current}
        to={() => beamTo.current}
        variant={isEnemyBot ? 'enemy' : 'player'}
      />
      <RigidBody
        ref={bodyRef}
        colliders={false}
        mass={12}
        lockRotations
        gravityScale={0}
        ccd
        position={[bot.spawn.x, bot.spawn.y, bot.spawn.z]}
        userData={{ character: true, hitTarget: isEnemyBot }}
      >
        <CapsuleCollider
          args={[capHalfH, MOVEMENT.capsuleRadius]}
          position={[0, capCenterY, 0]}
          friction={0.85}
          collisionGroups={interactionGroups(0, [0, 1, 2])}
        />
        <group position={[0, capCenterY, 0]}>
          <mesh>
            <capsuleGeometry args={[MOVEMENT.capsuleRadius, capHalfH * 2, 6, 12]} />
            <meshStandardMaterial color={color} metalness={0.3} roughness={0.55} />
          </mesh>
        </group>
      </RigidBody>
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
  const timer = useRef(BOT.enemyRocketVolleyIntervalSec);

  useFrame((_, dt) => {
    const gs = gameStore.getState();
    if (!gs.botsEnabled || gs.phase !== 'playing' || gs.ballFrozen) return;

    timer.current -= dt;
    if (timer.current > 0) return;
    timer.current = BOT.enemyRocketVolleyIntervalSec;

    if (Math.random() >= BOT.enemyRocketVolleyChance) return;
    if (!shouldEnemyTeamRocketVolley(gs.ballHolderId, gs.localTeam)) return;

    const enemies = bots.filter((b) => b.team !== gs.localTeam);
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
        spawn,
        fallTrack: createFallTracker(spawn),
        beamLockUntil: 0,
        beamRegrabUntil: 0,
        onRecovered: () => {},
      };
    });
  }, [configs, bodyById]);

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

/** Called when rocket/explosion hits near a bot */
export function botHitByExplosion(
  bots: BotRuntime[],
  ex: number,
  ey: number,
  ez: number,
  radius: number,
  ballBodyRef: React.RefObject<RapierRigidBody | null>,
  rocketVx?: number,
  rocketVy?: number,
  rocketVz?: number,
): void {
  for (const bot of bots) {
    const body = bot.bodyRef.current;
    if (!body) continue;
    const t = body.translation();
    const chestY = t.y + BEAM.chestHeight;
    const hit = applyExplosionToBot(
      body,
      t.x,
      chestY,
      t.z,
      ex,
      ey,
      ez,
      radius,
      rocketVx,
      rocketVy,
      rocketVz,
    );
    if (!hit) continue;

    if (bot.holdingBall) {
      releaseBotBall(bot, ballBodyRef.current);
    }

    bot.beamLockUntil =
      performance.now() / 1000 + ROCKET.beamDenyDurationSec;
  }
}

export function botDirectRocketHit(
  bots: BotRuntime[],
  hitBotId: BotId,
  rocketVx: number,
  rocketVy: number,
  rocketVz: number,
  ballBodyRef: React.RefObject<RapierRigidBody | null>,
): void {
  for (const bot of bots) {
    if (bot.id !== hitBotId) continue;
    const body = bot.bodyRef.current;
    if (!body) return;
    applyDirectRocketToBot(body, rocketVx, rocketVy, rocketVz);
    if (bot.holdingBall) {
      releaseBotBall(bot, ballBodyRef.current);
    }
    bot.beamLockUntil =
      performance.now() / 1000 + ROCKET.beamDenyDurationSec;
    return;
  }
}

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
