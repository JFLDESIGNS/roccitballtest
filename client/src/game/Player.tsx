import { useFrame, useThree } from '@react-three/fiber';
import {
  CapsuleCollider,
  interactionGroups,
  RigidBody,
  useAfterPhysicsStep,
  useRapier,
  type CollisionEnterPayload,
  type RapierRigidBody,
} from '@react-three/rapier';
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import {
  ARENA,
  BALL,
  BEAM,
  CAMERA,
  ENERGY,
  MOVEMENT,
  ROCKET,
} from '../shared/Constants';
import {
  captureBallSocket,
  releaseBallPhysics,
  smoothHoldSocketTarget,
  updateBallSocketSmooth,
} from './ballAttach';
import { resolveHeldBallPosition } from './ballHoldResolve';
import {
  applyBeamAttraction,
  beamGrabDistance,
  canPlayerContactCapture,
} from './beamPhysics';
import { separateBallFromPlayer } from './ballPlayerSeparation';
import { applyBallLaunchImpulse } from './ballPhysics';
import { clampToHex } from './arenaHex';
import { getTeamSpawn } from './goals';
import {
  getCameraBasis,
  pointOnCrosshairAimRay,
  updateThirdPersonCamera,
} from './CameraController';
import { triggerForwardFlip } from './forwardFlipEmote';
import { gameStore, type GamePhase } from './gameStore';
import { PlayerAvatar } from './PlayerAvatar';
import { PlayerJumpHat } from './PlayerJumpHat';
import { PlayerVisualProxy } from './PlayerVisualProxy';
import {
  alignCharacterVisualUpright,
  clearKnockVisualTumble,
  createKnockVisualTumbleState,
  createVisualRecoveryState,
  forceCharacterUpright,
  impulseKnockVisualTumble,
  resetCharacterVisualGroups,
  snapRigidBodyUpright,
  syncCharacterVisualPresentation,
  tickCharacterVisualRecovery,
  tickKnockVisualTumble,
} from './characterVisual';
import {
  CHARACTER_MESH_RENDER_ORDER,
} from './JerseyDecal';
import { PlayerDroneThrusters } from './BotDroneVisual';
import { LocalHeldBallVisual } from './LocalHeldBallVisual';
import { PlayerMotionRibbons } from './PlayerMotionRibbons';
import {
  beginLocalHeldBallRelease,
  heldBallVisualBridge,
  markLocalHeldBallCarry,
} from './heldBallVisualBridge';
import { inputManager } from './InputManager';
import {
  playBallLaunch,
  playDash,
  playCeilingBump,
  playJump,
  playRocketFire,
  playRocketEmpty,
  playBeamNoLock,
  setBeamAttractActive,
  setGrindRailActive,
} from './audio';
import { triggerCeilingWallHit } from './visualShake';
import {
  averageMomentum,
  resetMomentumSamples,
  tickMomentumSamples,
} from './launchMomentum';
import {
  computeBeamReleaseVelocity,
  computeDirectedShotVelocity,
  computeBallLaunchSpawn,
} from './launchShot';
import {
  computeSuperReleaseDropVelocity,
  computeSuperReleaseShotVelocity,
  computeSuperReleaseSpawn,
  smoothSuperReleaseHoldSocket,
} from './superRelease';
import {
  blendPlayerKnockStunMovement,
  isPlayerGoalEjectMoveLocked,
  isPlayerKnockStunActive,
  tickPlayerKnockStun,
} from './rocketKnockStun';
import { tuningStore } from './tuningStore';
import { isBeamDenied, registerBeamDenyZone } from './beamDenyZones';
import { canCaptureWithContest, recordBeamPull } from './ballBeamContest';
import { triggerRocketRecoil } from './rocketRecoil';
import { createRocket } from './rocketSystem';
import { sampleTrampolineFloorY } from './arenaPadLayout';
import {
  applyPlayerStepUp,
  playerFeetY,
  probePlayerGround,
} from './playerGroundProbe';
import {
  tryPlayerPads,
  isPlayerInTrampolineZone,
  isPlayerOverTrampolineDeck,
} from './arenaPadPhysics';
import { PLAYER_RIM_PROBE_RADIUS } from './goalRingBounce';
import { tickGoalEntryCharacterBounce } from './goalNetBounce';
import { tryBallGoalScoreAtPoint } from './goalScoreHandler';
import { multiplayerStore } from '../multiplayer/multiplayerStore';
import {
  GRIND_RAIL,
  sampleGrindRailContact,
  setGrindRailGlow,
} from './grindRail';
import { burstGrindRailSparks } from './impactSparks';

const PLAYER_LOOSE_COLLISION = interactionGroups(0, [0, 1, 2, 4]);
const PLAYER_CARRY_COLLISION = interactionGroups(0, [0, 2, 4]);
const PLAYER_DEBUG_NOCLIP = interactionGroups(0, []);

/** Smooth 0→1 ramp for speed-based camera pull-back */
function speedCameraFactor(
  moveSpeed: number,
  walkSpeed: number,
  sprintSpeed: number,
): number {
  const span = Math.max(0.01, sprintSpeed - walkSpeed);
  const raw = THREE.MathUtils.clamp((moveSpeed - walkSpeed) / span, 0, 1);
  return raw * raw * (3 - 2 * raw);
}

const _moveVelXZ = new THREE.Vector3();
const _ePropelDir = new THREE.Vector3();

function ePropelImpulseThreshold(index: number): number {
  const n = MOVEMENT.ePropelImpulseCount;
  if (n <= 1) return 0;
  return (index / (n - 1)) * MOVEMENT.ePropelDurationSec;
}

/** Camera look direction (yaw + pitch) for E propel. */
function resolveEPropelDirection(
  out: THREE.Vector3,
  lookDir: THREE.Vector3,
): void {
  out.copy(lookDir);
  if (out.lengthSq() < 1e-6) out.set(0, 0, -1);
  else out.normalize();
}

/** Camera-relative wish velocity — strafe (A/D) faster than forward/back */
function cameraMoveTargetXZ(
  out: THREE.Vector3,
  forward: THREE.Vector3,
  right: THREE.Vector3,
  move: { x: number; y: number },
  speed: number,
): void {
  const strafeSpd = speed * MOVEMENT.strafeSpeedScale;
  out.set(0, 0, 0)
    .addScaledVector(forward, move.y * speed)
    .addScaledVector(right, -move.x * strafeSpd);
  const h = Math.hypot(out.x, out.z);
  if (h < 1e-6) return;
  const pureStrafe =
    Math.abs(move.x) > 0.01 && Math.abs(move.y) < 0.01;
  const maxH = pureStrafe ? strafeSpd : speed;
  if (h > maxH) out.multiplyScalar(maxH / h);
}

function smoothAsymmetric(
  current: number,
  target: number,
  dt: number,
  rateIn: number,
  rateOut: number,
): number {
  const rate = target > current ? rateIn : rateOut;
  const alpha = 1 - Math.exp(-rate * dt);
  return current + (target - current) * alpha;
}

type PlayerProps = {
  ballBodyRef: React.RefObject<RapierRigidBody | null>;
  onRocketFired: (rocket: ReturnType<typeof createRocket>) => void;
  onBallHeldChange: (held: boolean) => void;
  onBallReleased?: (release: {
    position: { x: number; y: number; z: number };
    velocity: { x: number; y: number; z: number };
    ballState: 'loose' | 'launched';
  }) => void;
  onBeamBreak: () => void;
  onPositionUpdate: (
    pos: THREE.Vector3,
    chest: THREE.Vector3,
    pose: {
      yaw: number;
      pitch: number;
      velocity: { x: number; y: number; z: number };
      isBeaming: boolean;
      isHoldingBall: boolean;
      holdPosition: { x: number; y: number; z: number } | null;
    },
  ) => void;
  onPlayerBodyReady: (body: RapierRigidBody) => void;
  /** Return false when rockets are maxed out / empty */
  canFireRocket?: () => boolean;
  /** GameCanvas calls after a rocket blast knocks the player — refill jumps */
  onRocketBoostRef?: React.MutableRefObject<(() => void) | null>;
};

export function Player({
  ballBodyRef,
  onRocketFired,
  onBallHeldChange,
  onBallReleased,
  onBeamBreak,
  onPositionUpdate,
  onPlayerBodyReady,
  onRocketBoostRef,
  canFireRocket,
}: PlayerProps) {
  const localTeam = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().localTeam,
  );
  const playerVisualProxy = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().playerVisualProxy,
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
  const multiplayerTeamSlot = useSyncExternalStore(
    multiplayerStore.subscribe,
    () => multiplayerStore.getState().teamSlot,
  );
  const bodyRef = useRef<RapierRigidBody>(null);
  const visualRef = useRef<THREE.Group>(null);
  const tiltRef = useRef<THREE.Group>(null);
  const bobRef = useRef<THREE.Group>(null);
  const pitchSmooth = useRef(0);
  const bobPhase = useRef(0);
  const visualRecovery = useRef(createVisualRecoveryState());
  const knockTumble = useRef(createKnockVisualTumbleState());
  const knockStunWasActive = useRef(false);
  const camSpeedExtra = useRef(0);
  const thrusterThrottle = useRef(0);
  const thrusterJumpBoost = useRef(0);
  const { camera } = useThree();
  const { world } = useRapier();
  const velocity = useRef(new THREE.Vector3());
  const grounded = useRef(true);
  const jumpsLeft = useRef<number>(MOVEMENT.maxJumps);
  const jumpAirGrace = useRef(0);
  const coyoteTime = useRef(0);
  const _wishDir = useRef(new THREE.Vector3());
  /** One fire SFX per LMB press; edge attempt skips release retry */
  const firePressHandled = useRef(false);
  const dashCooldown = useRef(0);
  const rocketFireCooldown = useRef(0);
  const dashActiveTimer = useRef(0);
  const goalNetCooldown = useRef(0);
  const goalRimCooldown = useRef(0);
  const _dashDir = useRef(new THREE.Vector3());
  const ePropelTimer = useRef(0);
  const ePropelElapsed = useRef(0);
  const ePropelImpulsesApplied = useRef(0);
  const ePropelCooldown = useRef(0);
  const ePropelVyBoost = useRef<number | null>(null);
  const energy = useRef<number>(ENERGY.max);
  const regenTimer = useRef(0);
  const draining = useRef(false);
  const holdingBall = useRef(false);
  const playerCarryingBall = useRef(false);
  const ballReleaseLockUntil = useRef(0);
  /** After rocket hit — no beam attract on player body */
  const playerBeamDenyUntil = useRef(0);
  const ballSeparationGraceUntil = useRef(0);
  /** After LMB ball shot, beam stays off until RMB is released and pressed again */
  const beamNeedsRepress = useRef(false);
  const beamNoLockSoundAt = useRef(0);
  const spawnApplied = useRef(false);
  const spawnInitialized = useRef(false);
  const chestPos = useRef(new THREE.Vector3());
  const _posScratch = useRef(new THREE.Vector3());
  const _beamBallPos = useRef(new THREE.Vector3());
  const pivotRef = useRef(new THREE.Vector3());
  const cameraSnapped = useRef(false);
  const lastPhaseRef = useRef<GamePhase>('menu');
  const launchMomentumSamples = useRef<THREE.Vector3[]>([]);
  const launchMomentumTimer = useRef(0);
  const ballSwingSamples = useRef<THREE.Vector3[]>([]);
  const ballSwingTimer = useRef(0);
  const lastHoldSocketPos = useRef(new THREE.Vector3());
  const holdSocketReady = useRef(false);
  const holdLatchT = useRef(1);
  const _holdSocket = useRef(new THREE.Vector3());
  const _swingVelScratch = useRef(new THREE.Vector3());
  const _launchVel = useRef(new THREE.Vector3());
  const fireHoldStart = useRef<number | null>(null);
  const chargedRocketFired = useRef(false);
  /** LMB press on this click launched the ball — skip tap rocket on release */
  const fireLaunchedBall = useRef(false);
  /** After a ball shot — wait for LMB release before rockets can fire */
  const blockRocketsUntilFireUp = useRef(false);
  const blockRocketsUntil = useRef(0);
  const holdSocketSmoothed = useRef(new THREE.Vector3());
  const holdSocketSmoothReady = useRef(false);
  const _rocketOrigin = useRef(new THREE.Vector3());
  const grindRailActive = useRef(false);
  const grindRailSpeed = useRef(0);
  const grindRailDir = useRef(new THREE.Vector2(1, 0));
  const grindRailCooldown = useRef(0);
  const grindRailWobble = useRef(0);
  const grindRailSparkTimer = useRef(0);
  const stopGrindRailRide = useCallback((cooldownSec = 0) => {
    if (grindRailActive.current) {
      grindRailActive.current = false;
      setGrindRailActive(false);
    }
    setGrindRailGlow({ active: false });
    grindRailSpeed.current = 0;
    grindRailWobble.current = 0;
    grindRailSparkTimer.current = 0;
    if (cooldownSec > 0) {
      grindRailCooldown.current = cooldownSec;
    }
  }, []);
  const spawnPos = useMemo(() => {
    const team = gameStore.getState().localTeam;
    const teamPlayerCount =
      multiplayerEnabled && multiplayerRoomMode === '2v2'
        ? 2
        : 1;
    return getTeamSpawn(team, multiplayerTeamSlot, teamPlayerCount);
  }, [
    multiplayerEnabled,
    multiplayerRoomMode,
    multiplayerTeamSlot,
  ]);

  const applyTeamSpawn = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return false;
    body.setTranslation(
      { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
      true,
    );
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    stopGrindRailRide();
    grindRailSpeed.current = 0;
    grindRailCooldown.current = 0;
    inputManager.resetLookFromPosition(spawnPos.x, spawnPos.z);
    cameraSnapped.current = false;
    spawnApplied.current = true;
    return true;
  }, [spawnPos, stopGrindRailRide]);

  useEffect(() => {
    if (!onRocketBoostRef) return;
    onRocketBoostRef.current = () => {
      jumpsLeft.current = MOVEMENT.maxJumps;
    };
    return () => {
      onRocketBoostRef.current = null;
    };
  }, [onRocketBoostRef]);

  useEffect(() => () => setGrindRailActive(false), []);

  const interruptBeamOnHit = useCallback(() => {
    const now = performance.now() / 1000;
    const dur = ROCKET.beamDenyDurationSec;
    playerBeamDenyUntil.current = now + dur;
    ballReleaseLockUntil.current = Math.max(ballReleaseLockUntil.current, now + dur);
    beamNeedsRepress.current = true;
    setBeamAttractActive(false);
    gameStore.setIsBeaming(false);

    const body = bodyRef.current;
    const ball = ballBodyRef.current;
    let cx = chestPos.current.x;
    let cy = chestPos.current.y;
    let cz = chestPos.current.z;
    if (body) {
      const tr = body.translation();
      cx = tr.x;
      cy = tr.y + BEAM.chestHeight;
      cz = tr.z;
      chestPos.current.set(cx, cy, cz);
    }
    registerBeamDenyZone(cx, cy, cz, ROCKET.beamDenyRadius, dur);

    const wasHolding =
      holdingBall.current || gameStore.getState().ballHolderId === 'local';
    if (wasHolding) {
      holdingBall.current = false;
      if (gameStore.getState().ballHolderId === 'local') {
        gameStore.clearBallHolder(true);
      }
      gameStore.setBallState('loose');
      onBallHeldChange(false);
      onBeamBreak();
      if (ball && body) {
        beginLocalHeldBallRelease(heldBallVisualBridge.smoothPos);
        releaseBallPhysics(ball);
        const plv = body.linvel();
        ball.setLinvel(
          {
            x: plv.x * 0.35,
            y: Math.max(plv.y * 0.2, 1.5),
            z: plv.z * 0.35,
          },
          true,
        );
      }
      resetMomentumSamples(launchMomentumSamples.current, launchMomentumTimer);
      resetMomentumSamples(ballSwingSamples.current, ballSwingTimer);
      holdSocketReady.current = false;
      holdLatchT.current = 0;
      holdSocketSmoothReady.current = false;
    }
  }, [ballBodyRef, onBallHeldChange, onBeamBreak]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    onPlayerBodyReady(body);
    if (spawnInitialized.current) return;
    spawnInitialized.current = true;
    applyTeamSpawn();
  }, [onPlayerBodyReady, applyTeamSpawn]);

  const lastWishDir = useRef(new THREE.Vector3());

  useAfterPhysicsStep(() => {
    const body = bodyRef.current;
    const ball = ballBodyRef.current;
    if (!body) return;
    const gs = gameStore.getState();
    if (gs.debugFreelook) return;
    if (gs.phase !== 'playing' && gs.phase !== 'countdown') {
      return;
    }

    if (
      lastWishDir.current.lengthSq() > 0.01 &&
      !holdingBall.current &&
      gameStore.getState().ballHolderId !== 'local'
    ) {
      applyPlayerStepUp(
        world,
        body,
        lastWishDir.current.x,
        lastWishDir.current.z,
        body,
      );
    }

    const tr = body.translation();
    const padY = sampleTrampolineFloorY(tr.x, tr.z);
    if (padY !== null) {
      const feet = playerFeetY(tr.y);
      const gap = feet - padY;
      if (gap > 0.05 && gap < 1.2) {
        body.setTranslation(
          { x: tr.x, y: padY + (tr.y - feet), z: tr.z },
          true,
        );
        const lv = body.linvel();
        if (lv.y < 0) {
          body.setLinvel({ x: lv.x, y: 0, z: lv.z }, true);
        }
      }
    }

    if (
      !ball ||
      holdingBall.current ||
      gameStore.getState().ballHolderId === 'local'
    ) {
      return;
    }
    const now = performance.now() / 1000;
    if (now < ballSeparationGraceUntil.current) return;
    separateBallFromPlayer(body, ball, 0.35, true);

    const tune = tuningStore.getState();
    if (
      tickGoalEntryCharacterBounce(
        body,
        tr.x,
        tr.y + MOVEMENT.capsuleRadius,
        tr.z,
        PLAYER_RIM_PROBE_RADIUS,
        tune.gravity,
        goalNetCooldown,
        goalRimCooldown,
        1 / 60,
      )
    ) {
      velocity.current.set(body.linvel().x, body.linvel().y, body.linvel().z);
    }
  });

  const flyModeActive = useRef(false);

  useFrame((_, dt) => {
    const body = bodyRef.current;
    if (!body) return;

    if (debugFreelook) {
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      if (!flyModeActive.current) {
        flyModeActive.current = true;
        const col = body.collider(0);
        if (col) col.setCollisionGroups(PLAYER_DEBUG_NOCLIP);
      }
      return;
    }

    if (flyModeActive.current) {
      flyModeActive.current = false;
      const col = body.collider(0);
      if (col) {
        const carrying =
          holdingBall.current || gameStore.getState().ballHolderId === 'local';
        col.setCollisionGroups(
          carrying ? PLAYER_CARRY_COLLISION : PLAYER_LOOSE_COLLISION,
        );
      }
    }

    const carryingBall =
      holdingBall.current || gameStore.getState().ballHolderId === 'local';
    if (carryingBall !== playerCarryingBall.current) {
      playerCarryingBall.current = carryingBall;
      const playerCol = body.collider(0);
      if (playerCol) {
        playerCol.setCollisionGroups(
          carryingBall ? PLAYER_CARRY_COLLISION : PLAYER_LOOSE_COLLISION,
        );
      }
    }

    if (!spawnApplied.current && applyTeamSpawn()) {
      const t = body.translation();
      pivotRef.current.set(t.x, t.y + CAMERA.pivotHeight, t.z);
      const rot = inputManager.getRotation();
      updateThirdPersonCamera(
        camera,
        pivotRef.current,
        rot.yaw,
        inputManager.getAimPitch(),
        1,
        true,
      );
      cameraSnapped.current = true;
    }

    const phase = gameStore.getState().phase;
    if (phase === 'intro' && lastPhaseRef.current !== 'intro') {
      spawnApplied.current = false;
      cameraSnapped.current = false;
      camSpeedExtra.current = 0;
      thrusterThrottle.current = 0;
      thrusterJumpBoost.current = 0;
      clearKnockVisualTumble(knockTumble.current);
      pitchSmooth.current = 0;
    }
    lastPhaseRef.current = phase;

    const visualPresentation = {
      visual: visualRef.current,
      tilt: tiltRef.current,
      bob: bobRef.current,
      pitchSmooth,
      bobPhase,
    };

    const syncPreGamePresentation = (yaw: number) => {
      snapRigidBodyUpright(body);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      clearKnockVisualTumble(knockTumble.current);
      resetCharacterVisualGroups(visualPresentation);
      pitchSmooth.current = 0;
      alignCharacterVisualUpright(body, visualPresentation, yaw, null, 0);
    };

    if (phase === 'intro' || phase === 'loading') {
      if (spawnApplied.current) {
        const t = body.translation();
        pivotRef.current.set(t.x, t.y + CAMERA.pivotHeight, t.z);
        const rot = inputManager.getRotation();
        syncPreGamePresentation(rot.yaw);
        updateThirdPersonCamera(
          camera,
          pivotRef.current,
          rot.yaw,
          inputManager.getAimPitch(),
          dt,
          true,
        );
      }
      return;
    }

    if (phase !== 'playing' && phase !== 'countdown') return;
    if (tuningStore.getState().showMenu) return;

    const tune = tuningStore.getState();
    if (gameStore.getState().arenaSettleCountdown > 0) {
      const t = body.translation();
      const pos = _posScratch.current.set(t.x, t.y, t.z);
      const rot = inputManager.getRotation();
      syncPreGamePresentation(rot.yaw);
      chestPos.current.set(pos.x, pos.y + BEAM.chestHeight, pos.z);
      pivotRef.current.set(pos.x, pos.y + CAMERA.pivotHeight, pos.z);
      onPositionUpdate(pos, chestPos.current, {
        yaw: rot.yaw,
        pitch: inputManager.getAimPitch(),
        velocity: { x: 0, y: 0, z: 0 },
        isBeaming: false,
        isHoldingBall: false,
        holdPosition: null,
      });
      updateThirdPersonCamera(
        camera,
        pivotRef.current,
        rot.yaw,
        inputManager.getAimPitch(),
        dt,
        true,
      );
      return;
    }

    const knockTick = tickPlayerKnockStun(body);
    const rotEarly = inputManager.getRotation();
    if (knockTick === 'ended') {
      knockStunWasActive.current = false;
      forceCharacterUpright(
        body,
        visualPresentation,
        visualRecovery.current,
        knockTumble.current,
      );
    }

    if (knockTick === 'active') {
      stopGrindRailRide();
      if (!knockStunWasActive.current) {
        impulseKnockVisualTumble(knockTumble.current);
        interruptBeamOnHit();
      }
      knockStunWasActive.current = true;
      tickKnockVisualTumble(knockTumble.current, dt);
      setBeamAttractActive(false);

      const tr = body.translation();
      const pos = _posScratch.current.set(tr.x, tr.y, tr.z);
      const rot = rotEarly;
      const { forward, right } = getCameraBasis(rot.yaw);
      const moveLocked = isPlayerGoalEjectMoveLocked();
      const move = moveLocked
        ? { x: 0, y: 0 }
        : inputManager.getMoveVector();
      cameraMoveTargetXZ(
        _moveVelXZ,
        forward,
        right,
        move,
        tune.walkSpeed,
      );
      const wishDir = _wishDir.current.copy(_moveVelXZ);
      if (wishDir.lengthSq() > 0) {
        wishDir.normalize();
      }

      const linvel = body.linvel();
      const feetY = playerFeetY(pos.y);
      const groundedStun =
        feetY <= MOVEMENT.groundProbeDist + 0.35 && Math.abs(linvel.y) < 8;

      blendPlayerKnockStunMovement(body, velocity.current, {
        wishX: moveLocked ? 0 : _moveVelXZ.x,
        wishZ: moveLocked ? 0 : _moveVelXZ.z,
        walkSpeed: tune.walkSpeed,
        grounded: groundedStun,
        dt,
      });

      const lv = body.linvel();
      const stunMoveSpeed = Math.hypot(lv.x, lv.z);
      const stunFactor = speedCameraFactor(
        stunMoveSpeed,
        tune.walkSpeed,
        tune.sprintSpeed,
      );
      camSpeedExtra.current = smoothAsymmetric(
        camSpeedExtra.current,
        stunFactor * CAMERA.speedDistanceMax,
        dt,
        CAMERA.speedDistanceSmoothIn,
        CAMERA.speedDistanceSmoothOut,
      );
      thrusterThrottle.current = smoothAsymmetric(
        thrusterThrottle.current,
        0,
        dt,
        18,
        22,
      );
      chestPos.current.set(tr.x, tr.y + BEAM.chestHeight, tr.z);
      const knockNow = performance.now() / 1000;
      if (knockNow < playerBeamDenyUntil.current) {
        registerBeamDenyZone(
          chestPos.current.x,
          chestPos.current.y,
          chestPos.current.z,
          ROCKET.beamDenyRadius,
          playerBeamDenyUntil.current - knockNow,
        );
      }
      pivotRef.current.set(tr.x, tr.y + CAMERA.pivotHeight, tr.z);
      onPositionUpdate(pos, chestPos.current, {
        yaw: rot.yaw,
        pitch: inputManager.getAimPitch(),
        velocity: { x: lv.x, y: lv.y, z: lv.z },
        isBeaming: gameStore.getState().isBeaming,
        isHoldingBall: false,
        holdPosition: null,
      });
      updateThirdPersonCamera(
        camera,
        pivotRef.current,
        rot.yaw,
        inputManager.getAimPitch(),
        dt,
        false,
        camSpeedExtra.current,
      );
      gameStore.setSpeeds(
        Math.hypot(lv.x, lv.z),
        ballBodyRef.current
          ? Math.hypot(
              ballBodyRef.current.linvel().x,
              ballBodyRef.current.linvel().z,
            )
          : 0,
      );
      alignCharacterVisualUpright(
        body,
        visualPresentation,
        rot.yaw,
        knockTumble.current,
        inputManager.getAimPitch(),
      );
      return;
    }
    knockStunWasActive.current = false;
    const localTeam = gameStore.getState().localTeam;
    dashCooldown.current = Math.max(0, dashCooldown.current - dt);
    ePropelCooldown.current = Math.max(0, ePropelCooldown.current - dt);
    rocketFireCooldown.current = Math.max(0, rocketFireCooldown.current - dt);
    dashActiveTimer.current = Math.max(0, dashActiveTimer.current - dt);
    ePropelTimer.current = Math.max(0, ePropelTimer.current - dt);
    grindRailCooldown.current = Math.max(0, grindRailCooldown.current - dt);
    if (ePropelTimer.current > 0) {
      ePropelElapsed.current += dt;
    }
    goalNetCooldown.current = Math.max(0, goalNetCooldown.current - dt);
    goalRimCooldown.current = Math.max(0, goalRimCooldown.current - dt);
    const t = body.translation();
    const pos = _posScratch.current.set(t.x, t.y, t.z);
    const rot = inputManager.getRotation();
    const lookDir = inputManager.getLookDirection();
    const { forward, right } = getCameraBasis(rot.yaw);

    pivotRef.current.set(pos.x, pos.y + CAMERA.pivotHeight, pos.z);
    chestPos.current.set(pos.x, pos.y + BEAM.chestHeight, pos.z);
    const linvel = body.linvel();
    onPositionUpdate(pos, chestPos.current, {
      yaw: rot.yaw,
      pitch: inputManager.getAimPitch(),
      velocity: { x: linvel.x, y: linvel.y, z: linvel.z },
      isBeaming: gameStore.getState().isBeaming,
      isHoldingBall:
        holdingBall.current || gameStore.getState().ballHolderId === 'local',
      holdPosition:
        holdingBall.current || gameStore.getState().ballHolderId === 'local'
          ? {
              x: holdSocketSmoothed.current.x,
              y: holdSocketSmoothed.current.y,
              z: holdSocketSmoothed.current.z,
            }
          : null,
    });
    const moveSpeed = Math.hypot(linvel.x, linvel.z);
    const goalEjectMoveLocked = isPlayerGoalEjectMoveLocked();
    const moveEarly = goalEjectMoveLocked
      ? { x: 0, y: 0 }
      : inputManager.getMoveVector();
    const sprintGlowTarget =
      !goalEjectMoveLocked &&
      inputManager.isSprint() &&
      energy.current > 0 &&
      (moveEarly.x !== 0 || moveEarly.y !== 0)
        ? 1
        : 0;
    const speedFactor = speedCameraFactor(
      moveSpeed,
      tune.walkSpeed,
      tune.sprintSpeed,
    );
    camSpeedExtra.current = smoothAsymmetric(
      camSpeedExtra.current,
      speedFactor * CAMERA.speedDistanceMax,
      dt,
      CAMERA.speedDistanceSmoothIn,
      CAMERA.speedDistanceSmoothOut,
    );
    thrusterThrottle.current = smoothAsymmetric(
      thrusterThrottle.current,
      sprintGlowTarget,
      dt,
      16,
      24,
    );
    if (thrusterJumpBoost.current > 0) {
      thrusterJumpBoost.current = Math.max(0, thrusterJumpBoost.current - dt / 0.38);
    }

    const locked = inputManager.isPointerLocked();
    if (!locked) cameraSnapped.current = false;
    const snapCam = locked && !cameraSnapped.current;
    if (snapCam) cameraSnapped.current = true;

    updateThirdPersonCamera(
      camera,
      pivotRef.current,
      rot.yaw,
      inputManager.getAimPitch(),
      dt,
      snapCam,
      camSpeedExtra.current,
    );

    const aimPitch = inputManager.getAimPitch();

    if (
      !tickCharacterVisualRecovery(
        body,
        visualRecovery.current,
        visualPresentation,
        rot.yaw,
        aimPitch,
        moveSpeed,
        dt,
        'local',
      )
    ) {
      syncCharacterVisualPresentation(
        body,
        visualPresentation,
        rot.yaw,
        aimPitch,
        moveSpeed,
        dt,
        'local',
      );
    }
    const holdingNow =
      holdingBall.current || gameStore.getState().ballHolderId === 'local';

    jumpAirGrace.current = Math.max(0, jumpAirGrace.current - dt);

    const maxVy = holdingNow
      ? MOVEMENT.groundMaxVerticalSpeedWithBall
      : MOVEMENT.groundMaxVerticalSpeed;
    const probe = probePlayerGround(
      world,
      pos.x,
      pos.y,
      pos.z,
      linvel.y,
      body,
      MOVEMENT.groundProbeDist,
      maxVy,
    );

    const padFloorY = sampleTrampolineFloorY(pos.x, pos.z);
    const feetY = playerFeetY(pos.y);
    const inTrampZone = isPlayerInTrampolineZone(pos.x, pos.z, feetY);
    const overTrampDeck = inTrampZone || isPlayerOverTrampolineDeck(pos.x, pos.z, feetY);
    let padGap = MOVEMENT.groundProbeDist + 1;
    if (padFloorY !== null) {
      padGap = feetY - padFloorY;
    }

    if (jumpAirGrace.current > 0) {
      grounded.current = false;
    } else {
      grounded.current =
        !overTrampDeck &&
        (probe.grounded ||
          (padFloorY !== null &&
            padGap <= MOVEMENT.groundProbeDist &&
            Math.abs(linvel.y) <= maxVy));
    }

    if (grounded.current && jumpAirGrace.current <= 0) {
      jumpsLeft.current = MOVEMENT.maxJumps;
      coyoteTime.current = MOVEMENT.coyoteTimeSec;
    } else if (!grounded.current) {
      coyoteTime.current = Math.max(0, coyoteTime.current - dt);
    }

    const move = goalEjectMoveLocked
      ? { x: 0, y: 0 }
      : inputManager.getMoveVector();
    const sprintInput = !goalEjectMoveLocked && inputManager.isSprint();
    const canSprint = energy.current > 0;
    const sprinting =
      sprintInput && canSprint && (move.x !== 0 || move.y !== 0);
    const speed = sprinting ? tune.sprintSpeed : tune.walkSpeed;
    const accel = grounded.current ? MOVEMENT.groundAccel : MOVEMENT.groundAccel * 0.65;

    cameraMoveTargetXZ(_moveVelXZ, forward, right, move, speed);
    const wishDir = _wishDir.current.copy(_moveVelXZ);
    if (wishDir.lengthSq() > 0) {
      wishDir.normalize();
      lastWishDir.current.copy(wishDir);
    }
    const jumpPressed =
      !goalEjectMoveLocked &&
      jumpsLeft.current > 0 &&
      inputManager.consumeJump();
    let railConsumedJump = false;

    if (
      !goalEjectMoveLocked &&
      !grindRailActive.current &&
      !isPlayerKnockStunActive() &&
      !holdingBall.current &&
      ePropelCooldown.current <= 0 &&
      inputManager.consumeEPropel()
    ) {
      energy.current = Math.max(
        0,
        energy.current * (1 - MOVEMENT.ePropelEnergyCostFrac),
      );
      regenTimer.current = ENERGY.regenDelay;
      draining.current = true;
      ePropelTimer.current = MOVEMENT.ePropelDurationSec;
      ePropelElapsed.current = 0;
      ePropelImpulsesApplied.current = 0;
      ePropelCooldown.current = MOVEMENT.ePropelCooldownSec;
      resolveEPropelDirection(_ePropelDir, lookDir);
      const horizLook = Math.hypot(_ePropelDir.x, _ePropelDir.z);
      const launchVy =
        _ePropelDir.y * MOVEMENT.ePropelUpSpeed +
        (horizLook > 0.65 ? MOVEMENT.dashUpSpeed : 0);
      ePropelVyBoost.current = launchVy;
      playDash();
      grounded.current = false;
      jumpAirGrace.current = MOVEMENT.jumpAirGraceSec;
      coyoteTime.current = 0;
      const tr = body.translation();
      body.setTranslation(
        { x: tr.x, y: tr.y + MOVEMENT.jumpLiftY, z: tr.z },
        true,
      );
    }

    const ePropelling = ePropelTimer.current > 0;
    const dashing = dashActiveTimer.current > 0 && !ePropelling;
    if (ePropelling) {
      while (
        ePropelImpulsesApplied.current < MOVEMENT.ePropelImpulseCount &&
        ePropelElapsed.current >=
          ePropelImpulseThreshold(ePropelImpulsesApplied.current)
      ) {
        velocity.current.x += _ePropelDir.x * MOVEMENT.ePropelImpulseHSpeed;
        velocity.current.z += _ePropelDir.z * MOVEMENT.ePropelImpulseHSpeed;
        velocity.current.y += _ePropelDir.y * MOVEMENT.ePropelImpulseHSpeed * 0.45;
        ePropelImpulsesApplied.current += 1;
      }
      velocity.current.x = _ePropelDir.x * MOVEMENT.ePropelSustainSpeed;
      velocity.current.z = _ePropelDir.z * MOVEMENT.ePropelSustainSpeed;
    } else if (dashing) {
      const dashSpd = MOVEMENT.dashForwardSpeed;
      velocity.current.x = _dashDir.current.x * dashSpd;
      velocity.current.z = _dashDir.current.z * dashSpd;
    } else {
      const control = grounded.current ? 1 : MOVEMENT.airControl;
      const targetVelX = _moveVelXZ.x * control;
      const targetVelZ = _moveVelXZ.z * control;
      velocity.current.x = THREE.MathUtils.lerp(
        velocity.current.x,
        targetVelX,
        accel * dt,
      );
      velocity.current.z = THREE.MathUtils.lerp(
        velocity.current.z,
        targetVelZ,
        accel * dt,
      );

      if (!grounded.current && wishDir.lengthSq() > 0) {
        const curH = Math.hypot(velocity.current.x, velocity.current.z);
        const tgtH = Math.hypot(targetVelX, targetVelZ);
        if (tgtH > 0.01 && curH > tgtH) {
          const keep = curH / tgtH;
          velocity.current.x = targetVelX * keep;
          velocity.current.z = targetVelZ * keep;
        }
      }
    }

    let railJumpVy: number | null = null;
    const railCenterY = pos.y + capCenterY;
    const railContactRange = grindRailActive.current
      ? GRIND_RAIL.activeHorizontalM
      : GRIND_RAIL.contactHorizontalM;
    const railContact = sampleGrindRailContact(
      pos.x,
      railCenterY,
      pos.z,
      railContactRange,
      GRIND_RAIL.contactVerticalM,
    );
    const horizontalSpeed = Math.hypot(linvel.x, linvel.z);

    if (grindRailActive.current) {
      if (jumpPressed) {
        railConsumedJump = true;
        const jumpIndex = MOVEMENT.maxJumps - jumpsLeft.current;
        playJump(Math.max(0, jumpIndex));
        railJumpVy = tuningStore.getJumpImpulse(0);
        jumpsLeft.current = Math.max(0, MOVEMENT.maxJumps - 1);
        grounded.current = false;
        jumpAirGrace.current = MOVEMENT.jumpAirGraceSec;
        coyoteTime.current = 0;
        const inwardX = railContact?.inwardX ?? -grindRailDir.current.y;
        const inwardZ = railContact?.inwardZ ?? grindRailDir.current.x;
        const exitSpeed = Math.max(grindRailSpeed.current, horizontalSpeed);
        stopGrindRailRide(GRIND_RAIL.jumpCooldownSec);
        velocity.current.x =
          grindRailDir.current.x * exitSpeed +
          inwardX * GRIND_RAIL.jumpOutwardSpeed;
        velocity.current.z =
          grindRailDir.current.y * exitSpeed +
          inwardZ * GRIND_RAIL.jumpOutwardSpeed;
        const tr = body.translation();
        const nextX = tr.x + inwardX * 0.35;
        const nextY = tr.y + MOVEMENT.jumpLiftY;
        const nextZ = tr.z + inwardZ * 0.35;
        body.setTranslation(
          { x: nextX, y: nextY, z: nextZ },
          true,
        );
        pos.set(nextX, nextY, nextZ);
      } else if (!railContact || grindRailSpeed.current <= GRIND_RAIL.minRideSpeed) {
        stopGrindRailRide(GRIND_RAIL.jumpCooldownSec * 0.5);
      } else {
        let tangentX = railContact.tangentX;
        let tangentZ = railContact.tangentZ;
        if (
          tangentX * grindRailDir.current.x +
            tangentZ * grindRailDir.current.y <
          0
        ) {
          tangentX = -tangentX;
          tangentZ = -tangentZ;
        }
        grindRailDir.current.set(tangentX, tangentZ);
        const edgeThreshold = 0.12;
        const movingTowardStart =
          railContact.openStart &&
          railContact.segmentT <= edgeThreshold &&
          tangentX * railContact.tangentX + tangentZ * railContact.tangentZ < 0;
        const movingTowardEnd =
          railContact.openEnd &&
          railContact.segmentT >= 1 - edgeThreshold &&
          tangentX * railContact.tangentX + tangentZ * railContact.tangentZ > 0;
        if (movingTowardStart || movingTowardEnd) {
          const exitSpeed = Math.max(grindRailSpeed.current, horizontalSpeed);
          stopGrindRailRide(GRIND_RAIL.jumpCooldownSec * 0.35);
          velocity.current.x = tangentX * exitSpeed;
          velocity.current.z = tangentZ * exitSpeed;
          velocity.current.y = linvel.y;
        } else {
          grindRailWobble.current += dt * THREE.MathUtils.lerp(8, 15, Math.min(1, grindRailSpeed.current / Math.max(1, tune.sprintSpeed * 2)));
          grindRailSpeed.current = Math.max(
            0,
            grindRailSpeed.current - GRIND_RAIL.decelMps2 * dt,
          );
          const wobbleSide = Math.sin(grindRailWobble.current) * 0.1;
          const wobbleLift = Math.abs(Math.cos(grindRailWobble.current * 1.6)) * 0.05;
          const rideY = GRIND_RAIL.y + GRIND_RAIL.radius - capCenterY + 0.04 + wobbleLift;
          const rideX = railContact.rideX + railContact.inwardX * wobbleSide;
          const rideZ = railContact.rideZ + railContact.inwardZ * wobbleSide;
          body.setTranslation(
            { x: rideX, y: rideY, z: rideZ },
            true,
          );
          pos.set(rideX, rideY, rideZ);
          velocity.current.x = tangentX * grindRailSpeed.current;
          velocity.current.z = tangentZ * grindRailSpeed.current;
          velocity.current.y = 0;
          setGrindRailGlow({
            active: true,
            x: railContact.x,
            y: GRIND_RAIL.y,
            z: railContact.z,
            yaw: Math.atan2(-tangentZ, tangentX),
          });
          grindRailSparkTimer.current -= dt;
          if (grindRailSparkTimer.current <= 0) {
            grindRailSparkTimer.current = 0.028;
            burstGrindRailSparks(
              rideX,
              rideY + capCenterY - GRIND_RAIL.radius * 0.2,
              rideZ,
              tangentX,
              tangentZ,
            );
          }
          grounded.current = false;
          jumpAirGrace.current = Math.max(jumpAirGrace.current, 0.08);
          coyoteTime.current = 0;
        }
      }
    } else if (
      !jumpPressed &&
      !goalEjectMoveLocked &&
      grindRailCooldown.current <= 0 &&
      railContact &&
      horizontalSpeed >= GRIND_RAIL.entryMinSpeed
    ) {
      let tangentX = railContact.tangentX;
      let tangentZ = railContact.tangentZ;
      if (tangentX * linvel.x + tangentZ * linvel.z < 0) {
        tangentX = -tangentX;
        tangentZ = -tangentZ;
      }
      grindRailActive.current = true;
      setGrindRailActive(true);
      grindRailDir.current.set(tangentX, tangentZ);
      grindRailWobble.current = 0;
      grindRailSparkTimer.current = 0;
      grindRailSpeed.current = THREE.MathUtils.clamp(
        Math.max(horizontalSpeed * 3, tune.walkSpeed * 3),
        tune.walkSpeed * 3,
        tune.sprintSpeed * GRIND_RAIL.maxSpeedSprintMul,
      );
      const rideY = GRIND_RAIL.y + GRIND_RAIL.radius - capCenterY + 0.04;
      body.setTranslation(
        { x: railContact.rideX, y: rideY, z: railContact.rideZ },
        true,
      );
      pos.set(railContact.rideX, rideY, railContact.rideZ);
      velocity.current.x = tangentX * grindRailSpeed.current;
      velocity.current.z = tangentZ * grindRailSpeed.current;
      velocity.current.y = 0;
      grounded.current = false;
      jumpAirGrace.current = Math.max(jumpAirGrace.current, 0.08);
      coyoteTime.current = 0;
    } else {
      setGrindRailActive(false);
    }

    let vy = linvel.y;
    if (railJumpVy !== null) {
      vy = railJumpVy;
    } else if (grindRailActive.current) {
      vy = 0;
    }
    if (ePropelVyBoost.current !== null) {
      vy = ePropelVyBoost.current;
      ePropelVyBoost.current = null;
    }

    if (
      !goalEjectMoveLocked &&
      !grindRailActive.current &&
      dashCooldown.current <= 0 &&
      inputManager.consumeDashBoost()
    ) {
      _dashDir.current.copy(forward).setY(0);
      if (_dashDir.current.lengthSq() < 1e-6) {
        _dashDir.current.set(
          -Math.sin(rot.yaw),
          0,
          -Math.cos(rot.yaw),
        );
      } else {
        _dashDir.current.normalize();
      }
      playDash();
      velocity.current.x =
        _dashDir.current.x * MOVEMENT.dashForwardSpeed;
      velocity.current.z =
        _dashDir.current.z * MOVEMENT.dashForwardSpeed;
      vy = MOVEMENT.dashUpSpeed;
      grounded.current = false;
      dashActiveTimer.current = MOVEMENT.dashDurationSec;
      dashCooldown.current = MOVEMENT.dashCooldownSec;
      const tr = body.translation();
      body.setTranslation(
        { x: tr.x, y: tr.y + MOVEMENT.jumpLiftY, z: tr.z },
        true,
      );
    }

    if (jumpPressed && !railConsumedJump && !grindRailActive.current) {
      const jumpIndex = MOVEMENT.maxJumps - jumpsLeft.current;
      if (jumpIndex >= 2) {
        triggerForwardFlip('local');
        gameStore.bumpPlayerHatPop(true);
      } else {
        gameStore.bumpPlayerHatPop(false);
      }
      thrusterJumpBoost.current = 1;
      playJump(jumpIndex);
      vy = tuningStore.getJumpImpulse(jumpIndex);
      jumpsLeft.current -= 1;
      grounded.current = false;
      jumpAirGrace.current = MOVEMENT.jumpAirGraceSec;
      coyoteTime.current = 0;
      const boost = MOVEMENT.jumpMomentumBoost;
      velocity.current.x = linvel.x * boost;
      velocity.current.z = linvel.z * boost;
      if (wishDir.lengthSq() > 0) {
        velocity.current.x += wishDir.x * speed * 0.15;
        velocity.current.z += wishDir.z * speed * 0.15;
      }
      const tr = body.translation();
      body.setTranslation(
        { x: tr.x, y: tr.y + MOVEMENT.jumpLiftY, z: tr.z },
        true,
      );
    }
    if (!grindRailActive.current) {
      vy = tuningStore.integrateGravity(vy, dt);
    }

    velocity.current.y = vy;
    const feetNow = playerFeetY(pos.y);
    const padLaunched = tryPlayerPads(
      body,
      velocity.current,
      tune.gravity,
      tune.trampolineStrength,
      { feetY: feetNow, vy },
    );
    if (padLaunched) {
      vy = velocity.current.y;
      grounded.current = false;
      jumpsLeft.current = MOVEMENT.maxJumps;
      coyoteTime.current = 0;
      jumpAirGrace.current = 0;
    } else if (padFloorY !== null && !inTrampZone) {
      const currentFeet = playerFeetY(pos.y);
      const gap = currentFeet - padFloorY;
      if (gap > 0.04 && gap <= MOVEMENT.groundProbeDist + 0.35 && vy <= 0.6) {
        const snapY = padFloorY + (pos.y - currentFeet);
        body.setTranslation({ x: pos.x, y: snapY, z: pos.z }, true);
        pos.y = snapY;
        vy = 0;
        grounded.current = true;
      }
    }

    velocity.current.y = vy;

    if (
      tickGoalEntryCharacterBounce(
        body,
        pos.x,
        pos.y + MOVEMENT.capsuleRadius,
        pos.z,
        PLAYER_RIM_PROBE_RADIUS,
        tune.gravity,
        goalNetCooldown,
        goalRimCooldown,
        dt,
      )
    ) {
      velocity.current.set(body.linvel().x, body.linvel().y, body.linvel().z);
      grounded.current = false;
      jumpAirGrace.current = Math.max(jumpAirGrace.current, 0.2);
    }

    body.setLinvel(
      { x: velocity.current.x, y: velocity.current.y, z: velocity.current.z },
      true,
    );

    draining.current = false;
    if (sprinting && wishDir.lengthSq() > 0) {
      energy.current -= ENERGY.sprintDrain * dt;
      draining.current = true;
    }

    const now = performance.now() / 1000;
    if (
      holdingBall.current &&
      gameStore.getState().ballHolderId !== 'local'
    ) {
      holdingBall.current = false;
      holdSocketReady.current = false;
      holdLatchT.current = 0;
    }
    if (now < playerBeamDenyUntil.current) {
      registerBeamDenyZone(
        chestPos.current.x,
        chestPos.current.y,
        chestPos.current.z,
        ROCKET.beamDenyRadius,
        playerBeamDenyUntil.current - now,
      );
    }

    const beamDenied =
      now < playerBeamDenyUntil.current ||
      isBeamDenied(chestPos.current.x, chestPos.current.y, chestPos.current.z) ||
      (ballBodyRef.current &&
        isBeamDenied(
          ballBodyRef.current.translation().x,
          ballBodyRef.current.translation().y,
          ballBodyRef.current.translation().z,
        ));

    if (!inputManager.isBeam()) {
      beamNeedsRepress.current = false;
    }

    const knockStunned = isPlayerKnockStunActive();
    const frozen = gameStore.getState().ballFrozen;
    const ballLooseCooldown = now >= ballReleaseLockUntil.current;
    const ball = ballBodyRef.current;
    const ballHolder = gameStore.getState().ballHolderId;
    const multiplayerNow = multiplayerStore.getState();
    const remoteBallHeld =
      multiplayerNow.enabled &&
      multiplayerNow.remotePlayers.some((player) => player.isHoldingBall);
    const canBeamBall = ballHolder === null && !remoteBallHeld;
    const beamAttempt =
      inputManager.isBeam() &&
      !beamNeedsRepress.current &&
      !knockStunned &&
      energy.current >= ENERGY.minBeam &&
      !frozen;
    const beamRequested = beamAttempt && !beamDenied;
    let canLockBeamTarget = false;

    if (
      beamRequested &&
      !holdingBall.current &&
      ball &&
      ballLooseCooldown &&
      canBeamBall
    ) {
      const bt = ball.translation();
      const ballPos = _beamBallPos.current.set(bt.x, bt.y, bt.z);
      const { grabDist } = beamGrabDistance(ballPos, chestPos.current, pos);
      canLockBeamTarget = grabDist < BEAM.range;
    }

    const beamInput =
      beamRequested && (holdingBall.current || canLockBeamTarget);

    if (beamAttempt && !beamInput && now - beamNoLockSoundAt.current > 0.45) {
      beamNoLockSoundAt.current = now;
      playBeamNoLock();
    }

    if (beamInput && holdingBall.current) {
      energy.current -= ENERGY.carryBeamDrain * dt;
      draining.current = true;
    } else if (beamInput && !holdingBall.current) {
      energy.current -= ENERGY.beamDrain * dt;
      draining.current = true;
    }

    const clearHoldState = () => {
      holdingBall.current = false;
      if (gameStore.getState().ballHolderId === 'local') {
        gameStore.clearBallHolder(true);
      }
      requestAnimationFrame(() => onBallHeldChange(false));
    };

    if (energy.current <= 0) {
      energy.current = 0;
      if (holdingBall.current) {
        clearHoldState();
        onBeamBreak();
        gameStore.setEnergyFlash(true);
        if (ballBodyRef.current) {
          beginLocalHeldBallRelease(heldBallVisualBridge.smoothPos);
          releaseBallPhysics(ballBodyRef.current);
        }
      }
    }

    if (!draining.current) {
      regenTimer.current += dt;
      if (regenTimer.current >= ENERGY.regenDelay) {
        energy.current = Math.min(ENERGY.max, energy.current + ENERGY.regen * dt);
      }
    } else {
      regenTimer.current = 0;
    }

    gameStore.setEnergy(energy.current);
    gameStore.setIsSprinting(sprinting);
    gameStore.setIsBeaming(beamInput);

    const armPostShotRocketBlock = () => {
      if (inputManager.isFireDown()) {
        blockRocketsUntilFireUp.current = true;
      } else {
        blockRocketsUntil.current = now + BALL.postShotRocketGraceSec;
      }
    };

    const rocketsBlockedByShot = () =>
      blockRocketsUntilFireUp.current || now < blockRocketsUntil.current;

    const resetHoldMomentum = () => {
      resetMomentumSamples(launchMomentumSamples.current, launchMomentumTimer);
      resetMomentumSamples(ballSwingSamples.current, ballSwingTimer);
      holdSocketReady.current = false;
      holdLatchT.current = 0;
    };

    const releaseBallWithVelocity = (
      velocity: THREE.Vector3,
      ballState: 'loose' | 'launched' = 'launched',
      swingVel = averageMomentum(ballSwingSamples.current),
    ) => {
      if (!ball) return;
      beginLocalHeldBallRelease(heldBallVisualBridge.smoothPos);
      releaseBallPhysics(ball);
      if (tune.releaseSystem === 'superrelease') {
        computeSuperReleaseSpawn(
          pos,
          forward,
          lookDir,
          tune,
          _holdSocket.current,
        );
        if (ballState === 'launched') {
          ballSeparationGraceUntil.current =
            now + tune.superReleaseThrowerGraceSec;
        }
      } else {
        computeBallLaunchSpawn(
          chestPos.current,
          lookDir,
          velocity,
          _holdSocket.current,
        );
        if (ballState === 'launched') {
          ballSeparationGraceUntil.current =
            now + BALL.postLaunchSeparationGraceSec;
        }
      }
      ball.setTranslation(
        {
          x: _holdSocket.current.x,
          y: _holdSocket.current.y,
          z: _holdSocket.current.z,
        },
        true,
      );
      applyBallLaunchImpulse(ball, velocity, swingVel);
      onBallReleased?.({
        position: {
          x: _holdSocket.current.x,
          y: _holdSocket.current.y,
          z: _holdSocket.current.z,
        },
        velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
        ballState,
      });
      gameStore.setBallState(ballState);
    };

    const dropHeldBall = () => {
      if (!holdingBall.current) return;
      clearHoldState();
      ballReleaseLockUntil.current = now + BALL.beamRegrabLockSec;

      if (ball) {
        const plv = body.linvel();
        const playerVel = _swingVelScratch.current.set(plv.x, plv.y, plv.z);
        if (tune.releaseSystem === 'superrelease') {
          const release = computeSuperReleaseDropVelocity(
            {
              lookDir,
              playerVel,
              ballSwing: averageMomentum(ballSwingSamples.current),
              tune,
            },
            _launchVel.current,
          );
          releaseBallWithVelocity(
            release.velocity,
            release.active ? 'launched' : 'loose',
          );
          if (release.active) playBallLaunch();
          if (release.active) armPostShotRocketBlock();
        } else {
          const release = computeBeamReleaseVelocity(
            {
              lookDir,
              playerCarry: averageMomentum(launchMomentumSamples.current),
              ballSwing: averageMomentum(ballSwingSamples.current),
              playerVel,
              tune,
            },
            _launchVel.current,
          );
          releaseBallWithVelocity(
            release.velocity,
            release.active ? 'launched' : 'loose',
          );
          if (release.active) playBallLaunch();
          if (release.active) armPostShotRocketBlock();
        }
      }

      resetHoldMomentum();
    };

    const launchHeldBall = () => {
      const held =
        holdingBall.current || gameStore.getState().isHoldingBall;
      if (!held) return false;
      beamNeedsRepress.current = true;
      clearHoldState();
      ballReleaseLockUntil.current = now + BALL.beamRegrabLockSec;

      if (ball) {
        const plv = body.linvel();
        if (tune.releaseSystem === 'superrelease') {
          computeSuperReleaseShotVelocity(
            {
              lookDir,
              playerVel: _swingVelScratch.current.set(plv.x, plv.y, plv.z),
              tune,
            },
            _launchVel.current,
          );
        } else {
          computeDirectedShotVelocity(
            {
              lookDir,
              playerCarry: averageMomentum(launchMomentumSamples.current),
              ballSwing: averageMomentum(ballSwingSamples.current),
              playerVel: new THREE.Vector3(plv.x, plv.y, plv.z),
              tune,
            },
            _launchVel.current,
          );
          if (tune.shortArc !== 0) {
            _launchVel.current.y += tune.shortArc;
          }
        }
        releaseBallWithVelocity(_launchVel.current);
        playBallLaunch();
        registerBeamDenyZone(
          _holdSocket.current.x,
          _holdSocket.current.y,
          _holdSocket.current.z,
          9,
          0.4,
        );
      }

      energy.current = 0;
      draining.current = true;
      regenTimer.current = 0;
      resetHoldMomentum();
      armPostShotRocketBlock();
      return true;
    };

    const beamingLoose =
      beamInput &&
      !holdingBall.current &&
      canLockBeamTarget &&
      canBeamBall &&
      !!ball &&
      !frozen;
    setBeamAttractActive(beamingLoose);

    if (
      ball &&
      beamInput &&
      ballLooseCooldown &&
      canBeamBall &&
      !holdingBall.current &&
      !frozen
    ) {
      const bt = ball.translation();
      const ballPos = _beamBallPos.current.set(bt.x, bt.y, bt.z);
      const { chestDist, grabDist } = beamGrabDistance(
        ballPos,
        chestPos.current,
        pos,
      );

      if (grabDist < BEAM.range) {
        const pull = applyBeamAttraction(
          ball,
          ballPos,
          chestPos.current,
          dt,
          tune.pullStrength,
        );
        if (pull.pullWeight > 0) {
          recordBeamPull(localTeam, pull.pullWeight);
        }

        const contactLatch = canPlayerContactCapture(
          grabDist,
          chestDist,
          pull.analysis,
        );
        if (
          contactLatch ||
          canCaptureWithContest(
            localTeam,
            pull.analysis,
            grabDist,
            false,
            chestDist,
          )
        ) {
          const lv0 = body.linvel();
          lastHoldSocketPos.current.copy(ballPos);
          holdSocketReady.current = false;
          holdLatchT.current = 0;
          holdSocketSmoothed.current.copy(ballPos);
          holdSocketSmoothReady.current = true;
          captureBallSocket(ball, holdSocketSmoothed.current, ballPos);
          markLocalHeldBallCarry(ballPos, ball.rotation());
          resolveHeldBallPosition(
            world,
            ball,
            holdSocketSmoothed.current,
            holdSocketSmoothed.current,
            BALL.radius,
            body,
            holdSocketSmoothed.current,
            chestPos.current,
          );
          ball.setTranslation(
            {
              x: holdSocketSmoothed.current.x,
              y: holdSocketSmoothed.current.y,
              z: holdSocketSmoothed.current.z,
            },
            true,
          );
          holdingBall.current = true;
          gameStore.setBallHolder('local');
          gameStore.setBallState('held');
          requestAnimationFrame(() => onBallHeldChange(true));
          resetMomentumSamples(
            launchMomentumSamples.current,
            launchMomentumTimer,
            new THREE.Vector3(lv0.x, lv0.y, lv0.z),
          );
          resetMomentumSamples(ballSwingSamples.current, ballSwingTimer);
        } else if (pull.applied || chestDist <= BEAM.contactCaptureDistance) {
          gameStore.setBallState('pulled');
        }
      }
    }

    const holdingFire = inputManager.isFireDown();
    const ballHeld = gameStore.getState().ballHolderId === 'local';
    const canShootRockets = !ballHeld;
    let launchedBallThisFrame = false;

    const tryFireRocket = (explosive: boolean): boolean => {
      if (!canShootRockets || !body) return false;
      if (rocketsBlockedByShot()) return false;
      if (rocketFireCooldown.current > 0) {
        if (!firePressHandled.current) {
          playRocketEmpty();
          firePressHandled.current = true;
        }
        return false;
      }
      if (canFireRocket && !canFireRocket()) {
        if (!firePressHandled.current) {
          playRocketEmpty();
          firePressHandled.current = true;
        }
        return false;
      }
      if (lookDir.lengthSq() < 1e-6) return false;

      pointOnCrosshairAimRay(
        camera.position,
        lookDir,
        chestPos.current,
        ROCKET.rocketSpawnAhead,
        _rocketOrigin.current,
      );
      const lv = body.linvel();
      const rocket = createRocket(
        {
          x: _rocketOrigin.current.x,
          y: _rocketOrigin.current.y,
          z: _rocketOrigin.current.z,
        },
        { x: lookDir.x, y: lookDir.y, z: lookDir.z },
        'local',
        { x: lv.x, y: lv.y, z: lv.z },
        explosive,
      );
      if (!firePressHandled.current) {
        playRocketFire(explosive);
        firePressHandled.current = true;
      }
      triggerRocketRecoil('local', lookDir, pos, explosive);
      onRocketFired(rocket);
      rocketFireCooldown.current = ROCKET.fireCooldownSec;
      return true;
    };

    if (inputManager.consumeFireEdge()) {
      firePressHandled.current = false;
      chargedRocketFired.current = false;
      if (ballHeld) {
        launchedBallThisFrame = launchHeldBall();
        fireLaunchedBall.current = launchedBallThisFrame;
        fireHoldStart.current = null;
        if (launchedBallThisFrame) firePressHandled.current = true;
      } else {
        fireLaunchedBall.current = false;
        fireHoldStart.current = now;
        if (canShootRockets) {
          tryFireRocket(true);
          firePressHandled.current = true;
        }
      }
    }

    if (
      holdingFire &&
      canShootRockets &&
      fireHoldStart.current !== null &&
      !chargedRocketFired.current
    ) {
      const holdDur = now - fireHoldStart.current;
      if (holdDur >= ROCKET.chargedHoldSec) {
        if (tune.bouncyRocketsEnabled) {
          if (tryFireRocket(false)) {
            chargedRocketFired.current = true;
          }
        }
      }
    }

    if (inputManager.consumeFireRelease()) {
      if (blockRocketsUntilFireUp.current) {
        blockRocketsUntilFireUp.current = false;
        blockRocketsUntil.current = now + BALL.postShotRocketGraceSec;
      }
      const holdDur =
        fireHoldStart.current !== null ? now - fireHoldStart.current : 0;
      fireHoldStart.current = null;
      if (
        canShootRockets &&
        !firePressHandled.current &&
        !fireLaunchedBall.current &&
        !chargedRocketFired.current &&
        holdDur < ROCKET.chargedHoldSec
      ) {
        tryFireRocket(true);
      }
      fireLaunchedBall.current = false;
      chargedRocketFired.current = false;
    }

    if (inputManager.consumeThrow() && !launchedBallThisFrame) {
      if (launchHeldBall()) armPostShotRocketBlock();
    }

    if (holdingBall.current && !beamInput && !launchedBallThisFrame) {
      dropHeldBall();
      if (inputManager.isFireDown()) {
        fireHoldStart.current = now;
        fireLaunchedBall.current = false;
        chargedRocketFired.current = false;
      }
    } else if (holdingBall.current && ball && !knockStunned) {
      const plv = body.linvel();
      tickMomentumSamples(
        launchMomentumSamples.current,
        launchMomentumTimer,
        dt,
        new THREE.Vector3(plv.x, plv.y, plv.z),
      );

      holdSocketSmoothReady.current =
        tune.releaseSystem === 'superrelease'
          ? smoothSuperReleaseHoldSocket(
              holdSocketSmoothed.current,
              pos,
              forward,
              dt,
              BALL.holdSocketTargetSmooth,
              holdSocketSmoothReady.current,
              body,
              tune,
              chestPos.current,
            )
          : smoothHoldSocketTarget(
              holdSocketSmoothed.current,
              chestPos.current,
              lookDir,
              BEAM.holdDistance,
              BALL.radius,
              dt,
              BALL.holdSocketTargetSmooth,
              holdSocketSmoothReady.current,
              body,
            );

      holdLatchT.current = Math.min(
        1,
        holdLatchT.current + dt / BALL.holdLatchDurationSec,
      );

      if (!holdSocketReady.current) {
        lastHoldSocketPos.current.copy(holdSocketSmoothed.current);
        holdSocketReady.current = true;
      } else if (dt > 1e-5) {
        const swingVel = _swingVelScratch.current.set(
          (holdSocketSmoothed.current.x - lastHoldSocketPos.current.x) / dt,
          (holdSocketSmoothed.current.y - lastHoldSocketPos.current.y) / dt,
          (holdSocketSmoothed.current.z - lastHoldSocketPos.current.z) / dt,
        );
        tickMomentumSamples(
          ballSwingSamples.current,
          ballSwingTimer,
          dt,
          swingVel,
        );
        lastHoldSocketPos.current.copy(holdSocketSmoothed.current);
      }

      updateBallSocketSmooth(
        ball,
        holdSocketSmoothed.current,
        dt,
        holdLatchT.current,
        BALL.holdFollowSmooth,
        world,
        body,
        chestPos.current,
      );

      const bt = ball.translation();
      if (
        tryBallGoalScoreAtPoint({ x: bt.x, y: bt.y, z: bt.z }, ball)
      ) {
        clearHoldState();
        resetHoldMomentum();
      }
    } else {
      holdSocketSmoothReady.current = false;
    }

    const clamped = clampToHex(pos.x, pos.z, ARENA.hexRadius, 2.5);
    if (clamped.x !== pos.x || clamped.z !== pos.z) {
      body.setTranslation({ x: clamped.x, y: pos.y, z: clamped.z }, true);
    }
  });

  const capHalfH = MOVEMENT.capsuleHeight / 2 - MOVEMENT.capsuleRadius;
  const capCenterY = capHalfH + MOVEMENT.capsuleRadius;

  const characterMesh = (
    <group renderOrder={CHARACTER_MESH_RENDER_ORDER}>
      <PlayerAvatar rotationY={0} team={localTeam} />
    </group>
  );

  const playerCrown = (
    <PlayerJumpHat
      bodyRef={bodyRef}
      visualRef={visualRef}
      tiltRef={tiltRef}
      bobRef={bobRef}
      groundedRef={grounded}
    />
  );

  const playerThrusters = (
    <PlayerDroneThrusters
      team={localTeam}
      throttleRef={thrusterThrottle}
      jumpBoostRef={thrusterJumpBoost}
    />
  );

  return (
    <group visible={!debugFreelook}>
      <LocalHeldBallVisual socketRef={holdSocketSmoothed} chestRef={chestPos} />
      <PlayerMotionRibbons bodyRef={bodyRef} />
      {playerVisualProxy ? (
        <PlayerVisualProxy
          bodyRef={bodyRef}
          capCenterY={capCenterY}
          visualRef={visualRef}
          tiltRef={tiltRef}
          bobRef={bobRef}
          groundedRef={grounded}
          thrusters={playerThrusters}
          overlay={playerCrown}
        >
          {characterMesh}
        </PlayerVisualProxy>
      ) : null}
      <RigidBody
        ref={bodyRef}
        position={[spawnPos.x, spawnPos.y, spawnPos.z]}
        colliders={false}
        mass={12}
        lockRotations
        linearDamping={0.5}
        enabledRotations={[false, false, false]}
        gravityScale={0}
        ccd
        userData={{ character: true, hitTarget: true, actorId: 'local' as const }}
        onCollisionEnter={(payload: CollisionEnterPayload) => {
          const n = payload.manifold.normal();
          if (n.y < -0.78) {
            const b = bodyRef.current;
            const v = b?.linvel();
            const impact = v ? Math.abs(v.x * n.x + v.y * n.y + v.z * n.z) : 0;
            triggerCeilingWallHit();
            playCeilingBump(impact);
          }
        }}
      >
        <CapsuleCollider
          args={[capHalfH, MOVEMENT.capsuleRadius]}
          position={[0, capCenterY, 0]}
          friction={0.55}
          collisionGroups={PLAYER_LOOSE_COLLISION}
        />
        {!playerVisualProxy ? (
          <group ref={visualRef} position={[0, capCenterY, 0]}>
            <group ref={tiltRef}>
              <group ref={bobRef}>
                {characterMesh}
                {playerThrusters}
              </group>
            </group>
          </group>
        ) : null}
      </RigidBody>
    </group>
  );
}
