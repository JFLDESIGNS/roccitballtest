import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics, type RapierRigidBody } from '@react-three/rapier';
import { Suspense, useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useSyncExternalStore } from 'react';
import { BALL, BEAM, BOT, MATCH, RENDER, ROCKET } from '../shared/Constants';
import { ArenaAtmosphere } from './ArenaAtmosphere';
import { graphicsStore } from './graphicsStore';
import { SceneEnvironment } from './SceneEnvironment';
import { ScenePostFX } from './ScenePostFX';
import { tuningStore } from './tuningStore';
import { Arena } from './Arena';
import { CustomMapOverlay } from '../mapEditor/CustomMapOverlay';
import { mapRegistryStore } from '../mapEditor/mapEditorStore';
import { getHiddenStadiumPieces } from '../mapEditor/stadiumLayout';
import { ArenaLighting } from './ArenaLighting';
import { Ball, type BallHandle } from './Ball';
import { BeamVisual } from './BeamVisual';
import { gameStore } from './gameStore';
import { setFanGlassListenerPosition } from './fanGlassHit';
import { inputManager } from './InputManager';
import { Player } from './Player';
import { Rockets } from './Rockets';
import {
  goalScoreRuntime,
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
  stopMatchAudio,
  warmAudio,
} from './audio';
import {
  RocketExplosionSprites,
  type RocketExplosionSpritesHandle,
} from './RocketExplosionSprites';
import {
  RocketWallImpactFx,
  type RocketWallImpactFxHandle,
} from './RocketWallImpactFx';
import {
  BotRagdollBurstFx,
  type BotRagdollBurstHandle,
} from './BotRagdollBurstFx';
import { GoalFireworks } from './GoalFireworks';
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
import { FallRecoveryMonitor } from './FallRecoveryMonitor';
import { MatchIntroTimer } from './MatchIntroTimer';
import { MapLoadTimer } from './MapLoadTimer';
import { ArenaPadMonitor } from './ArenaPadMonitor';
import {
  announceBotDestroyed,
  announceRocketPlayerHit,
} from './announcements';
import { setKickoffBallReleaseHandler } from './kickoffDrop';

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
    postScoreKickoffPending.current = false;
  }, [matchGeneration]);

  useEffect(() => {
    registerGoalScoreBotProvider(() => botsRef.current);
  }, [botsRef]);

  useFrame((_, dt) => {
    tickGoalScoreRuntime(dt);
    const state = gameStore.getState();

    if (state.phase === 'intro' || state.phase === 'loading') {
      return;
    }

    if (state.phase === 'playing') {
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
  const showBots = botsEnabled;

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
    if (showBots) {
      botEnergySyncTimer.current -= dt;
      if (botEnergySyncTimer.current <= 0) {
        botEnergySyncTimer.current = 0.2;
        gameStore.setBotEnergies(botEnergyLevelsRef.current);
      }
    }

    if (inputManager.isEscape()) {
      document.exitPointerLock();
      stopMatchAudio();
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
  });

  const onPlayerPosition = useCallback(
    (pos: THREE.Vector3, chest: THREE.Vector3) => {
      playerPosRef.current.copy(pos);
      playerChestRef.current.copy(chest);
      setFanGlassListenerPosition(pos.x, pos.y, pos.z);
    },
    [],
  );

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
      );
      if (rocketJump && !fromBot) {
        playerRocketBoostRef.current?.();
      }
      if (damage > 0) {
        const e = Math.max(0, gameStore.getState().energy - damage);
        gameStore.setEnergy(e, e <= 0);
      }
    }
  }, []);

  const customMap = useSyncExternalStore(
    mapRegistryStore.subscribe,
    () => mapRegistryStore.getActiveMapDocument(),
  );
  const stadiumHidden = customMap
    ? getHiddenStadiumPieces(customMap.groups)
    : { hiddenGoalIds: [] as string[], hiddenPillarIndices: [] as number[] };

  return (
    <>
      <Arena
        hiddenGoalIds={stadiumHidden.hiddenGoalIds}
        hiddenPillarIndices={stadiumHidden.hiddenPillarIndices}
      />
      <CustomMapOverlay />
      <Ball
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
        }}
        onBallHeldChange={(v) => {
          holdingBallRef.current = v;
          holdingBallRef.current = v;
        }}
        onBeamBreak={() => {
          holdingBallRef.current = false;
          holdingBallRef.current = false;
        }}
        onPositionUpdate={onPlayerPosition}
        onPlayerBodyReady={onPlayerBodyReady}
        onRocketBoostRef={playerRocketBoostRef}
      />
      <BeamVisual
        pullActive={pullActive}
        chestPosition={() => playerChestRef.current}
        ballPosition={ballPos}
        lowEnergy={beamLowEnergy}
        team={localTeam}
      />
      <RocketExplosionSprites poolRef={splashFxRef} />
      <RocketWallImpactFx poolRef={wallImpactFxRef} />
      <BotRagdollBurstFx poolRef={botRagdollFxRef} />
      <BeamDenyZonesVisual />
      <GoalFireworks />
      <ArenaPadMonitor ballBodyRef={ballBodyRef} />
      <FallRecoveryMonitor
        playerBodyRef={playerBodyRef}
        ballBodyRef={ballBodyRef}
        botsRef={botsRef}
        onRecoverPlayer={() => {
          holdingBallRef.current = false;
          holdingBallRef.current = false;
        }}
        onRecoverBall={() => gameStore.clearBallHolder()}
      />
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
      />
      <MatchLoop ballRef={ballRef} botsRef={botsRef} />
      <MatchIntroTimer />
      <MapLoadTimer />
    </>
  );
}

export function GameCanvas({ onExit }: { onExit: () => void }) {
  const tune = useSyncExternalStore(tuningStore.subscribe, tuningStore.getState);
  const gfx = useSyncExternalStore(graphicsStore.subscribe, graphicsStore.getState);
  const showColliderDebug = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().showColliderDebug,
  );
  const rocketsRef = useRef<ActiveRocket[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    resumeAudio();
    warmAudio();
  }, []);

  const handleClick = () => {
    if (tuningStore.getState().showMenu) return;
    const canvas = wrapRef.current?.querySelector('canvas');
    if (!canvas || document.pointerLockElement === canvas) return;
    resumeAudio();
    warmAudio();
    inputManager.requestPointerLock(canvas);
  };

  return (
    <div ref={wrapRef} className="game-canvas" onClick={handleClick}>
      <Canvas
        style={{ background: '#1a2438' }}
        camera={{ fov: 60, near: 0.1, far: 400, position: [0, 8, 42] }}
        dpr={[RENDER.dprMin, RENDER.dprMax]}
        gl={{
          antialias: RENDER.antialias,
          powerPreference: 'high-performance',
          alpha: false,
          stencil: false,
        }}
        shadows={gfx.shadows}
        onCreated={({ gl }) => {
          gl.domElement.tabIndex = 0;
          gl.domElement.style.outline = 'none';
          gl.setClearColor('#5a7090', 1);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = gfx.exposure;
          if (gfx.shadows) {
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
          }
        }}
      >
        <SceneEnvironment />
        <ArenaLighting />
        <ArenaAtmosphere rocketsRef={rocketsRef} />
        <Suspense fallback={null}>
          <Physics
            gravity={[0, tune.gravity, 0]}
            timeStep={1 / 60}
            debug={showColliderDebug}
          >
            <Scene onExit={onExit} rocketsRef={rocketsRef} />
          </Physics>
        </Suspense>
        <ScenePostFX />
      </Canvas>
    </div>
  );
}
