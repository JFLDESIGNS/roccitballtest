import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics, type RapierRigidBody } from '@react-three/rapier';
import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSyncExternalStore } from 'react';
import { BALL, BEAM, BOT, MATCH, RENDER, ROCKET } from '../shared/Constants';
import { ArenaAtmosphere } from './ArenaAtmosphere';
import { ArenaSky } from './ArenaSky';
import { graphicsStore } from './graphicsStore';
import { SceneEnvironment } from './SceneEnvironment';
import { shadowMapTypeToThree } from './shadowMapType';
import { ScenePostFX } from './ScenePostFX';
import { tuningStore } from './tuningStore';
import { Arena } from './Arena';
import { CustomMapOverlay } from '../mapEditor/CustomMapOverlay';
import { mapRegistryStore } from '../mapEditor/mapEditorStore';
import { TRAINING_MAP_ID } from '../mapEditor/mapEditorTypes';
import { getHiddenStadiumPieces, getPlayModeStadiumGroups } from '../mapEditor/stadiumLayout';
import { ArenaLighting } from './ArenaLighting';
import { Ball, type BallHandle } from './Ball';
import { BeamVisual } from './BeamVisual';
import { gameStore } from './gameStore';
import { isMatchOver } from './matchEnd';
import { setFanGlassListenerPosition } from './fanGlassHit';
import {
  clearLightGlowProximityAnchor,
  setLightGlowProximityAnchor,
} from './lightGlowProximityAnchor';
import { inputManager } from './InputManager';
import { DebugFreelook } from './DebugFreelook';
import { Player } from './Player';
import { Rockets } from './Rockets';
import { RocketRecoilFx } from './RocketRecoilFx';
import { RocketTrailSmoke } from './RocketTrailSmoke';
import {
  goalScoreRuntime,
  markLocalGoalShot,
  registerGoalScoreBotProvider,
  tickGoalScoreRuntime,
} from './goalScoreHandler';
import type { ActiveRocket } from './rocketSystem';
import {
  applyDirectRocketToPlayer,
  applyExplosionToBall,
  applyExplosionToPlayer,
  type ExplosionHit,
} from './explosions';
import {
  playRocketExplosion,
  playRocketFire,
  resumeAudio,
  setBeamAttractActive,
  warmAudio,
} from './audio';
import {
  RocketExplosionSprites,
  type RocketExplosionSpritesHandle,
} from './RocketExplosionSprites';
import { FanGlassCrackFx } from './FanGlassCrackFx';
import { ImpactSparks } from './BillboardImpactSparks';
import { PillarShakeSmoke } from './PillarShakeSmoke';
import { triggerArenaPillarShake } from './visualShake';
import { GameplayCollisionDebug } from './GameplayCollisionDebug';
import {
  RocketWallImpactFx,
  type RocketWallImpactFxHandle,
} from './RocketWallImpactFx';
import {
  BotRagdollBurstFx,
  type BotRagdollBurstHandle,
} from './BotRagdollBurstFx';
import { GoalFireworks } from './GoalFireworks';
import { GroundSmashDust } from './GroundSmashDust';
import { registerBeamDenyZone } from './beamDenyZones';
import { BeamDenyZonesVisual } from './beamDenyZonesVisual';
import {
  Bots,
  botBallStrikeFromPlayer,
  botDirectRocketHit,
  botHitByExplosion,
  type BotId,
  type BotRuntime,
} from './Bots';
import { playerFeetY } from './playerGroundProbe';
import { ArenaPadMonitor } from './ArenaPadMonitor';
import {
  multiplayerStore,
  type NetworkBallState,
  type NetworkRocketState,
  type RemoteMultiplayerPlayer,
} from '../multiplayer/multiplayerStore';
import { RemotePlayers } from './RemotePlayers';
import {
  announceBotDestroyed,
  announceRocketPlayerHit,
} from './announcements';
import { setKickoffBallReleaseHandler } from './kickoffDrop';
import { getLocalProfile } from './playerRoster';
import { CoopAdventureCourse } from '../coop/CoopAdventureCourse';
import { isCoopAdventureMode } from '../coop/coopAdventurePlayerThrow';
import { TrainingRangeMap } from './TrainingRangeMap';
import { trainingMapStore } from './trainingMapStore';

function rocketToNetwork(r: ActiveRocket): Omit<NetworkRocketState, 'ownerId'> {
  return {
    id: r.id,
    position: { x: r.position.x, y: r.position.y, z: r.position.z },
    velocity: { x: r.velocity.x, y: r.velocity.y, z: r.velocity.z },
    spawnPos: { x: r.spawnPos.x, y: r.spawnPos.y, z: r.spawnPos.z },
    segmentStart: {
      x: r.segmentStart.x,
      y: r.segmentStart.y,
      z: r.segmentStart.z,
    },
    spawnTime: r.spawnTime,
    bouncesLeft: r.bouncesLeft,
    explosive: r.explosive,
  };
}

function rocketFromNetwork(r: NetworkRocketState): ActiveRocket {
  const position = new THREE.Vector3(r.position.x, r.position.y, r.position.z);
  const spawnTime =
    performance.now() / 1000 - ROCKET.ownerGraceSec - 0.08;
  return {
    id: `${r.ownerId}:${r.id}`,
    position,
    velocity: new THREE.Vector3(r.velocity.x, r.velocity.y, r.velocity.z),
    spawnPos: new THREE.Vector3(r.spawnPos.x, r.spawnPos.y, r.spawnPos.z),
    segmentStart: new THREE.Vector3(
      r.segmentStart.x,
      r.segmentStart.y,
      r.segmentStart.z,
    ),
    ownerId: r.ownerId,
    spawnTime,
    bouncesLeft: r.bouncesLeft,
    explosive: r.explosive,
    punchedGlowIds: new Set(),
  };
}

const NETWORK_BALL_INTERPOLATION_BACKTIME_SEC = 0.075;
const NETWORK_BALL_EXTRAPOLATE_SEC = 0.1;
const NETWORK_BALL_MAX_EXTRAPOLATE_SPEED = 85;
const NETWORK_BALL_CORRECTION_SNAP_M = 7.5;
const NETWORK_BALL_SAMPLE_HISTORY = 16;
const LOCAL_BALL_IMPACT_PREDICTION_MS = 750;

type NetworkBallSample = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  at: number;
};

function makeNetworkBallSample(ball: NetworkBallState): NetworkBallSample {
  return {
    position: new THREE.Vector3(ball.position.x, ball.position.y, ball.position.z),
    velocity: new THREE.Vector3(ball.velocity.x, ball.velocity.y, ball.velocity.z),
    angularVelocity: new THREE.Vector3(
      ball.angularVelocity.x,
      ball.angularVelocity.y,
      ball.angularVelocity.z,
    ),
    at: ball.updatedAt,
  };
}

function RemoteBeamVisual({
  player,
  ballPosition,
}: {
  player: RemoteMultiplayerPlayer;
  ballPosition: () => THREE.Vector3 | null;
}) {
  const chestRef = useRef(new THREE.Vector3());
  const updateChestPosition = useCallback(() => {
    chestRef.current.set(
      player.position.x,
      player.position.y + BEAM.chestHeight,
      player.position.z,
    );
    return chestRef.current;
  }, [player.position.x, player.position.y, player.position.z]);

  return (
    <BeamVisual
      pullActive={() => {
        if (!player.isBeaming) return false;
        const chest = updateChestPosition();
        const ball = ballPosition();
        return !!ball && chest.distanceTo(ball) < BEAM.range;
      }}
      chestPosition={updateChestPosition}
      ballPosition={ballPosition}
      lowEnergy={false}
      team={player.team}
    />
  );
}

function RemoteBeamVisuals({
  ballPosition,
}: {
  ballPosition: () => THREE.Vector3 | null;
}) {
  const players = useSyncExternalStore(
    multiplayerStore.subscribe,
    () => multiplayerStore.getState().remotePlayers,
  );

  return (
    <>
      {players.map((player) => (
        <RemoteBeamVisual
          key={player.id}
          player={player}
          ballPosition={ballPosition}
        />
      ))}
    </>
  );
}

function RemoteBeamAudio({
  ballPosition,
}: {
  ballPosition: () => THREE.Vector3 | null;
}) {
  const players = useSyncExternalStore(
    multiplayerStore.subscribe,
    () => multiplayerStore.getState().remotePlayers,
  );

  useEffect(() => () => setBeamAttractActive(false, 'remote'), []);

  useFrame(() => {
    const ball = ballPosition();
    const active =
      !!ball &&
      players.some((player) => {
        if (!player.isBeaming) return false;
        return (
          Math.hypot(
            player.position.x - ball.x,
            player.position.y + BEAM.chestHeight - ball.y,
            player.position.z - ball.z,
          ) < BEAM.range
        );
      });
    setBeamAttractActive(active, 'remote');
  });

  return null;
}

function MatchLoop({
  ballRef,
  botsRef,
}: {
  ballRef: React.RefObject<BallHandle | null>;
  botsRef: React.MutableRefObject<BotRuntime[]>;
}) {
  const matchTimer = useRef(MATCH.durationSec);
  const countdownTimer = useRef(0);
  const countdownEntered = useRef(false);
  const countdownParked = useRef(false);
  const arenaSettleTimer = useRef(0);
  const arenaSettleEntered = useRef(false);
  const postScoreKickoffPending = useRef(false);
  const matchGeneration = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().matchGeneration,
  );

  useEffect(() => {
    matchTimer.current = MATCH.durationSec;
    countdownTimer.current = 0;
    countdownEntered.current = false;
    countdownParked.current = false;
    arenaSettleTimer.current = 0;
    arenaSettleEntered.current = false;
    postScoreKickoffPending.current = false;
  }, [matchGeneration]);

  useEffect(() => {
    registerGoalScoreBotProvider(() => botsRef.current);
  }, [botsRef]);

  useFrame((_, dt) => {
    const state = gameStore.getState();
    const multiplayer = multiplayerStore.getState();
    if (
      multiplayer.enabled &&
      multiplayer.status === 'online' &&
      multiplayer.selfId !== multiplayer.hostId
    ) {
      return;
    }

    tickGoalScoreRuntime(dt);

    if (state.phase === 'intro' || state.phase === 'loading') {
      return;
    }

    if (state.phase === 'playing') {
      if (state.arenaSettleCountdown > 0) {
        if (!arenaSettleEntered.current) {
          arenaSettleEntered.current = true;
          arenaSettleTimer.current = state.arenaSettleCountdown;
          ballRef.current?.parkAtDrop();
        }
        arenaSettleTimer.current -= dt;
        const settleDisplay = Math.ceil(arenaSettleTimer.current);
        if (
          settleDisplay > 0 &&
          state.arenaSettleCountdown !== settleDisplay
        ) {
          gameStore.setArenaSettleCountdown(settleDisplay);
        }
        if (arenaSettleTimer.current <= 0) {
          arenaSettleEntered.current = false;
          gameStore.setArenaSettleCountdown(0);
          gameStore.setCountdown(MATCH.startCountdownSec);
        }
        return;
      }

      if (
        state.score.red >= MATCH.scoreLimit ||
        state.score.blue >= MATCH.scoreLimit
      ) {
        gameStore.setPhase('paused');
        return;
      }

      matchTimer.current -= dt;
      gameStore.setTimeLeft(Math.max(0, Math.ceil(matchTimer.current)));
      if (matchTimer.current <= 0) gameStore.setPhase('paused');

      if (goalScoreRuntime.postScoreDelaySec > 0) {
        postScoreKickoffPending.current = true;
      } else if (postScoreKickoffPending.current) {
        postScoreKickoffPending.current = false;
        gameStore.beginPostScoreKickoff();
      }

      if (state.countdown > 0) {
        if (!countdownEntered.current) {
          countdownEntered.current = true;
          countdownTimer.current = state.countdown;
          if (state.ballFrozen && !countdownParked.current) {
            countdownParked.current = true;
            ballRef.current?.parkAtDrop();
          }
        }

        countdownTimer.current -= dt;
        const display = Math.ceil(countdownTimer.current);
        if (display > 0 && state.countdown !== display) {
          gameStore.setCountdown(display);
        }
        if (countdownTimer.current <= 0) {
          countdownEntered.current = false;
          countdownParked.current = false;
          gameStore.setCountdown(0);
        }
      } else {
        countdownEntered.current = false;
        countdownParked.current = false;
      }
    }
  });

  return null;
}

function CoopAdventureMatchLoop() {
  const matchTimer = useRef<number>(MATCH.durationSec);
  const matchGeneration = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().matchGeneration,
  );

  useEffect(() => {
    matchTimer.current = MATCH.durationSec;
  }, [matchGeneration]);

  useFrame((_, dt) => {
    const multiplayer = multiplayerStore.getState();
    if (
      multiplayer.enabled &&
      multiplayer.status === 'online' &&
      multiplayer.selfId !== multiplayer.hostId
    ) {
      return;
    }

    const state = gameStore.getState();
    if (state.phase !== 'playing') return;

    matchTimer.current = Math.max(0, matchTimer.current - dt);
    gameStore.syncNetworkMatch({
      phase: 'playing',
      score: state.score,
      timeLeft: matchTimer.current,
      countdown: 0,
      arenaSettleCountdown: 0,
      loadCountdown: 0,
      ballFrozen: false,
    });
  });

  return null;
}

function PreMatchArenaFlyover() {
  const { camera } = useThree();
  const startedAt = useRef(0);
  const snapped = useRef(false);
  const desired = useRef(new THREE.Vector3());
  const lookAt = useRef(new THREE.Vector3());

  const shots = useMemo(
    () => [
      {
        pos: new THREE.Vector3(-46, 16, 30),
        look: new THREE.Vector3(-18, 11, 6),
      },
      {
        pos: new THREE.Vector3(-22, 13, -52),
        look: new THREE.Vector3(-4, 10, -8),
      },
      {
        pos: new THREE.Vector3(40, 19, -24),
        look: new THREE.Vector3(15, 11, -2),
      },
      {
        pos: new THREE.Vector3(0, 30, 56),
        look: new THREE.Vector3(0, 12, 0),
      },
      {
        pos: new THREE.Vector3(0, 24, 0),
        look: new THREE.Vector3(0, 10, -22),
      },
    ],
    [],
  );

  useFrame(({ clock }, dt) => {
    const state = gameStore.getState();
    const active = state.phase === 'playing' && state.arenaSettleCountdown > 0;
    if (!active) {
      startedAt.current = 0;
      snapped.current = false;
      return;
    }

    if (startedAt.current === 0) startedAt.current = clock.elapsedTime;
    const duration = Math.max(0.1, MATCH.arenaSettleCountdownSec);
    const t = Math.min(1, (clock.elapsedTime - startedAt.current) / duration);
    const scaled = t * (shots.length - 1);
    const index = Math.min(shots.length - 2, Math.floor(scaled));
    const localT = scaled - index;
    const ease = localT * localT * (3 - 2 * localT);
    const from = shots[index]!;
    const to = shots[index + 1]!;

    desired.current.lerpVectors(from.pos, to.pos, ease);
    lookAt.current.lerpVectors(from.look, to.look, ease);
    if (!snapped.current) {
      camera.position.copy(desired.current);
      snapped.current = true;
    } else {
      camera.position.lerp(desired.current, 1 - Math.exp(-dt * 7.5));
    }
    camera.lookAt(lookAt.current);
    camera.updateMatrixWorld();
  }, 10);

  return null;
}

function Scene({
  onExit,
  rocketsRef,
}: {
  onExit: () => void;
  rocketsRef: React.MutableRefObject<ActiveRocket[]>;
}) {
  const ballRef = useRef<BallHandle>(null);
  const ballBodyRef = useRef<RapierRigidBody | null>(null);
  const holdingBallRef = useRef(false);
  const splashFxRef = useRef<RocketExplosionSpritesHandle | null>(null);
  const wallImpactFxRef = useRef<RocketWallImpactFxHandle | null>(null);
  const botRagdollFxRef = useRef<BotRagdollBurstHandle | null>(null);
  const playerPosRef = useRef(new THREE.Vector3(0, 2, 24));
  const playerChestRef = useRef(new THREE.Vector3());
  const playerBodyRef = useRef<RapierRigidBody | null>(null);
  const playerRocketBoostRef = useRef<(() => void) | null>(null);
  const botsRef = useRef<BotRuntime[]>([]);
  const botEnergyLevelsRef = useRef<Record<BotId, number>>({
    'bot-0': 100,
    'bot-1': 100,
    'bot-2': 100,
  });
  const botHitScratch = useRef<{ id: BotId; x: number; y: number; z: number }[]>(
    [],
  );
  const ballSpawnCooldown = useRef(0);
  const botEnergySyncTimer = useRef(0);
  const hostStateSendTimer = useRef(0);
  const lastAppliedNetworkBallAt = useRef(0);
  const networkBallReady = useRef(false);
  const networkBallPrevSample = useRef<NetworkBallSample | null>(null);
  const networkBallLatestSample = useRef<NetworkBallSample | null>(null);
  const networkBallSampleHistory = useRef<NetworkBallSample[]>([]);
  const networkBallRenderPos = useRef(new THREE.Vector3());
  const networkBallRenderVel = useRef(new THREE.Vector3());
  const networkBallRenderAngVel = useRef(new THREE.Vector3());
  const networkBallCorrection = useRef(new THREE.Vector3());
  const localBallPredictionUntil = useRef(0);
  const localBallPredictionReleasePos = useRef(new THREE.Vector3());
  const localBallPredictionMinSpeed = useRef(0);
  const lastExplosionSfxAt = useRef(0);
  const { gl } = useThree();
  const beamLowEnergy = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().energy < 25,
  );
  const localTeam = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().localTeam,
  );
  const botsEnabled = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().botsEnabled,
  );
  const multiplayerEnabled = useSyncExternalStore(
    multiplayerStore.subscribe,
    () => multiplayerStore.getState().enabled,
  );
  const coopAdventureEnabled =
    multiplayerEnabled &&
    isCoopAdventureMode(multiplayerStore.getState().roomInfo?.mode);
  const showBots = botsEnabled && !multiplayerEnabled;

  useEffect(() => {
    ballBodyRef.current = ballRef.current?.getBody() ?? null;
    const id = setInterval(() => {
      ballBodyRef.current = ballRef.current?.getBody() ?? null;
    }, 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setKickoffBallReleaseHandler(() => {
      gameStore.releaseKickoffBall();
      ballRef.current?.reset();
    });
    return () => setKickoffBallReleaseHandler(null);
  }, []);

  useEffect(() => {
    if (!showBots) {
      botsRef.current = [];
    }
  }, [showBots]);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Game arena');
    canvas.style.outline = 'none';
    inputManager.bind(canvas);
    inputManager.resetLookForTeam(gameStore.getState().localTeam);
  }, [gl]);

  const matchGeneration = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().matchGeneration,
  );

  useEffect(() => {
    inputManager.resetLookForTeam(gameStore.getState().localTeam);
  }, [matchGeneration]);

  useFrame((_, dt) => {
    const network = multiplayerStore.getState();
    const nowMs = performance.now();
    const online = network.enabled && network.status === 'online';
    const isNetworkHost = online && network.selfId === network.hostId;
    const remoteRockets = multiplayerStore.drainRemoteRockets();
    if (remoteRockets.length > 0) {
      rocketsRef.current = [
        ...remoteRockets.map(rocketFromNetwork),
        ...rocketsRef.current,
      ].slice(0, ROCKET.maxActive);
    }
    multiplayerStore.drainRemoteBallActions();
    const ballForNetwork = ballBodyRef.current;
    if (online) {
      if (isNetworkHost) {
        hostStateSendTimer.current -= dt;
        if (hostStateSendTimer.current <= 0) {
          hostStateSendTimer.current = 1 / 60;
          const t = ballForNetwork?.translation();
          const v = ballForNetwork?.linvel();
          const av = ballForNetwork?.angvel();
          const fallbackBall = network.ball;
          const match = gameStore.getState();
          multiplayerStore.sendHostState({
            ball: {
              position: t
                ? { x: t.x, y: t.y, z: t.z }
                : fallbackBall?.position ?? { x: 0, y: 2.05, z: 0 },
              velocity: v
                ? { x: v.x, y: v.y, z: v.z }
                : fallbackBall?.velocity ?? { x: 0, y: 0, z: 0 },
              angularVelocity: av
                ? { x: av.x, y: av.y, z: av.z }
                : fallbackBall?.angularVelocity ?? { x: 0, y: 0, z: 0 },
            },
            match: {
              phase: match.phase,
              score: match.score,
              timeLeft: match.timeLeft,
              countdown: match.countdown,
              arenaSettleCountdown: match.arenaSettleCountdown,
              loadCountdown: match.loadCountdown,
              ballFrozen: match.ballFrozen,
            },
          });
        }
      }
    }
    if (online && ballForNetwork) {
      const isLocalHoldingBall = gameStore.getState().ballHolderId === 'local';
      if (isLocalHoldingBall) {
        networkBallReady.current = false;
      } else if (
        network.ball &&
        network.ball.updatedAt !== lastAppliedNetworkBallAt.current
      ) {
        const b = network.ball;
        const networkSpeed = Math.hypot(
          b.velocity.x,
          b.velocity.y,
          b.velocity.z,
        );
        const networkTravelFromRelease = Math.hypot(
          b.position.x - localBallPredictionReleasePos.current.x,
          b.position.y - localBallPredictionReleasePos.current.y,
          b.position.z - localBallPredictionReleasePos.current.z,
        );
        const hostShotLooksCaughtUp =
          networkSpeed >= localBallPredictionMinSpeed.current &&
          networkTravelFromRelease >= 1.2;
        const currentBallPosition = ballForNetwork.translation();
        const serverDistanceFromLocal = Math.hypot(
          b.position.x - currentBallPosition.x,
          b.position.y - currentBallPosition.y,
          b.position.z - currentBallPosition.z,
        );
        lastAppliedNetworkBallAt.current = b.updatedAt;
        const nextSample = makeNetworkBallSample(b);
        const previousSample = networkBallLatestSample.current;
        if (
          !networkBallReady.current ||
          previousSample == null ||
          nextSample.at <= previousSample.at ||
          nextSample.position.distanceTo(previousSample.position) > 9
        ) {
          networkBallPrevSample.current = nextSample;
          networkBallRenderPos.current.copy(nextSample.position);
          networkBallSampleHistory.current = [nextSample];
        } else {
          networkBallPrevSample.current = {
            position: previousSample.position.clone(),
            velocity: previousSample.velocity.clone(),
            angularVelocity: previousSample.angularVelocity.clone(),
            at: previousSample.at,
          };
          networkBallSampleHistory.current.push(nextSample);
          while (networkBallSampleHistory.current.length > NETWORK_BALL_SAMPLE_HISTORY) {
            networkBallSampleHistory.current.shift();
          }
        }
        networkBallLatestSample.current = nextSample;
        if (!networkBallReady.current) {
          networkBallRenderVel.current.copy(nextSample.velocity);
          networkBallRenderAngVel.current.copy(nextSample.angularVelocity);
          networkBallReady.current = true;
        }
        if (serverDistanceFromLocal < 3.6 || hostShotLooksCaughtUp) {
          localBallPredictionUntil.current = 0;
        }
        localBallPredictionMinSpeed.current = 0;
      }
      if (
        !isLocalHoldingBall &&
        networkBallReady.current
      ) {
        const previousSample = networkBallPrevSample.current;
        const latestSample = networkBallLatestSample.current;
        if (previousSample && latestSample) {
          const renderAt =
            nowMs - NETWORK_BALL_INTERPOLATION_BACKTIME_SEC * 1000;
          const history = networkBallSampleHistory.current;
          let sampleFrom = previousSample;
          let sampleTo = latestSample;
          for (let i = history.length - 2; i >= 0; i--) {
            const a = history[i]!;
            const b = history[i + 1]!;
            if (renderAt >= a.at && renderAt <= b.at) {
              sampleFrom = a;
              sampleTo = b;
              break;
            }
          }
          const canInterpolate =
            sampleTo.at > sampleFrom.at &&
            renderAt <= sampleTo.at &&
            renderAt >= sampleFrom.at;
          if (canInterpolate) {
            const alpha = THREE.MathUtils.clamp(
              (renderAt - sampleFrom.at) /
                Math.max(1, sampleTo.at - sampleFrom.at),
              0,
              1,
            );
            networkBallRenderPos.current.lerpVectors(
              sampleFrom.position,
              sampleTo.position,
              alpha,
            );
            networkBallRenderVel.current.lerpVectors(
              sampleFrom.velocity,
              sampleTo.velocity,
              alpha,
            );
            networkBallRenderAngVel.current.lerpVectors(
              sampleFrom.angularVelocity,
              sampleTo.angularVelocity,
              alpha,
            );
          } else if (history.length > 0 && renderAt < history[0]!.at) {
            const oldest = history[0]!;
            networkBallRenderPos.current.copy(oldest.position);
            networkBallRenderVel.current.copy(oldest.velocity);
            networkBallRenderAngVel.current.copy(oldest.angularVelocity);
          } else {
            networkBallRenderPos.current.copy(latestSample.position);
            networkBallRenderVel.current.copy(latestSample.velocity);
            const speed = networkBallRenderVel.current.length();
            if (speed > NETWORK_BALL_MAX_EXTRAPOLATE_SPEED) {
              networkBallRenderVel.current.multiplyScalar(
                NETWORK_BALL_MAX_EXTRAPOLATE_SPEED / speed,
              );
            }
            const extraSec = Math.min(
              NETWORK_BALL_EXTRAPOLATE_SEC,
              Math.max(0, (renderAt - latestSample.at) / 1000),
            );
            networkBallRenderPos.current.addScaledVector(
              networkBallRenderVel.current,
              extraSec,
            );
            networkBallRenderAngVel.current.copy(latestSample.angularVelocity);
          }
          const current = ballForNetwork.translation();
          const predictionActive = nowMs < localBallPredictionUntil.current;
          const correction = networkBallCorrection.current.set(
            networkBallRenderPos.current.x - current.x,
            networkBallRenderPos.current.y - current.y,
            networkBallRenderPos.current.z - current.z,
          );
          const correctionDist = correction.length();
          if (!predictionActive && correctionDist > NETWORK_BALL_CORRECTION_SNAP_M) {
            ballForNetwork.setTranslation(networkBallRenderPos.current, true);
          } else {
            const correctionAlpha = predictionActive
              ? 1 - Math.exp(-dt * 6)
              : 1 - Math.exp(-dt * 18);
            correction.multiplyScalar(correctionAlpha);
            ballForNetwork.setTranslation(
              {
                x: current.x + correction.x,
                y: current.y + correction.y,
                z: current.z + correction.z,
              },
              true,
            );
          }
          if (predictionActive) {
            const lv = ballForNetwork.linvel();
            const av = ballForNetwork.angvel();
            const velAlpha = 1 - Math.exp(-dt * 8);
            ballForNetwork.setLinvel(
              {
                x: THREE.MathUtils.lerp(lv.x, networkBallRenderVel.current.x, velAlpha),
                y: THREE.MathUtils.lerp(lv.y, networkBallRenderVel.current.y, velAlpha),
                z: THREE.MathUtils.lerp(lv.z, networkBallRenderVel.current.z, velAlpha),
              },
              true,
            );
            ballForNetwork.setAngvel(
              {
                x: THREE.MathUtils.lerp(av.x, networkBallRenderAngVel.current.x, velAlpha),
                y: THREE.MathUtils.lerp(av.y, networkBallRenderAngVel.current.y, velAlpha),
                z: THREE.MathUtils.lerp(av.z, networkBallRenderAngVel.current.z, velAlpha),
              },
              true,
            );
          } else {
            ballForNetwork.setLinvel(networkBallRenderVel.current, true);
            ballForNetwork.setAngvel(networkBallRenderAngVel.current, true);
          }
        }
      }
    } else {
      networkBallReady.current = false;
      networkBallPrevSample.current = null;
      networkBallLatestSample.current = null;
      networkBallSampleHistory.current = [];
    }

    if (showBots) {
      botEnergySyncTimer.current -= dt;
      if (botEnergySyncTimer.current <= 0) {
        botEnergySyncTimer.current = 0.2;
        gameStore.setBotEnergies(botEnergyLevelsRef.current);
      }
    }

    if (inputManager.isEscape()) {
      document.exitPointerLock();
      onExit();
    }

    const player = playerBodyRef.current;
    const ball = ballBodyRef.current;
    let ps = 0;
    let bs = 0;
    if (player) {
      const v = player.linvel();
      ps = Math.hypot(v.x, v.y, v.z);
    }
    if (ball) {
      const v = ball.linvel();
      bs = Math.hypot(v.x, v.y, v.z);
    }
    gameStore.setSpeeds(ps, bs);

    const phase = gameStore.getState().phase;
    if (phase !== 'playing' && phase !== 'countdown') return;

    ballSpawnCooldown.current = Math.max(0, ballSpawnCooldown.current - dt);
    if (inputManager.consumeSpawnBall() && ballSpawnCooldown.current <= 0) {
      gameStore.beginKickoffDrop();
      ballRef.current?.parkAtDrop();
      ballSpawnCooldown.current = BALL.spawnCooldownSec;
    }
    if (inputManager.consumeBallRespawn() && ballSpawnCooldown.current <= 0) {
      gameStore.beginKickoffDrop();
      ballRef.current?.parkAtDrop();
      ballSpawnCooldown.current = BALL.spawnCooldownSec;
    }
  });

  const onPlayerPosition = useCallback(
    (
      pos: THREE.Vector3,
      chest: THREE.Vector3,
      pose: {
        yaw: number;
        pitch: number;
        velocity: { x: number; y: number; z: number };
        isBeaming: boolean;
        isHoldingBall: boolean;
        isSprinting?: boolean;
        holdPosition: { x: number; y: number; z: number } | null;
        coopRagdoll?: boolean;
      },
    ) => {
      playerPosRef.current.copy(pos);
      playerChestRef.current.copy(chest);
      setFanGlassListenerPosition(pos.x, pos.y, pos.z);
      setLightGlowProximityAnchor(pos);
      multiplayerStore.sendLocalPlayer({
        position: { x: pos.x, y: pos.y, z: pos.z },
        velocity: pose.velocity,
        rotation: { yaw: pose.yaw, pitch: pose.pitch },
        energy: gameStore.getState().energy,
        isBeaming: pose.isBeaming,
        isHoldingBall: pose.isHoldingBall,
        isSprinting: Boolean(pose.isSprinting ?? gameStore.getState().isSprinting),
        holdPosition: pose.holdPosition,
        coopRagdoll: Boolean(pose.coopRagdoll),
      });
    },
    [],
  );

  useEffect(() => () => clearLightGlowProximityAnchor(), []);

  const onPlayerBodyReady = useCallback((body: RapierRigidBody) => {
    playerBodyRef.current = body;
  }, []);

  const ballPosVec = useRef(new THREE.Vector3());
  const ballVelVec = useRef(new THREE.Vector3());
  const ballPos = useCallback(() => {
    const b = ballBodyRef.current;
    if (!b) return null;
    const t = b.translation();
    ballPosVec.current.set(t.x, t.y, t.z);
    return ballPosVec.current;
  }, []);
  const ballVel = useCallback(() => {
    const b = ballBodyRef.current;
    if (!b) return null;
    const lv = b.linvel();
    ballVelVec.current.set(lv.x, lv.y, lv.z);
    return ballVelVec.current;
  }, []);

  const armLocalBallPrediction = useCallback(
    (
      position: { x: number; y: number; z: number },
      velocity: { x: number; y: number; z: number },
      durationMs = 650,
      minSpeedScale = 0.55,
    ) => {
      localBallPredictionUntil.current = performance.now() + durationMs;
      localBallPredictionReleasePos.current.set(
        position.x,
        position.y,
        position.z,
      );
      localBallPredictionMinSpeed.current = Math.max(
        6,
        Math.hypot(velocity.x, velocity.y, velocity.z) * minSpeedScale,
      );
      networkBallReady.current = false;
      networkBallSampleHistory.current = [];
    },
    [],
  );

  const handleBotRagdollBurst = useCallback(
    (
      anchor: { x: number; y: number; z: number },
      follow: () => { x: number; y: number; z: number } | null,
      team: 'red' | 'blue',
    ) => {
      /* Explosion splash stays at rocket impact (handleExplosion) — only electric follows ragdoll */
      botRagdollFxRef.current?.spawn(
        anchor.x,
        anchor.y,
        anchor.z,
        team,
        follow,
      );
    },
    [],
  );

  const pullActive = useCallback(() => {
    const s = gameStore.getState();
    if (
      !s.isBeaming ||
      s.phase !== 'playing' ||
      s.ballHolderId !== null
    ) {
      return false;
    }
    const ball = ballPos();
    if (!ball) return false;
    return playerChestRef.current.distanceTo(ball) < BEAM.range;
  }, [ballPos]);

  const handleExplosion = useCallback((hit: ExplosionHit) => {
    const multiplayer = multiplayerStore.getState();
    if (!multiplayer.enabled && hit.fromOwnerId === 'local') {
      markLocalGoalShot(getLocalProfile().displayName, {
        x: hit.x,
        y: hit.y,
        z: hit.z,
      });
    }
    const now = performance.now();
    if (now - lastExplosionSfxAt.current > 70) {
      lastExplosionSfxAt.current = now;
      playRocketExplosion(
        hit.radius,
        { x: hit.x, y: hit.y, z: hit.z },
        {
          x: playerPosRef.current.x,
          y: playerPosRef.current.y,
          z: playerPosRef.current.z,
        },
      );
    }
    splashFxRef.current?.spawn(hit.x, hit.y, hit.z, hit.radius);
    if (hit.scorchKind === 'pillar' && hit.scorchPillarCx != null && hit.scorchPillarCz != null) {
      triggerArenaPillarShake(hit.scorchPillarCx, hit.scorchPillarCz);
    }
    if (
      hit.scorchNx !== undefined &&
      hit.scorchNy !== undefined &&
      hit.scorchNz !== undefined &&
      hit.scorchKind
    ) {
      wallImpactFxRef.current?.spawn(
        hit.x,
        hit.y,
        hit.z,
        hit.scorchNx,
        hit.scorchNy,
        hit.scorchNz,
        hit.scorchKind,
        hit.scorchPillarCx,
        hit.scorchPillarCz,
      );
    }
    registerBeamDenyZone(hit.x, hit.y, hit.z, hit.radius);

    const holder = gameStore.getState().ballHolderId;
    const ball = ballBodyRef.current;
    if (ball) {
      const bt = ball.translation();
      if (
        applyExplosionToBall(
          ball,
          bt.x,
          bt.y,
          bt.z,
          hit.x,
          hit.y,
          hit.z,
          hit.radius,
          holder !== null,
          hit.rocketVx,
          hit.rocketVy,
          hit.rocketVz,
          hit.ballImpactNx,
          hit.ballImpactNy,
          hit.ballImpactNz,
        )
      ) {
        const lv = ball.linvel();
        if (hit.fromOwnerId === 'local' || hit.fromOwnerId === multiplayer.selfId) {
          if (multiplayer.enabled && multiplayer.status === 'online') {
            multiplayerStore.sendRocketImpact({
              position: { x: hit.x, y: hit.y, z: hit.z },
              radius: hit.radius,
              rocketVelocity:
                hit.rocketVx !== undefined &&
                hit.rocketVy !== undefined &&
                hit.rocketVz !== undefined
                  ? { x: hit.rocketVx, y: hit.rocketVy, z: hit.rocketVz }
                  : undefined,
              ballImpactNormal:
                hit.ballImpactNx !== undefined &&
                hit.ballImpactNy !== undefined &&
                hit.ballImpactNz !== undefined
                  ? {
                      x: hit.ballImpactNx,
                      y: hit.ballImpactNy,
                      z: hit.ballImpactNz,
                    }
                  : undefined,
            });
          }
          armLocalBallPrediction(
            { x: bt.x, y: bt.y, z: bt.z },
            { x: lv.x, y: lv.y, z: lv.z },
            LOCAL_BALL_IMPACT_PREDICTION_MS,
            0.72,
          );
        }
        holdingBallRef.current = false;
        gameStore.clearBallHolder();
      }
    }
    botHitByExplosion(
      botsRef.current,
      hit.x,
      hit.y,
      hit.z,
      hit.radius,
      hit.rocketVx,
      hit.rocketVy,
      hit.rocketVz,
    );
    const player = playerBodyRef.current;
    if (player) {
      const chest = playerChestRef.current;
      const fromBot = hit.rocketVx !== undefined;
      const playerTr = player.translation();
      const { damage, rocketJump } = applyExplosionToPlayer(
        player,
        chest.x,
        chest.y,
        chest.z,
        hit.x,
        hit.y,
        hit.z,
        hit.radius,
        fromBot ? BOT.botRocketOnPlayerForceScale : 1,
        hit.rocketVx,
        hit.rocketVy,
        hit.rocketVz,
        playerFeetY(playerTr.y),
        hit.fromOwnerId,
      );
      if (rocketJump && !fromBot) {
        playerRocketBoostRef.current?.();
      }
      if (damage > 0) {
        const e = Math.max(0, gameStore.getState().energy - damage);
        gameStore.setEnergy(e, e <= 0);
      }
    }
  }, [armLocalBallPrediction]);

  const customMap = useSyncExternalStore(
    mapRegistryStore.subscribe,
    () => mapRegistryStore.getActiveMapDocument(),
  );
  const activeMapId = useSyncExternalStore(
    mapRegistryStore.subscribe,
    () => mapRegistryStore.getActiveMapId(),
  );
  const multiplayerRoomMode = useSyncExternalStore(
    multiplayerStore.subscribe,
    () => multiplayerStore.getState().roomInfo?.mode ?? null,
  );
  const trainingMapEnabled =
    activeMapId === TRAINING_MAP_ID || multiplayerRoomMode === 'training';
  const playStadiumGroups = getPlayModeStadiumGroups(customMap);
  const stadiumHidden = getHiddenStadiumPieces(playStadiumGroups);

  return (
    <>
      {!coopAdventureEnabled && (
        <>
          {!trainingMapEnabled && (
            <>
              <Arena
                hiddenGoalIds={stadiumHidden.hiddenGoalIds}
                hiddenPillarIndices={stadiumHidden.hiddenPillarIndices}
                hiddenPlatformIndices={stadiumHidden.hiddenPlatformIndices}
              />
              <CustomMapOverlay />
            </>
          )}
          {trainingMapEnabled && (
            <TrainingRangeMap
              ballBodyRef={ballBodyRef}
              playerPositionRef={playerPosRef}
            />
          )}
        </>
      )}
      {coopAdventureEnabled ? (
        <CoopAdventureCourse
          playerPositionRef={playerPosRef}
          playerBodyRef={playerBodyRef}
        />
      ) : (
        <Ball
          arenaInteractions={!trainingMapEnabled}
          ref={ballRef}
          onBotBallStrike={(actorId) => {
            if (!showBots) return;
            botBallStrikeFromPlayer(
              botsRef.current,
              actorId as BotId,
              ballBodyRef,
              botEnergyLevelsRef,
            );
          }}
        />
      )}
      {showBots && (
        <Bots
          botsRef={botsRef}
          ballBodyRef={ballBodyRef}
          playerChestRef={playerChestRef}
          playerBodyRef={playerBodyRef}
          botEnergyLevelsRef={botEnergyLevelsRef}
          onBotRagdollBurst={handleBotRagdollBurst}
        onRocketFired={(r) => {
          playRocketFire(r.explosive);
          rocketsRef.current = [r, ...rocketsRef.current].slice(
            0,
            ROCKET.maxActive,
          );
        }}
      />
      )}
      <Player
        ballBodyRef={ballBodyRef}
        canFireRocket={() => rocketsRef.current.length < ROCKET.maxActive}
        onRocketFired={(r) => {
          rocketsRef.current = [r, ...rocketsRef.current].slice(
            0,
            ROCKET.maxActive,
          );
          multiplayerStore.sendRocketFire(rocketToNetwork(r));
        }}
        onBallHeldChange={(v) => {
          holdingBallRef.current = v;
          holdingBallRef.current = v;
          if (v) {
            markLocalGoalShot(getLocalProfile().displayName, {
              x: playerPosRef.current.x,
              y: playerPosRef.current.y,
              z: playerPosRef.current.z,
            });
          }
        }}
        onBallReleased={(release) => {
          markLocalGoalShot(getLocalProfile().displayName, release.position);
          if (multiplayerStore.getState().enabled) {
            armLocalBallPrediction(release.position, release.velocity);
          }
          multiplayerStore.sendBallAction({
            kind: 'release',
            position: release.position,
            velocity: release.velocity,
            angularVelocity: release.angularVelocity,
            ballState: release.ballState,
          });
        }}
        onBeamBreak={() => {
          holdingBallRef.current = false;
          holdingBallRef.current = false;
        }}
        onPositionUpdate={onPlayerPosition}
        onPlayerBodyReady={onPlayerBodyReady}
        onRocketBoostRef={playerRocketBoostRef}
        disableArenaBounds={trainingMapEnabled}
      />
      <RemotePlayers />
      <DebugFreelook />
      {!coopAdventureEnabled && (
        <>
          <BeamVisual
            pullActive={pullActive}
            chestPosition={() => playerChestRef.current}
            ballPosition={ballPos}
            lowEnergy={beamLowEnergy}
            team={localTeam}
          />
          <RemoteBeamVisuals ballPosition={ballPos} />
          <RemoteBeamAudio ballPosition={ballPos} />
        </>
      )}
      <RocketExplosionSprites poolRef={splashFxRef} />
      {!trainingMapEnabled && <FanGlassCrackFx />}
      {!trainingMapEnabled && <PillarShakeSmoke />}
      <ImpactSparks />
      {!coopAdventureEnabled && !trainingMapEnabled && <GameplayCollisionDebug />}
      {!trainingMapEnabled && <RocketWallImpactFx poolRef={wallImpactFxRef} />}
      <BotRagdollBurstFx poolRef={botRagdollFxRef} />
      {!trainingMapEnabled && <BeamDenyZonesVisual />}
      {!trainingMapEnabled && <GoalFireworks />}
      <GroundSmashDust />
      {!coopAdventureEnabled && !trainingMapEnabled && (
        <ArenaPadMonitor ballBodyRef={ballBodyRef} />
      )}
      <RocketRecoilFx />
      <RocketTrailSmoke />
      <Rockets
        rocketsRef={rocketsRef}
        onExplosion={handleExplosion}
        playerPos={() => playerChestRef.current}
        botTargets={() => {
          if (!showBots) return [];
          botHitScratch.current.length = 0;
          for (const bot of botsRef.current) {
            const b = bot.bodyRef.current;
            if (!b) continue;
            const t = b.translation();
            botHitScratch.current.push({
              id: bot.id,
              x: t.x,
              y: t.y + BEAM.chestHeight,
              z: t.z,
            });
          }
          return botHitScratch.current;
        }}
        onBotDirectHit={(botId, vx, vy, vz, ownerId) => {
          if (!showBots) return;
          const ragdolled = botDirectRocketHit(
            botsRef.current,
            botId,
            vx,
            vy,
            vz,
            ballBodyRef,
            botEnergyLevelsRef,
            ownerId,
          );
          if (ownerId !== 'local') return;
          gameStore.recordRocketHit();
          if (ragdolled) {
            gameStore.recordKill();
            announceBotDestroyed('local', botId);
          } else {
            announceRocketPlayerHit('local', botId);
          }
        }}
        onPlayerDirectHit={(vx, vy, vz) => {
          const player = playerBodyRef.current;
          if (!player) return;
          const { damage, rocketJump } = applyDirectRocketToPlayer(
            player,
            vx,
            vy,
            vz,
          );
          if (rocketJump) {
            playerRocketBoostRef.current?.();
          }
          if (damage > 0) {
            const e = Math.max(0, gameStore.getState().energy - damage);
            gameStore.setEnergy(e, e <= 0);
          }
        }}
        ballPos={ballPos}
        ballVel={ballVel}
        disableArenaCollision={trainingMapEnabled}
        onBallDirectHit={(hit) => {
          if (!trainingMapEnabled) return;
          trainingMapStore.recordBallHit({
            normal: hit.normal,
            contact: hit.contact,
          });
        }}
      />
      {coopAdventureEnabled ? (
        <CoopAdventureMatchLoop />
      ) : (
        <MatchLoop ballRef={ballRef} botsRef={botsRef} />
      )}
      {!coopAdventureEnabled && !trainingMapEnabled && <PreMatchArenaFlyover />}
    </>
  );
}

export function GameCanvas({ onExit }: { onExit: () => void }) {
  const tune = useSyncExternalStore(tuningStore.subscribe, tuningStore.getState);
  const gfx = useSyncExternalStore(graphicsStore.subscribe, graphicsStore.getState);
  const effectiveShadows = gfx.shadows && !gfx.reallyBadPuter;
  const showColliderDebug = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().showColliderDebug,
  );
  const debugFreelook = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().debugFreelook,
  );
  const multiplayerEnabled = useSyncExternalStore(
    multiplayerStore.subscribe,
    () => multiplayerStore.getState().enabled,
  );
  const multiplayerRoomMode = useSyncExternalStore(
    multiplayerStore.subscribe,
    () => multiplayerStore.getState().roomInfo?.mode ?? null,
  );
  const activeMapId = useSyncExternalStore(
    mapRegistryStore.subscribe,
    () => mapRegistryStore.getActiveMapId(),
  );
  const coopAdventureEnabled =
    multiplayerEnabled && isCoopAdventureMode(multiplayerRoomMode);
  const trainingMapEnabled =
    activeMapId === TRAINING_MAP_ID || multiplayerRoomMode === 'training';
  const matchOver = useSyncExternalStore(gameStore.subscribe, () =>
    isMatchOver(gameStore.getState()),
  );
  const rocketsRef = useRef<ActiveRocket[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    resumeAudio();
    warmAudio();
  }, []);

  const tryCapturePointer = () => {
    if (matchOver || tuningStore.getState().showMenu || debugFreelook) return;
    const canvas = wrapRef.current?.querySelector('canvas');
    if (!canvas || document.pointerLockElement === canvas) return;
    resumeAudio();
    warmAudio();
    inputManager.onGameplayResume();
    inputManager.requestPointerLock(canvas);
  };

  return (
    <div
      ref={wrapRef}
      className={
        debugFreelook
          ? 'game-canvas game-canvas--debug-fly'
          : matchOver
            ? 'game-canvas game-canvas--match-end'
            : 'game-canvas'
      }
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        tryCapturePointer();
      }}
    >
      <Canvas
        style={{ background: '#181c22' }}
        camera={{ fov: 60, near: 0.1, far: 400, position: [0, 8, 42] }}
        dpr={
          gfx.reallyBadPuter
            ? [0.75, 0.75]
            : gfx.badPuter
              ? [1, 1]
              : [RENDER.dprMin, RENDER.dprMax]
        }
        gl={{
          antialias: gfx.badPuter || gfx.reallyBadPuter ? false : RENDER.antialias,
          powerPreference: 'high-performance',
          alpha: false,
          stencil: false,
        }}
        shadows={effectiveShadows}
        onCreated={({ gl }) => {
          gl.domElement.tabIndex = 0;
          gl.domElement.style.outline = 'none';
          gl.setClearColor('#181c22', 1);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = gfx.exposure;
          if (effectiveShadows) {
            gl.shadowMap.type = shadowMapTypeToThree(gfx.shadowMapType);
          }
          gl.domElement.addEventListener(
            'webglcontextlost',
            (e) => {
              e.preventDefault();
              console.warn(
                '[RocccitBall] WebGL context lost — do a full page refresh (Ctrl+Shift+R).',
              );
            },
            false,
          );
        }}
      >
        <SceneEnvironment />
        {!trainingMapEnabled && (
          <>
            <ArenaSky />
            <ArenaLighting />
            <ArenaAtmosphere />
          </>
        )}
        <Suspense fallback={null}>
          <Physics
            gravity={[0, tune.gravity, 0]}
            timeStep={1 / 60}
            debug={showColliderDebug && !coopAdventureEnabled}
          >
            <Scene onExit={onExit} rocketsRef={rocketsRef} />
          </Physics>
        </Suspense>
        <ScenePostFX />
      </Canvas>
    </div>
  );
}
