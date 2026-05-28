import { useFrame, useThree } from '@react-three/fiber';
import {
  CapsuleCollider,
  CuboidCollider,
  interactionGroups,
  RigidBody,
  useAfterPhysicsStep,
  useRapier,
  type CollisionEnterPayload,
  type RapierRigidBody,
} from '@react-three/rapier';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
import { applyBallLaunchImpulse, applyBallRocketHitSpin, wakeBallBody } from './ballPhysics';
import { clampToHex, isInsideHex } from './arenaHex';
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
} from './grindRail';
import { burstGrindRailSparks } from './impactSparks';

const PLAYER_BODY_COLLISION = interactionGroups(0, [0, 2, 4]);
const PLAYER_BALL_SCOOP_COLLISION = interactionGroups(0, [1]);
const PLAYER_DEBUG_NOCLIP = interactionGroups(0, []);
const PLAYER_LOWER_COLLIDER = {
  halfExtents: [0.78, 0.18, 1.24] as [number, number, number],
  centerY: 0.16,
  centerZ: 0,
};
const PLAYER_UPPER_COLLIDER = {
  halfExtents: [0.42, 0.58, 0.54] as [number, number, number],
  centerY: 0.98,
  centerZ: 0.7,
};
const _bodyYawQuat = new THREE.Quaternion();
const _bodyYawAxis = new THREE.Vector3(0, 1, 0);

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

function clampHorizontalVelocity(
  velocity: THREE.Vector3,
  maxSpeed: number,
): void {
  const horiz = Math.hypot(velocity.x, velocity.z);
  if (horiz <= maxSpeed || horiz <= 0.0001) return;
  const scale = maxSpeed / horiz;
  velocity.x *= scale;
  velocity.z *= scale;
}

const _moveVelXZ = new THREE.Vector3();
const _ePropelDir = new THREE.Vector3();
const _grappleToChest = new THREE.Vector3();
const _grappleLaunchTangent = new THREE.Vector3();
const _grapplePlanarDir = new THREE.Vector3();
const _grappleMidpoint = new THREE.Vector3();
const _grappleCableDir = new THREE.Vector3();
const _grappleCableUp = new THREE.Vector3(0, 1, 0);
const _grappleCableQuat = new THREE.Quaternion();
const _ballStompNormal = new THREE.Vector3();
const _ballStompImpulse = new THREE.Vector3();
const _ballStompContact = new THREE.Vector3();
const BALL_STOMP_COOLDOWN_SEC = 0.22;
const BALL_STOMP_MIN_FALL_SPEED = 2.35;
const BALL_SCOOP_POP_MIN_UP_SPEED = 2.6;

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
    angularVelocity: { x: number; y: number; z: number };
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
  const fallAssistTimer = useRef(0);
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
  const [playerBodyCollisionGroups, setPlayerBodyCollisionGroupsState] = useState(
    PLAYER_BODY_COLLISION,
  );
  const [playerBallCollisionGroups, setPlayerBallCollisionGroupsState] = useState(
    PLAYER_BALL_SCOOP_COLLISION,
  );
  const playerBodyCollisionGroupsRef = useRef(PLAYER_BODY_COLLISION);
  const playerBallCollisionGroupsRef = useRef(PLAYER_BALL_SCOOP_COLLISION);
  const regenTimer = useRef(0);
  const draining = useRef(false);
  const holdingBall = useRef(false);
  const playerCarryingBall = useRef(false);
  const ballReleaseLockUntil = useRef(0);
  const ballStompCooldownUntil = useRef(0);
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
  const cameraPivotTarget = useRef(new THREE.Vector3());
  const cameraPivotReady = useRef(false);
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
  const grappleActive = useRef(false);
  const grappleAnchor = useRef(new THREE.Vector3());
  const grappleLength = useRef(0);
  const grappleTargetLength = useRef(0);
  const grappleNeedsSetup = useRef(false);
  const grappleKickPending = useRef(false);
  const grapplePlanarDir = useRef(new THREE.Vector3(0, 0, -1));
  const grappleCableRef = useRef<THREE.Mesh>(null);
  const alignPlayerBodyYaw = useCallback((yaw: number) => {
    const body = bodyRef.current;
    if (!body) return;
    _bodyYawQuat.setFromAxisAngle(_bodyYawAxis, yaw);
    body.setRotation(
      {
        x: _bodyYawQuat.x,
        y: _bodyYawQuat.y,
        z: _bodyYawQuat.z,
        w: _bodyYawQuat.w,
      },
      true,
    );
  }, []);
  const setPlayerCollisionGroups = useCallback((bodyGroups: number, ballGroups: number) => {
    if (playerBodyCollisionGroupsRef.current !== bodyGroups) {
      playerBodyCollisionGroupsRef.current = bodyGroups;
      setPlayerBodyCollisionGroupsState(bodyGroups);
    }
    if (playerBallCollisionGroupsRef.current !== ballGroups) {
      playerBallCollisionGroupsRef.current = ballGroups;
      setPlayerBallCollisionGroupsState(ballGroups);
    }
  }, []);
  const writeCameraPivot = useCallback(
    (x: number, y: number, z: number, dt: number, snap = false) => {
      const target = cameraPivotTarget.current.set(
        x,
        y + CAMERA.pivotHeight,
        z,
      );
      const pivot = pivotRef.current;
      if (
        snap ||
        !cameraPivotReady.current ||
        pivot.distanceToSquared(target) > 64 ||
        dt <= 0
      ) {
        pivot.copy(target);
        cameraPivotReady.current = true;
        return pivot;
      }

      const xzAlpha = 1 - Math.exp(-18 * dt);
      const yAlpha = 1 - Math.exp(-24 * dt);
      pivot.x += (target.x - pivot.x) * xzAlpha;
      pivot.z += (target.z - pivot.z) * xzAlpha;
      pivot.y += (target.y - pivot.y) * yAlpha;
      return pivot;
    },
    [],
  );
  const stopGrapple = useCallback((boost = false) => {
    if (!grappleActive.current) return;
    grappleActive.current = false;
    grappleNeedsSetup.current = false;
    grappleKickPending.current = false;
    const body = bodyRef.current;
    if (boost && body) {
      const lv = body.linvel();
      body.setLinvel(
        {
          x: lv.x * MOVEMENT.grappleReleaseBoost,
          y: Math.max(lv.y, 0) + 2.2,
          z: lv.z * MOVEMENT.grappleReleaseBoost,
        },
        true,
      );
    }
  }, []);
  const tryStartGrapple = useCallback(
    (origin: THREE.Vector3, lookDir: THREE.Vector3) => {
      if (lookDir.y < MOVEMENT.grappleMinLookY) return false;
      const ceilingY = ARENA.wallHeight + ARENA.ceilingOverlapM - 0.08;
      const t = (ceilingY - origin.y) / Math.max(lookDir.y, 0.0001);
      if (t <= 0 || t > MOVEMENT.grappleMaxDistance) return false;
      const hitX = origin.x + lookDir.x * t;
      const hitZ = origin.z + lookDir.z * t;
      if (!isInsideHex(hitX, hitZ, ARENA.hexRadius - 1.4)) return false;
      _grapplePlanarDir.set(lookDir.x, 0, lookDir.z);
      if (_grapplePlanarDir.lengthSq() < 0.0001) {
        _grapplePlanarDir.set(
          -Math.sin(inputManager.getRotation().yaw),
          0,
          -Math.cos(inputManager.getRotation().yaw),
        );
      }
      _grapplePlanarDir.normalize();
      grapplePlanarDir.current.copy(_grapplePlanarDir);
      const anchorHoriz = Math.hypot(hitX - origin.x, hitZ - origin.z);
      let anchorX = hitX;
      let anchorZ = hitZ;
      if (anchorHoriz < MOVEMENT.grappleMinAnchorForwardM) {
        anchorX =
          origin.x + _grapplePlanarDir.x * MOVEMENT.grappleMinAnchorForwardM;
        anchorZ =
          origin.z + _grapplePlanarDir.z * MOVEMENT.grappleMinAnchorForwardM;
        const clamped = clampToHex(anchorX, anchorZ, ARENA.hexRadius - 1.4, 0);
        anchorX = clamped.x;
        anchorZ = clamped.z;
      }
      grappleAnchor.current.set(anchorX, ceilingY, anchorZ);
      const initialLength = Math.max(
        4.5,
        grappleAnchor.current.distanceTo(origin),
      );
      grappleLength.current = initialLength;
      grappleTargetLength.current = initialLength;
      grappleNeedsSetup.current = true;
      grappleKickPending.current = true;
      grappleActive.current = true;
      return true;
    },
    [],
  );
  const stopGrindRailRide = useCallback((cooldownSec = 0) => {
    if (grindRailActive.current) {
      grindRailActive.current = false;
      setGrindRailActive(false);
    }
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
    cameraPivotReady.current = false;
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
      playBallLaunch();
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

    const pv = body.linvel();
    const bt = ball.translation();
    const feetY = playerFeetY(tr.y);
    const ballTopY = bt.y + BALL.radius;
    const ballBottomY = bt.y - BALL.radius;
    const scoopTopY =
      tr.y + PLAYER_LOWER_COLLIDER.centerY + PLAYER_LOWER_COLLIDER.halfExtents[1];
    const ballDx = bt.x - tr.x;
    const ballDz = bt.z - tr.z;
    const popYaw = inputManager.getRotation().yaw;
    const localBallX =
      ballDx * -Math.cos(popYaw) + ballDz * Math.sin(popYaw);
    const localBallZ =
      ballDx * -Math.sin(popYaw) + ballDz * -Math.cos(popYaw);
    const ballOverLowerScoop =
      Math.abs(localBallX) <=
        PLAYER_LOWER_COLLIDER.halfExtents[0] + BALL.radius * 0.48 &&
      Math.abs(localBallZ - PLAYER_LOWER_COLLIDER.centerZ) <=
        PLAYER_LOWER_COLLIDER.halfExtents[2] + BALL.radius * 0.42;
    const horizToBall = Math.hypot(bt.x - tr.x, bt.z - tr.z);
    if (
      now >= ballStompCooldownUntil.current &&
      pv.y > BALL_SCOOP_POP_MIN_UP_SPEED &&
      ballBottomY >= scoopTopY - 0.42 &&
      ballBottomY <= scoopTopY + 0.95 &&
      ballOverLowerScoop
    ) {
      _ballStompNormal.set(bt.x - tr.x, 0.62, bt.z - tr.z);
      if (Math.hypot(_ballStompNormal.x, _ballStompNormal.z) < 0.08) {
        if (lastWishDir.current.lengthSq() > 0.01) {
          _ballStompNormal.set(lastWishDir.current.x, 0.74, lastWishDir.current.z);
        } else {
          _ballStompNormal.set(pv.x, 0.74, pv.z);
        }
      }
      if (_ballStompNormal.lengthSq() > 0.0001) {
        _ballStompNormal.normalize();
        const mass = ball.mass();
        const horizontalSpeed = Math.hypot(pv.x, pv.z);
        const impact = THREE.MathUtils.clamp(
          pv.y * 5.2 + horizontalSpeed * 0.85,
          18,
          42,
        );
        _ballStompImpulse.copy(_ballStompNormal).multiplyScalar(impact * mass);
        _ballStompImpulse.y = Math.max(
          _ballStompImpulse.y,
          (12 + pv.y * 2.2) * mass,
        );
        ball.applyImpulse(
          {
            x: _ballStompImpulse.x + pv.x * mass * 0.3,
            y: _ballStompImpulse.y,
            z: _ballStompImpulse.z + pv.z * mass * 0.3,
          },
          true,
        );
        applyBallRocketHitSpin(
          ball,
          _ballStompImpulse.x,
          _ballStompImpulse.y,
          _ballStompImpulse.z,
          -_ballStompNormal.x,
          -_ballStompNormal.y,
          -_ballStompNormal.z,
        );
        wakeBallBody(ball);
        if (multiplayerStore.getState().enabled) {
          _ballStompContact.set(tr.x, scoopTopY, tr.z);
          multiplayerStore.sendRocketImpact({
            position: {
              x: _ballStompContact.x,
              y: _ballStompContact.y,
              z: _ballStompContact.z,
            },
            radius: BALL.radius * 3.2,
            rocketVelocity: {
              x: _ballStompImpulse.x / Math.max(mass, 0.001) + pv.x * 0.3,
              y: _ballStompImpulse.y / Math.max(mass, 0.001),
              z: _ballStompImpulse.z / Math.max(mass, 0.001) + pv.z * 0.3,
            },
            ballImpactNormal: {
              x: -_ballStompNormal.x,
              y: -_ballStompNormal.y,
              z: -_ballStompNormal.z,
            },
          });
        }
        body.setLinvel(
          {
            x: pv.x * 0.92,
            y: Math.max(0.8, pv.y * 0.42),
            z: pv.z * 0.92,
          },
          true,
        );
        ballStompCooldownUntil.current = now + BALL_STOMP_COOLDOWN_SEC;
      }
    }
    if (
      now >= ballStompCooldownUntil.current &&
      pv.y < -BALL_STOMP_MIN_FALL_SPEED &&
      feetY > bt.y - BALL.radius * 0.2 &&
      feetY < ballTopY + 0.58 &&
      horizToBall < BALL.radius + PLAYER_LOWER_COLLIDER.halfExtents[0] + 0.34
    ) {
      _ballStompNormal.set(bt.x - tr.x, -0.38, bt.z - tr.z);
      if (Math.hypot(_ballStompNormal.x, _ballStompNormal.z) < 0.08) {
        if (lastWishDir.current.lengthSq() > 0.01) {
          _ballStompNormal.set(lastWishDir.current.x, -0.42, lastWishDir.current.z);
        } else {
          _ballStompNormal.set(pv.x, -0.42, pv.z);
        }
      }
      if (_ballStompNormal.lengthSq() > 0.0001) {
        _ballStompNormal.normalize();
        const mass = ball.mass();
        const horizontalSpeed = Math.hypot(pv.x, pv.z);
        const impact = THREE.MathUtils.clamp(
          -pv.y * 4.4 + horizontalSpeed * 0.9,
          13,
          30,
        );
        _ballStompImpulse.copy(_ballStompNormal).multiplyScalar(impact * mass);
        ball.applyImpulse(
          {
            x: _ballStompImpulse.x,
            y: _ballStompImpulse.y,
            z: _ballStompImpulse.z,
          },
          true,
        );
        applyBallRocketHitSpin(
          ball,
          _ballStompImpulse.x,
          _ballStompImpulse.y,
          _ballStompImpulse.z,
          -_ballStompNormal.x,
          -_ballStompNormal.y,
          -_ballStompNormal.z,
        );
        wakeBallBody(ball);
        if (multiplayerStore.getState().enabled) {
          _ballStompContact.set(
            tr.x + _ballStompNormal.x * PLAYER_LOWER_COLLIDER.halfExtents[0],
            feetY,
            tr.z + _ballStompNormal.z * PLAYER_LOWER_COLLIDER.halfExtents[2],
          );
          multiplayerStore.sendRocketImpact({
            position: {
              x: _ballStompContact.x,
              y: _ballStompContact.y,
              z: _ballStompContact.z,
            },
            radius: BALL.radius * 3.1,
            rocketVelocity: {
              x: _ballStompImpulse.x / Math.max(mass, 0.001),
              y: _ballStompImpulse.y / Math.max(mass, 0.001),
              z: _ballStompImpulse.z / Math.max(mass, 0.001),
            },
            ballImpactNormal: {
              x: -_ballStompNormal.x,
              y: -_ballStompNormal.y,
              z: -_ballStompNormal.z,
            },
          });
        }
        const playerBounce = Math.min(3.8, -pv.y * 0.32);
        body.setLinvel(
          {
            x: pv.x * 0.94,
            y: Math.max(pv.y, playerBounce),
            z: pv.z * 0.94,
          },
          true,
        );
        ballStompCooldownUntil.current = now + BALL_STOMP_COOLDOWN_SEC;
      }
    }

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
        setPlayerCollisionGroups(PLAYER_DEBUG_NOCLIP, PLAYER_DEBUG_NOCLIP);
      }
      return;
    }

    if (flyModeActive.current) {
      flyModeActive.current = false;
      const carrying =
        holdingBall.current || gameStore.getState().ballHolderId === 'local';
      setPlayerCollisionGroups(
        PLAYER_BODY_COLLISION,
        carrying ? PLAYER_DEBUG_NOCLIP : PLAYER_BALL_SCOOP_COLLISION,
      );
    }

    const carryingBall =
      holdingBall.current || gameStore.getState().ballHolderId === 'local';
    if (carryingBall !== playerCarryingBall.current) {
      playerCarryingBall.current = carryingBall;
      setPlayerCollisionGroups(
        PLAYER_BODY_COLLISION,
        carryingBall ? PLAYER_DEBUG_NOCLIP : PLAYER_BALL_SCOOP_COLLISION,
      );
    }

    if (!spawnApplied.current && applyTeamSpawn()) {
      const t = body.translation();
      const pivot = writeCameraPivot(t.x, t.y, t.z, dt, true);
      const rot = inputManager.getRotation();
      updateThirdPersonCamera(
        camera,
        pivot,
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
      cameraPivotReady.current = false;
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
      alignPlayerBodyYaw(yaw);
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
        const pivot = writeCameraPivot(t.x, t.y, t.z, dt, true);
        const rot = inputManager.getRotation();
        syncPreGamePresentation(rot.yaw);
        updateThirdPersonCamera(
          camera,
          pivot,
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
    const effectiveWalkSpeed = Math.max(tune.walkSpeed, MOVEMENT.walkSpeed);
    const effectiveSprintSpeed = Math.max(tune.sprintSpeed, MOVEMENT.sprintSpeed);
    if (gameStore.getState().arenaSettleCountdown > 0) {
      const t = body.translation();
      const pos = _posScratch.current.set(t.x, t.y, t.z);
      const rot = inputManager.getRotation();
      syncPreGamePresentation(rot.yaw);
      chestPos.current.set(pos.x, pos.y + BEAM.chestHeight, pos.z);
      const pivot = writeCameraPivot(pos.x, pos.y, pos.z, dt, true);
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
        pivot,
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
        effectiveWalkSpeed,
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
        walkSpeed: effectiveWalkSpeed,
        grounded: groundedStun,
        dt,
      });

      const lv = body.linvel();
      const stunMoveSpeed = Math.hypot(lv.x, lv.z);
      const stunFactor = speedCameraFactor(
        stunMoveSpeed,
        effectiveWalkSpeed,
        effectiveSprintSpeed,
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
      const pivot = writeCameraPivot(tr.x, tr.y, tr.z, dt, false);
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
        pivot,
        rot.yaw,
        inputManager.getAimPitch(),
        dt,
        false,
        camSpeedExtra.current,
      );
      alignPlayerBodyYaw(rot.yaw);
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
    const beamDown = inputManager.isBeam();
    const grapplePressed = inputManager.consumeGrapple();

    const pivot = writeCameraPivot(pos.x, pos.y, pos.z, dt, false);
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
      effectiveWalkSpeed,
      effectiveSprintSpeed,
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
      pivot,
      rot.yaw,
      inputManager.getAimPitch(),
      dt,
      snapCam,
      camSpeedExtra.current,
    );

    const aimPitch = inputManager.getAimPitch();
    alignPlayerBodyYaw(rot.yaw);

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
    const fastDropHeld =
      !grounded.current &&
      !grappleActive.current &&
      !grindRailActive.current &&
      move.y < -0.01;
    const moveForAirControl = fastDropHeld
      ? { x: move.x, y: 0 }
      : move;
    const sprintInput = !goalEjectMoveLocked && inputManager.isSprint();
    const canSprint = energy.current > 0;
    const sprinting =
      sprintInput &&
      canSprint &&
      (moveForAirControl.x !== 0 || moveForAirControl.y !== 0);
    const walkSpeed = effectiveWalkSpeed;
    const sprintSpeed = effectiveSprintSpeed;
    const speed = sprinting ? sprintSpeed : walkSpeed;
    const accel = grounded.current ? MOVEMENT.groundAccel : MOVEMENT.groundAccel * 0.65;

    cameraMoveTargetXZ(_moveVelXZ, forward, right, moveForAirControl, speed);
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
      const maxHorizontalSpeed = sprintSpeed * MOVEMENT.maxHorizontalSpeedSprintMul;
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

      clampHorizontalVelocity(velocity.current, maxHorizontalSpeed);
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
          const exitSpeed = Math.max(grindRailSpeed.current, horizontalSpeed) * GRIND_RAIL.edgePopSpeedMul;
          stopGrindRailRide(GRIND_RAIL.jumpCooldownSec * 0.35);
          railJumpVy = GRIND_RAIL.edgePopUpSpeed;
          velocity.current.x = tangentX * exitSpeed;
          velocity.current.z = tangentZ * exitSpeed;
          velocity.current.y = GRIND_RAIL.edgePopUpSpeed;
          const tr = body.translation();
          const nextX = tr.x + tangentX * GRIND_RAIL.edgePopForwardM;
          const nextY = tr.y + 0.22;
          const nextZ = tr.z + tangentZ * GRIND_RAIL.edgePopForwardM;
          body.setTranslation(
            { x: nextX, y: nextY, z: nextZ },
            true,
          );
          pos.set(nextX, nextY, nextZ);
        } else {
          grindRailWobble.current += dt * THREE.MathUtils.lerp(8, 15, Math.min(1, grindRailSpeed.current / Math.max(1, effectiveSprintSpeed * 2)));
          grindRailSpeed.current = Math.max(
            0,
            grindRailSpeed.current - GRIND_RAIL.decelMps2 * dt,
          );
          const wobbleSide = Math.sin(grindRailWobble.current) * 0.1;
          const wobbleLift = Math.abs(Math.cos(grindRailWobble.current * 1.6)) * 0.05;
          const rideY = GRIND_RAIL.y + GRIND_RAIL.radius - capCenterY + 0.31 + wobbleLift;
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
        Math.max(horizontalSpeed * 3, walkSpeed * 3),
        walkSpeed * 3,
        sprintSpeed * GRIND_RAIL.maxSpeedSprintMul,
      );
      const rideY = GRIND_RAIL.y + GRIND_RAIL.radius - capCenterY + 0.31;
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
      !grappleActive.current &&
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

    if (grappleActive.current && jumpPressed) {
      stopGrapple(true);
      grounded.current = false;
      jumpAirGrace.current = MOVEMENT.jumpAirGraceSec;
      coyoteTime.current = 0;
    } else if (jumpPressed && !railConsumedJump && !grindRailActive.current) {
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
      if (!grappleActive.current && !grounded.current && vy < -0.1) {
        fallAssistTimer.current += dt;
      } else {
        fallAssistTimer.current = 0;
      }
      const fallMult =
        fastDropHeld
          ? MOVEMENT.fastDropFallMult
          : fallAssistTimer.current >= MOVEMENT.fallAssistDelaySec
            ? MOVEMENT.fallAssistMult
            : 1;
      vy += tune.gravity * dt * fallMult;
    }

    velocity.current.y = vy;
    if (grappleActive.current) {
      const safeGroundY = Math.max(ARENA.floorY, probe.groundY);
      const safeFeetY =
        safeGroundY + MOVEMENT.grappleHangFeetAboveGroundM;
      const safeBodyY = safeFeetY - playerFeetY(0);
      const safeChestY = safeBodyY + BEAM.chestHeight;
      if (grappleNeedsSetup.current) {
        grappleTargetLength.current = Math.max(
          4.2,
          grappleAnchor.current.y -
            safeChestY +
            MOVEMENT.grappleArcadeSlackM,
        );
        grappleLength.current = Math.min(
          grappleLength.current,
          grappleTargetLength.current + 3.5,
        );
        grappleNeedsSetup.current = false;
      }
      if (grappleLength.current > grappleTargetLength.current) {
        grappleLength.current = Math.max(
          grappleTargetLength.current,
          grappleLength.current - MOVEMENT.grappleRetractSpeed * dt,
        );
      } else {
        grappleLength.current = THREE.MathUtils.lerp(
          grappleLength.current,
          grappleTargetLength.current,
          Math.min(1, MOVEMENT.grappleRetractSpeed * 0.55 * dt),
        );
      }
      const chestX = pos.x;
      const chestY = pos.y + BEAM.chestHeight;
      const chestZ = pos.z;
      _grappleToChest.set(
        chestX - grappleAnchor.current.x,
        chestY - grappleAnchor.current.y,
        chestZ - grappleAnchor.current.z,
      );
      const dist = _grappleToChest.length();
      if (dist > 0.001) {
        _grappleToChest.multiplyScalar(1 / dist);
        const ropeDir = _grappleToChest;
        const radialSpeed =
          velocity.current.x * ropeDir.x +
          velocity.current.y * ropeDir.y +
          velocity.current.z * ropeDir.z;
        if (grappleKickPending.current) {
          _grappleLaunchTangent
            .copy(grapplePlanarDir.current)
            .sub(
              _grappleToChest.clone().multiplyScalar(
                grapplePlanarDir.current.dot(ropeDir),
              ),
            );
          if (_grappleLaunchTangent.lengthSq() < 0.001) {
            _grappleLaunchTangent.set(
              velocity.current.x,
              velocity.current.y,
              velocity.current.z,
            );
            _grappleLaunchTangent.sub(
              ropeDir.clone().multiplyScalar(
                _grappleLaunchTangent.dot(ropeDir),
              ),
            );
          }
          if (_grappleLaunchTangent.lengthSq() > 0.001) {
            _grappleLaunchTangent.normalize();
            const currentHoriz = Math.hypot(
              velocity.current.x,
              velocity.current.z,
            );
            const launchSpeed = THREE.MathUtils.clamp(
              Math.max(
                currentHoriz * MOVEMENT.grappleLaunchSpeedMul,
                sprintSpeed * MOVEMENT.grappleMinLaunchSpeedSprintMul,
              ),
              sprintSpeed * 1.15,
              sprintSpeed * MOVEMENT.grappleMaxHorizontalSpeedSprintMul,
            );
            velocity.current.x =
              _grappleLaunchTangent.x * launchSpeed;
            velocity.current.y = Math.max(
              velocity.current.y,
              _grappleLaunchTangent.y * launchSpeed + 2.8,
            );
            velocity.current.z =
              _grappleLaunchTangent.z * launchSpeed;
          }
          grappleKickPending.current = false;
        }
        _grappleLaunchTangent.set(
          velocity.current.x - ropeDir.x * radialSpeed,
          velocity.current.y - ropeDir.y * radialSpeed,
          velocity.current.z - ropeDir.z * radialSpeed,
        );
        if (_grappleLaunchTangent.lengthSq() < 1.4) {
          _grappleLaunchTangent
            .copy(grapplePlanarDir.current)
            .sub(
              ropeDir.clone().multiplyScalar(
                grapplePlanarDir.current.dot(ropeDir),
              ),
            );
        }
        if (_grappleLaunchTangent.lengthSq() > 0.001) {
          _grappleLaunchTangent.normalize();
          const swingDamp = Math.pow(
            MOVEMENT.grappleSwingDamping,
            dt * 60,
          );
          velocity.current.x =
            velocity.current.x * swingDamp +
            _grappleLaunchTangent.x * MOVEMENT.grappleSwingDrive * dt;
          velocity.current.y =
            velocity.current.y * swingDamp +
            _grappleLaunchTangent.y * MOVEMENT.grappleSwingDrive * dt;
          velocity.current.z =
            velocity.current.z * swingDamp +
            _grappleLaunchTangent.z * MOVEMENT.grappleSwingDrive * dt;
        }
        if (dist > grappleLength.current) {
          const tighten = dist - grappleLength.current;
          if (radialSpeed > 0) {
            const radialTrim = radialSpeed * 0.32;
            velocity.current.x -= ropeDir.x * radialTrim;
            velocity.current.y -= ropeDir.y * radialTrim;
            velocity.current.z -= ropeDir.z * radialTrim;
          }
          velocity.current.x -= ropeDir.x * tighten * MOVEMENT.grapplePullTightness;
          velocity.current.y -= ropeDir.y * tighten * MOVEMENT.grapplePullTightness;
          velocity.current.z -= ropeDir.z * tighten * MOVEMENT.grapplePullTightness;
          const nextChestX = grappleAnchor.current.x + ropeDir.x * grappleLength.current;
          const nextChestY = grappleAnchor.current.y + ropeDir.y * grappleLength.current;
          const nextChestZ = grappleAnchor.current.z + ropeDir.z * grappleLength.current;
          const nextBodyY = nextChestY - BEAM.chestHeight;
          body.setTranslation(
            {
              x: nextChestX,
              y: Math.max(nextBodyY, safeBodyY),
              z: nextChestZ,
            },
            true,
          );
          pos.set(nextChestX, Math.max(nextBodyY, safeBodyY), nextChestZ);
        }
      }
      if (pos.y < safeBodyY) {
        body.setTranslation({ x: pos.x, y: safeBodyY, z: pos.z }, true);
        pos.set(pos.x, safeBodyY, pos.z);
        if (velocity.current.y < 0) velocity.current.y = 0;
      }
      grounded.current = false;
      jumpAirGrace.current = Math.max(jumpAirGrace.current, 0.06);
      clampHorizontalVelocity(
        velocity.current,
        sprintSpeed * MOVEMENT.grappleMaxHorizontalSpeedSprintMul,
      );
    }
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

    if (!beamDown) {
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
    if (
      grapplePressed &&
      !grappleActive.current &&
      !holdingBall.current &&
      !goalEjectMoveLocked &&
      !grindRailActive.current &&
      !knockStunned &&
      !frozen
    ) {
      if (!tryStartGrapple(chestPos.current, lookDir)) {
        if (now - beamNoLockSoundAt.current > 0.45) {
          beamNoLockSoundAt.current = now;
          playBeamNoLock();
        }
      } else {
        grounded.current = false;
        jumpAirGrace.current = Math.max(jumpAirGrace.current, 0.08);
      }
    }
    const beamAttempt =
      beamDown &&
      !beamNeedsRepress.current &&
      !knockStunned &&
      energy.current >= ENERGY.minBeam &&
      !frozen &&
      !grappleActive.current;
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

    if (beamAttempt && !beamInput) {
      if (now - beamNoLockSoundAt.current > 0.45) {
        beamNoLockSoundAt.current = now;
        playBeamNoLock();
      }
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
      applyBallLaunchImpulse(ball, velocity, swingVel, lookDir);
      const av = ball.angvel();
      onBallReleased?.({
        position: {
          x: _holdSocket.current.x,
          y: _holdSocket.current.y,
          z: _holdSocket.current.z,
        },
        velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
        angularVelocity: { x: av.x, y: av.y, z: av.z },
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

    const grappleCable = grappleCableRef.current;
    if (grappleCable) {
      if (grappleActive.current) {
        _grappleCableDir.copy(grappleAnchor.current).sub(chestPos.current);
        const cableLength = _grappleCableDir.length();
        if (cableLength > 0.001) {
          _grappleMidpoint
            .copy(chestPos.current)
            .add(grappleAnchor.current)
            .multiplyScalar(0.5);
          _grappleCableDir.multiplyScalar(1 / cableLength);
          _grappleCableQuat.setFromUnitVectors(
            _grappleCableUp,
            _grappleCableDir,
          );
          grappleCable.visible = true;
          grappleCable.position.copy(_grappleMidpoint);
          grappleCable.quaternion.copy(_grappleCableQuat);
          grappleCable.scale.set(1, cableLength, 1);
        } else {
          grappleCable.visible = false;
        }
      } else {
        grappleCable.visible = false;
      }
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
      <mesh ref={grappleCableRef} visible={false} frustumCulled={false}>
        <cylinderGeometry args={[0.018, 0.018, 1, 8, 1, true]} />
        <meshBasicMaterial
          color="#8fd8ff"
          transparent
          opacity={0.92}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
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
          friction={0.65}
          collisionGroups={playerBodyCollisionGroups}
        />
        <CuboidCollider
          args={PLAYER_LOWER_COLLIDER.halfExtents}
          position={[0, PLAYER_LOWER_COLLIDER.centerY, PLAYER_LOWER_COLLIDER.centerZ]}
          friction={0.55}
          collisionGroups={playerBallCollisionGroups}
        />
        <CuboidCollider
          args={PLAYER_UPPER_COLLIDER.halfExtents}
          position={[0, PLAYER_UPPER_COLLIDER.centerY, PLAYER_UPPER_COLLIDER.centerZ]}
          friction={0.55}
          collisionGroups={playerBallCollisionGroups}
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
