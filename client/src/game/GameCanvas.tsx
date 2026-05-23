import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics, type RapierRigidBody } from '@react-three/rapier';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSyncExternalStore } from 'react';
import { BALL, BEAM, BOT, MATCH, RENDER, ROCKET } from '../shared/Constants';
import { tuningStore } from './tuningStore';
import { Arena } from './Arena';
import { ArenaLighting } from './ArenaLighting';
import { Ball, type BallHandle } from './Ball';
import { BallCarryVisual } from './BallCarryVisual';
import { BeamVisual } from './BeamVisual';
import { resetBeamContest } from './ballBeamContest';
import { gameStore } from './gameStore';
import { inputManager } from './InputManager';
import { Player } from './Player';
import { Rockets } from './Rockets';
import { checkGoalScore } from './scoring';
import type { ActiveRocket } from './rocketSystem';
import {
  applyExplosionToBall,
  applyExplosionToPlayer,
  type ExplosionHit,
} from './explosions';
import {
  playGoalCelebration,
  playRocketExplosion,
  playRocketFire,
  resumeAudio,
  warmAudio,
} from './audio';
import {
  ExplosionSplashes,
  type ExplosionSplashesHandle,
} from './ExplosionSplashes';
import { GoalFireworks } from './GoalFireworks';
import { registerBeamDenyZone } from './beamDenyZones';
import { BeamDenyZonesVisual } from './beamDenyZonesVisual';
import {
  Bots,
  botDirectRocketHit,
  botHitByExplosion,
  type BotId,
  type BotRuntime,
} from './Bots';
import { FallRecoveryMonitor } from './FallRecoveryMonitor';

function MatchLoop({
  ballRef,
  ballBodyRef,
  rocketsRef,
  botsRef,
  setHoldingBall,
  playerChestRef,
  onExplosion,
  botTargets,
  onBotDirectHit,
  ballPos,
}: {
  ballRef: React.RefObject<BallHandle | null>;
  ballBodyRef: React.RefObject<RapierRigidBody | null>;
  rocketsRef: React.MutableRefObject<ActiveRocket[]>;
  botsRef: React.MutableRefObject<BotRuntime[]>;
  setHoldingBall: (v: boolean) => void;
  playerChestRef: React.RefObject<THREE.Vector3>;
  onExplosion: (hit: ExplosionHit) => void;
  botTargets: () => { id: BotId; x: number; y: number; z: number }[];
  onBotDirectHit: (botId: BotId, vx: number, vy: number, vz: number) => void;
  ballPos: () => THREE.Vector3 | null;
}) {
  const scoreCooldown = useRef(0);
  const matchTimer = useRef(MATCH.durationSec);
  const countdownTimer = useRef(0);
  const countdownEntered = useRef(false);

  useFrame((_, dt) => {
    const state = gameStore.getState();

    if (state.phase === 'playing') {
      matchTimer.current -= dt;
      gameStore.setTimeLeft(Math.max(0, Math.ceil(matchTimer.current)));
      if (matchTimer.current <= 0) gameStore.setPhase('paused');
    }

    if (state.phase === 'countdown') {
      if (!countdownEntered.current) {
        countdownEntered.current = true;
        countdownTimer.current = state.countdown;
        ballRef.current?.parkAtDrop();
      }
      countdownTimer.current -= dt;
      const display = Math.ceil(countdownTimer.current);
      if (display > 0 && state.countdown !== display) {
        gameStore.setCountdown(display);
      }
      if (countdownTimer.current <= 0) {
        countdownEntered.current = false;
        ballRef.current?.reset();
        gameStore.resumeAfterScore();
      }
      return;
    }

    countdownEntered.current = false;

    scoreCooldown.current -= dt;
    if (scoreCooldown.current > 0 || state.ballFrozen) return;

    const body = ballBodyRef.current;
    if (!body) return;
    const t = body.translation();
    const hit = checkGoalScore({ x: t.x, y: t.y, z: t.z });
    if (!hit) return;

    scoreCooldown.current = MATCH.scorePauseSec + MATCH.resetCountdownSec + 1;
    gameStore.addScore(hit.scoringTeam, hit.points, hit.goalPos);
    playGoalCelebration();
    setHoldingBall(false);
    gameStore.clearBallHolder();
    for (const b of botsRef.current) {
      b.holdingBall = false;
    }
    resetBeamContest();
    countdownTimer.current = MATCH.resetCountdownSec;
    countdownEntered.current = false;
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    gameStore.setBallState('scored');
  });

  return (
    <Rockets
      rocketsRef={rocketsRef}
      onExplosion={onExplosion}
      playerPos={() => playerChestRef.current}
      botTargets={botTargets}
      onBotDirectHit={onBotDirectHit}
      ballPos={ballPos}
    />
  );
}

function Scene({ onExit }: { onExit: () => void }) {
  const ballRef = useRef<BallHandle>(null);
  const ballBodyRef = useRef<RapierRigidBody | null>(null);
  const rocketsRef = useRef<ActiveRocket[]>([]);
  const [holdingBall, setHoldingBall] = useState(false);
  const holdingBallRef = useRef(false);
  const splashFxRef = useRef<ExplosionSplashesHandle | null>(null);
  const setHoldingBallSynced = useCallback((v: boolean) => {
    holdingBallRef.current = v;
    setHoldingBall(v);
  }, []);
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
  const { gl } = useThree();
  const beamLowEnergy = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().energy < 25,
  );
  const botsEnabled = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().botsEnabled,
  );

  useEffect(() => {
    ballBodyRef.current = ballRef.current?.getBody() ?? null;
    const id = setInterval(() => {
      ballBodyRef.current = ballRef.current?.getBody() ?? null;
    }, 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!botsEnabled) {
      botsRef.current = [];
    }
  }, [botsEnabled]);

  useEffect(() => {
    const canvas = gl.domElement;
    inputManager.bind(canvas);
    inputManager.resetLookForTeam(gameStore.getState().localTeam);

    const tryLock = () => {
      if (document.pointerLockElement !== canvas) {
        inputManager.requestPointerLock(canvas);
      }
    };
    tryLock();
    const lockTimer = window.setTimeout(tryLock, 100);

    return () => clearTimeout(lockTimer);
  }, [gl]);

  useFrame((_, dt) => {
    if (botsEnabled) {
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
    if (
      inputManager.consumeSpawnBall() &&
      ballSpawnCooldown.current <= 0 &&
      !gameStore.getState().isHoldingBall &&
      !gameStore.getState().ballFrozen
    ) {
      ballRef.current?.spawn();
      ballSpawnCooldown.current = BALL.spawnCooldownSec;
    }
  });

  const onPlayerPosition = useCallback(
    (pos: THREE.Vector3, chest: THREE.Vector3) => {
      playerPosRef.current.copy(pos);
      playerChestRef.current.copy(chest);
    },
    [],
  );

  const ballPosVec = useRef(new THREE.Vector3());
  const ballPos = useCallback(() => {
    const b = ballBodyRef.current;
    if (!b) return null;
    const t = b.translation();
    ballPosVec.current.set(t.x, t.y, t.z);
    return ballPosVec.current;
  }, []);

  const pullActive = useCallback(() => {
    const s = gameStore.getState();
    if (!s.isBeaming || s.phase !== 'playing' || s.ballHolderId !== null) return false;
    const ball = ballPos();
    if (!ball) return false;
    return playerChestRef.current.distanceTo(ball) < BEAM.range;
  }, [ballPos]);

  const handleExplosion = useCallback((hit: ExplosionHit) => {
    playRocketExplosion(hit.radius);
    splashFxRef.current?.spawn(hit.x, hit.y, hit.z, hit.radius);
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
        )
      ) {
        holdingBallRef.current = false;
        setHoldingBall(false);
        gameStore.clearBallHolder();
      }
    }
    botHitByExplosion(
      botsRef.current,
      hit.x,
      hit.y,
      hit.z,
      hit.radius,
      ballBodyRef,
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

  return (
    <>
      <color attach="background" args={['#1a2438']} />
      <fog attach="fog" args={['#2a3850', 90, 240]} />

      <ArenaLighting />

      <Arena />
      <Ball ref={ballRef} />
      {botsEnabled && (
        <Bots
          botsRef={botsRef}
          ballBodyRef={ballBodyRef}
          playerChestRef={playerChestRef}
          playerBodyRef={playerBodyRef}
          botEnergyLevelsRef={botEnergyLevelsRef}
          onRocketFired={(r) => {
            playRocketFire(r.explosive);
            const next = [...rocketsRef.current, r];
            rocketsRef.current =
              next.length > ROCKET.maxActive
                ? next.slice(-ROCKET.maxActive)
                : next;
          }}
        />
      )}
      <Player
        ballBodyRef={ballBodyRef}
        onRocketFired={(r) => {
          playRocketFire(r.explosive);
          const next = [...rocketsRef.current, r];
          rocketsRef.current =
            next.length > ROCKET.maxActive
              ? next.slice(-ROCKET.maxActive)
              : next;
        }}
        onBallHeldChange={(v) => {
          setHoldingBallSynced(v);
          if (v) gameStore.setBallHolder('local');
          else if (gameStore.getState().ballHolderId === 'local') {
            gameStore.clearBallHolder();
          }
        }}
        onBeamBreak={() => {
          setHoldingBallSynced(false);
          if (gameStore.getState().ballHolderId === 'local') {
            gameStore.clearBallHolder();
          }
        }}
        onPositionUpdate={onPlayerPosition}
        onPlayerBodyReady={(body) => {
          playerBodyRef.current = body;
        }}
        onRocketBoostRef={playerRocketBoostRef}
      />
      <BeamVisual
        pullActive={pullActive}
        chestPosition={() => playerChestRef.current}
        ballPosition={ballPos}
        lowEnergy={beamLowEnergy}
      />
      <BallCarryVisual
        active={holdingBall}
        ballPosition={ballPos}
      />
      <ExplosionSplashes poolRef={splashFxRef} />
      <BeamDenyZonesVisual />
      <GoalFireworks />
      <FallRecoveryMonitor
        playerBodyRef={playerBodyRef}
        ballBodyRef={ballBodyRef}
        botsRef={botsRef}
        onRecoverPlayer={() => {
          holdingBallRef.current = false;
          setHoldingBall(false);
        }}
        onRecoverBall={() => gameStore.clearBallHolder()}
      />
      <MatchLoop
        ballRef={ballRef}
        ballBodyRef={ballBodyRef}
        rocketsRef={rocketsRef}
        botsRef={botsRef}
        setHoldingBall={setHoldingBallSynced}
        playerChestRef={playerChestRef}
        ballPos={ballPos}
        onExplosion={handleExplosion}
        botTargets={() => {
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
        onBotDirectHit={(botId, vx, vy, vz) => {
          botDirectRocketHit(
            botsRef.current,
            botId,
            vx,
            vy,
            vz,
            ballBodyRef,
          );
        }}
      />
    </>
  );
}

export function GameCanvas({ onExit }: { onExit: () => void }) {
  const tune = useSyncExternalStore(tuningStore.subscribe, tuningStore.getState);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    resumeAudio();
    warmAudio();
  }, []);

  const handleClick = () => {
    resumeAudio();
    warmAudio();
    if (tuningStore.getState().showMenu) return;
    const canvas = wrapRef.current?.querySelector('canvas');
    if (canvas && document.pointerLockElement !== canvas) {
      inputManager.requestPointerLock(canvas);
    }
  };

  return (
    <div ref={wrapRef} className="game-canvas" onClick={handleClick}>
      <Canvas
        camera={{ fov: 60, near: 0.1, far: 400, position: [0, 5, 30] }}
        dpr={[RENDER.dprMin, RENDER.dprMax]}
        gl={{
          antialias: RENDER.antialias,
          powerPreference: 'high-performance',
          alpha: false,
          stencil: false,
        }}
        shadows={RENDER.enableShadows}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 1.22;
          if (RENDER.enableShadows) {
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
          }
        }}
      >
        <Suspense fallback={null}>
          <Physics gravity={[0, tune.gravity, 0]} timeStep={1 / 60}>
            <Scene onExit={onExit} />
          </Physics>
        </Suspense>
      </Canvas>
    </div>
  );
}
