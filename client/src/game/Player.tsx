import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import {
  CapsuleCollider,
  CuboidCollider,
  interactionGroups,
  RigidBody,
  useAfterPhysicsStep,
  useRapier,
  type CollisionEnterPayload,
  type RapierCollider,
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
import {
  clampToHex,
  hexBoundaryNormal,
  hexSlackToBoundary,
  isInsideHex,
} from './arenaHex';
import { getTeamSpawn } from './goals';
import {
  getCameraBasis,
  pointOnCrosshairAimRay,
  updateThirdPersonCamera,
} from './CameraController';
import { isDanceActive, isForwardFlipActive, triggerDanceEmote, triggerForwardFlip } from './forwardFlipEmote';
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
  setShiftWindActive,
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
import {
  multiplayerStore,
  type RemoteMultiplayerPlayer,
} from '../multiplayer/multiplayerStore';
import {
  applyCoopAdventureActionToBody,
  findCoopAdventureTarget,
  isCoopAdventureMode,
  makeCoopPullActionFromHold,
  makeCoopSetDownAction,
  makeCoopThrowAction,
} from '../coop/coopAdventurePlayerThrow';
import { coopCarryVisualStore } from '../coop/coopCarryVisualStore';
import { sampleCoopAdventureRailContact } from '../coop/coopAdventureRails';
import { sampleCoopAdventureCloudBounce } from '../coop/coopAdventureClouds';
import {
  GRIND_RAIL,
  sampleGrindRailContact,
} from './grindRail';
import { burstGroundSlideSparks, burstGrindRailSparks } from './impactSparks';
import { punchLightGlowForBody } from './lightGlowHits';
import {
  getTrainingCubeById,
  getNearestTrainingCube,
  setTrainingCubeHeldBy,
  type TrainingCubeTarget,
} from './trainingCubeRegistry';

const PLAYER_BODY_COLLISION = interactionGroups(0, [2, 4]);
const PLAYER_BALL_SCOOP_COLLISION = interactionGroups(0, [1]);
const PLAYER_DEBUG_NOCLIP = interactionGroups(0, []);
const BALL_PLAYER_COLLISION_REENABLE_DELAY_SEC = 0.5;
const BALL_WALK_PUSH_SCALE = 1.4;
const BALL_SHIFT_PUSH_SCALE = 3;
const TRAINING_CUBE_CAPTURE_EXTRA_M = 2.2;
const TRAINING_CUBE_HOLD_SMOOTH = 28;
const TRAINING_CUBE_THROW_SPEED = 31;
const TRAINING_CUBE_DROP_SPEED = 12;
const RAPIER_BODY_DYNAMIC = 0;
const RAPIER_BODY_KINEMATIC = 2;
const PLAYER_VISUAL_LIFT_Y = 0.1;
const PLAYER_LOWER_COLLIDER = {
  halfExtents: [0.78, 0.18, 1.24] as [number, number, number],
  centerY: 0.16,
  centerZ: 0,
};
const PLAYER_UPPER_COLLIDER_HALF_EXTENTS = [
  0.54,
  0.5,
  0.46,
] as [number, number, number];
const PLAYER_UPPER_COLLIDER = {
  halfExtents: PLAYER_UPPER_COLLIDER_HALF_EXTENTS,
  centerY:
    PLAYER_LOWER_COLLIDER.centerY +
    PLAYER_LOWER_COLLIDER.halfExtents[1] +
    PLAYER_UPPER_COLLIDER_HALF_EXTENTS[1],
  centerZ:
    PLAYER_LOWER_COLLIDER.centerZ +
    PLAYER_LOWER_COLLIDER.halfExtents[2] -
    PLAYER_UPPER_COLLIDER_HALF_EXTENTS[2],
};
const _bodyYawQuat = new THREE.Quaternion();
const _bodyYawAxis = new THREE.Vector3(0, 1, 0);
const _scoopPitchQuat = new THREE.Quaternion();
const _scoopPitchAxis = new THREE.Vector3(1, 0, 0);
const _scoopBodyQuat = new THREE.Quaternion();
const _scoopLowerLocal = new THREE.Vector3();
const _scoopUpperLocal = new THREE.Vector3();

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

const PLAYER_ARENA_WALL_MARGIN = MOVEMENT.capsuleRadius + ARENA.wallThickness + 0.85;
const PLAYER_ARENA_BUMPER_ZONE_M = 2.4;
const PLAYER_ARENA_BUMPER_SAFE_SLACK_M = 0.18;
const PLAYER_ARENA_BUMPER_RESTITUTION = 0.34;
const PLAYER_ARENA_BUMPER_PUSH_SPEED = 14;
const PLAYER_ARENA_GRAPPLE_DETACH_SPEED = 9;
const _arenaWallNormal = new THREE.Vector2();
const _grappleConstraintDir = new THREE.Vector3();

function applyPlayerArenaWallBumper(
  body: RapierRigidBody,
  pos: THREE.Vector3,
  velocity: THREE.Vector3,
  dt: number,
  detachGrapple: () => void,
  grappleActive: boolean,
): void {
  const playRadius = ARENA.hexRadius - PLAYER_ARENA_WALL_MARGIN;
  const predictedX = pos.x + velocity.x * Math.min(dt, 1 / 30);
  const predictedZ = pos.z + velocity.z * Math.min(dt, 1 / 30);
  const currentSlack = hexSlackToBoundary(pos.x, pos.z, playRadius);
  const predictedSlack = hexSlackToBoundary(predictedX, predictedZ, playRadius);
  const slack = Math.min(currentSlack, predictedSlack);
  if (slack > PLAYER_ARENA_BUMPER_ZONE_M) return;

  _arenaWallNormal.copy(
    hexBoundaryNormal(
      predictedSlack < currentSlack ? predictedX : pos.x,
      predictedSlack < currentSlack ? predictedZ : pos.z,
      playRadius,
    ),
  );
  const outwardSpeed =
    velocity.x * _arenaWallNormal.x + velocity.z * _arenaWallNormal.y;

  if (slack < PLAYER_ARENA_BUMPER_SAFE_SLACK_M) {
    const pushIn = PLAYER_ARENA_BUMPER_SAFE_SLACK_M - slack;
    pos.x -= _arenaWallNormal.x * pushIn;
    pos.z -= _arenaWallNormal.y * pushIn;
    body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
  }

  const closeT = THREE.MathUtils.clamp(
    1 - slack / PLAYER_ARENA_BUMPER_ZONE_M,
    0,
    1,
  );
  if (outwardSpeed > 0) {
    const restitution =
      PLAYER_ARENA_BUMPER_RESTITUTION * (grappleActive ? 1.35 : 1);
    velocity.x -= _arenaWallNormal.x * outwardSpeed * (1 + restitution);
    velocity.z -= _arenaWallNormal.y * outwardSpeed * (1 + restitution);
    if (grappleActive && outwardSpeed > PLAYER_ARENA_GRAPPLE_DETACH_SPEED) {
      detachGrapple();
    }
  }

  if (closeT > 0) {
    const inwardSpeed =
      PLAYER_ARENA_BUMPER_PUSH_SPEED *
      closeT *
      (grappleActive ? 1.4 : 1) *
      Math.min(1, dt * 60);
    velocity.x -= _arenaWallNormal.x * inwardSpeed;
    velocity.z -= _arenaWallNormal.y * inwardSpeed;
  }
}

const _moveVelXZ = new THREE.Vector3();
const _airFlyAimDir = new THREE.Vector3();
const _ePropelDir = new THREE.Vector3();
const _grapplePlanarDir = new THREE.Vector3();
const _grappleMidpoint = new THREE.Vector3();
const _grappleCableDir = new THREE.Vector3();
const _grappleCableUp = new THREE.Vector3(0, 1, 0);
const _grappleCableQuat = new THREE.Quaternion();
const _grapplePendulumTarget = new THREE.Vector3();
const _grapplePendulumVel = new THREE.Vector3();
const _ballStompNormal = new THREE.Vector3();
const _ballStompImpulse = new THREE.Vector3();
const _ballStompContact = new THREE.Vector3();
const BALL_STOMP_COOLDOWN_SEC = 0.22;
const BALL_STOMP_MIN_FALL_SPEED = 2.35;

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

function CoopHeldPlayerProxy({
  player,
  positionRef,
  lookDirRef,
}: {
  player: RemoteMultiplayerPlayer | null;
  positionRef: React.MutableRefObject<THREE.Vector3>;
  lookDirRef: React.MutableRefObject<THREE.Vector3>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const avatarRef = useRef<THREE.Group>(null);
  const displayPos = useRef(new THREE.Vector3());
  const displayQuat = useRef(new THREE.Quaternion());
  const ready = useRef(false);

  useEffect(() => {
    ready.current = false;
  }, [player?.id]);

  useFrame((_, dtRaw) => {
    const group = groupRef.current;
    if (!group || !player) return;
    const dt = Math.min(0.05, Math.max(1 / 120, dtRaw));
    if (!ready.current) {
      displayPos.current.copy(positionRef.current);
      ready.current = true;
    } else {
      displayPos.current.lerp(positionRef.current, 1 - Math.exp(-dt * 34));
    }
    group.position.copy(displayPos.current);
    const yaw = Math.atan2(-lookDirRef.current.x, -lookDirRef.current.z);
    displayQuat.current.setFromEuler(new THREE.Euler(0.35, yaw, -0.18));
    group.quaternion.slerp(displayQuat.current, 1 - Math.exp(-dt * 18));
    if (avatarRef.current) {
      const t = performance.now() * 0.008;
      avatarRef.current.rotation.x = Math.sin(t * 1.7) * 0.18;
      avatarRef.current.rotation.z = Math.cos(t * 1.25) * 0.16;
    }
  });

  if (!player) return null;

  return (
    <group ref={groupRef} renderOrder={CHARACTER_MESH_RENDER_ORDER + 2}>
      <group ref={avatarRef} scale={0.96}>
        <PlayerAvatar team={player.team} />
      </group>
      <Html center position={[0, 2.25, 0]} distanceFactor={16}>
        <div className="coop-carry-hearts">
          <span>&hearts;</span>
          <span>&hearts;</span>
          <span>&hearts;</span>
        </div>
      </Html>
    </group>
  );
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
      isSprinting?: boolean;
      holdPosition: { x: number; y: number; z: number } | null;
      coopRagdoll?: boolean;
      visualTilt?: { x: number; y: number; z: number };
      flipActive?: boolean;
      danceActive?: boolean;
    },
  ) => void;
  onPlayerBodyReady: (body: RapierRigidBody) => void;
  /** Return false when rockets are maxed out / empty */
  canFireRocket?: () => boolean;
  /** GameCanvas calls after a rocket blast knocks the player — refill jumps */
  onRocketBoostRef?: React.MutableRefObject<(() => void) | null>;
  disableArenaBounds?: boolean;
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
  disableArenaBounds = false,
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
  const capsuleColliderRef = useRef<RapierCollider>(null);
  const lowerScoopColliderRef = useRef<RapierCollider>(null);
  const upperScoopColliderRef = useRef<RapierCollider>(null);
  const visualRef = useRef<THREE.Group>(null);
  const tiltRef = useRef<THREE.Group>(null);
  const bobRef = useRef<THREE.Group>(null);
  const lastScoopTiltQuat = useRef(new THREE.Quaternion());
  const scoopTiltReady = useRef(false);
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
  const groundSlideSparkTimer = useRef(0);
  const airFlyPulseTimer = useRef(0);
  const airFlyDirReady = useRef(false);
  const airFlyDir = useRef(new THREE.Vector3(0, 0, -1));
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
  const heldTrainingCube = useRef<TrainingCubeTarget | null>(null);
  const trainingCubeSocket = useRef(new THREE.Vector3());
  const trainingCubeSocketReady = useRef(false);
  const trainingCubeLastSocket = useRef(new THREE.Vector3());
  const trainingCubeSyncTimer = useRef(0);
  const playerCarryingBall = useRef(false);
  const ballReleaseLockUntil = useRef(0);
  const ballStompCooldownUntil = useRef(0);
  /** After rocket hit — no beam attract on player body */
  const playerBeamDenyUntil = useRef(0);
  const ballSeparationGraceUntil = useRef(0);
  /** After LMB ball shot, beam stays off until RMB is released and pressed again */
  const beamNeedsRepress = useRef(false);
  const beamNoLockSoundAt = useRef(0);
  const coopCarryTargetId = useRef<string | null>(null);
  const coopWasBeamDown = useRef(false);
  const coopActionSendTimer = useRef(0);
  const coopCarriedUntil = useRef(0);
  const coopThrownRagdollActive = useRef(false);
  const coopThrowCollisionGraceUntil = useRef(0);
  const coopThrowMinRagdollUntil = useRef(0);
  const coopHeldTarget = useRef(new THREE.Vector3());
  const coopHeldTargetReady = useRef(false);
  const coopRagdollVisualActive = useRef(false);
  const coopCloudBounceCooldown = useRef(0);
  const coopCarryProxyPos = useRef(new THREE.Vector3());
  const coopCarryProxyDesired = useRef(new THREE.Vector3());
  const coopCarryProxyLookDir = useRef(new THREE.Vector3(0, 0, -1));
  const [coopCarryProxyPlayer, setCoopCarryProxyPlayer] =
    useState<RemoteMultiplayerPlayer | null>(null);
  const [loveToast, setLoveToast] = useState<string | null>(null);
  const loveToastUntil = useRef(0);
  const coopDanceUntil = useRef(0);
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
  const ballColliderDisabledUntil = useRef(0);
  const grappleAnchor = useRef(new THREE.Vector3());
  const grappleLength = useRef(0);
  const grappleTargetLength = useRef(0);
  const grappleNeedsSetup = useRef(false);
  const grappleKickPending = useRef(false);
  const grapplePlanarDir = useRef(new THREE.Vector3(0, 0, -1));
  const grappleSwingAxis = useRef(new THREE.Vector3(0, 0, -1));
  const grappleSwingPhase = useRef(0);
  const grappleSwingRadius = useRef(12);
  const grappleSwingPower = useRef(1);
  const grappleCableRef = useRef<THREE.Mesh>(null);
  const lightGlowBodyPos = useRef(new THREE.Vector3());
  const lastLightGlowBodyPos = useRef(new THREE.Vector3());
  const lightGlowBodyReady = useRef(false);
  const alignPlayerBodyYaw = useCallback((yaw: number, force = false) => {
    const capsule = capsuleColliderRef.current;
    const lower = lowerScoopColliderRef.current;
    const upper = upperScoopColliderRef.current;
    if (!capsule && !lower && !upper) return;
    _bodyYawQuat.setFromAxisAngle(_bodyYawAxis, yaw);
    const pitch = THREE.MathUtils.clamp(
      inputManager.getAimPitch(),
      -Math.PI * 0.42,
      Math.PI * 0.42,
    );
    _scoopPitchQuat.setFromAxisAngle(_scoopPitchAxis, pitch);
    _scoopBodyQuat.copy(_bodyYawQuat).multiply(_scoopPitchQuat);
    if (
      !force &&
      scoopTiltReady.current &&
      lastScoopTiltQuat.current.angleTo(_scoopBodyQuat) < 0.0015
    ) {
      return;
    }

    lastScoopTiltQuat.current.copy(_scoopBodyQuat);
    scoopTiltReady.current = true;

    const capsuleRot = {
      x: _bodyYawQuat.x,
      y: _bodyYawQuat.y,
      z: _bodyYawQuat.z,
      w: _bodyYawQuat.w,
    };
    const scoopRot = {
      x: _scoopBodyQuat.x,
      y: _scoopBodyQuat.y,
      z: _scoopBodyQuat.z,
      w: _scoopBodyQuat.w,
    };
    capsule?.setRotationWrtParent(capsuleRot);
    lower?.setRotationWrtParent(scoopRot);
    upper?.setRotationWrtParent(scoopRot);

    if (lower) {
      _scoopLowerLocal
        .set(0, PLAYER_LOWER_COLLIDER.centerY, PLAYER_LOWER_COLLIDER.centerZ)
        .applyQuaternion(_scoopBodyQuat);
      lower.setTranslationWrtParent({
        x: _scoopLowerLocal.x,
        y: _scoopLowerLocal.y,
        z: _scoopLowerLocal.z,
      });
    }
    if (upper) {
      _scoopUpperLocal
        .set(0, PLAYER_UPPER_COLLIDER.centerY, PLAYER_UPPER_COLLIDER.centerZ)
        .applyQuaternion(_scoopBodyQuat);
      upper.setTranslationWrtParent({
        x: _scoopUpperLocal.x,
        y: _scoopUpperLocal.y,
        z: _scoopUpperLocal.z,
      });
    }
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
  useEffect(
    () => () => {
      coopCarryVisualStore.setHeldTarget(null);
    },
    [],
  );
  const refreshPlayerBallCollision = useCallback((nowSec: number) => {
    const carrying =
      holdingBall.current || gameStore.getState().ballHolderId === 'local';
    const suppressBallCollider =
      carrying || nowSec < ballColliderDisabledUntil.current;
    const scoopEnabled = tuningStore.getState().rocketLeagueCollidersEnabled;
    setPlayerCollisionGroups(
      PLAYER_BODY_COLLISION,
      suppressBallCollider || !scoopEnabled
        ? PLAYER_DEBUG_NOCLIP
        : PLAYER_BALL_SCOOP_COLLISION,
    );
    playerCarryingBall.current = carrying;
  }, [setPlayerCollisionGroups]);
  const writeCameraPivot = useCallback(
    (x: number, y: number, z: number, dt: number, snap = false) => {
      void dt;
      void snap;
      const target = cameraPivotTarget.current.set(
        x,
        y + CAMERA.pivotHeight,
        z,
      );
      const pivot = pivotRef.current;
      pivot.copy(target);
      cameraPivotReady.current = true;
      return pivot;
    },
    [],
  );
  const stopGrapple = useCallback((boost = false) => {
    if (!grappleActive.current) return;
    grappleActive.current = false;
    grappleNeedsSetup.current = false;
    grappleKickPending.current = false;
    grappleSwingPower.current = 1;
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
      if (disableArenaBounds) return false;
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
      let anchorX = hitX;
      let anchorZ = hitZ;
      grappleAnchor.current.set(anchorX, ceilingY, anchorZ);
      grappleSwingAxis.current.copy(_grapplePlanarDir);
      const offsetAlong =
        (origin.x - anchorX) * grappleSwingAxis.current.x +
        (origin.z - anchorZ) * grappleSwingAxis.current.z;
      const swingRadius = THREE.MathUtils.clamp(
        Math.max(Math.abs(offsetAlong), MOVEMENT.grapplePendulumMinRadius),
        MOVEMENT.grapplePendulumMinRadius,
        MOVEMENT.grapplePendulumMaxRadius,
      );
      grappleSwingRadius.current = swingRadius;
      grappleSwingPhase.current = Math.asin(
        THREE.MathUtils.clamp(offsetAlong / swingRadius, -0.92, 0.92),
      );
      grappleSwingPower.current = MOVEMENT.grapplePendulumStartPower;
      const initialLength = Math.max(
        4.5,
        grappleAnchor.current.distanceTo(origin),
      );
      grappleLength.current = initialLength;
      grappleTargetLength.current = initialLength;
      grappleNeedsSetup.current = true;
      grappleKickPending.current = true;
      grappleActive.current = true;
      dashActiveTimer.current = 0;
      ePropelTimer.current = 0;
      ePropelElapsed.current = 0;
      ePropelVyBoost.current = null;
      return true;
    },
    [disableArenaBounds],
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
      multiplayerEnabled &&
      (multiplayerRoomMode === '2v2' ||
        isCoopAdventureMode(multiplayerRoomMode))
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

  useEffect(
    () => () => {
      setGrindRailActive(false);
      setBeamAttractActive(false);
      setShiftWindActive(false);
    },
    [],
  );

  const interruptBeamOnHit = useCallback(() => {
    const now = performance.now() / 1000;
    const dur = BALL.beamRegrabLockSec;
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
      ballColliderDisabledUntil.current = Math.max(
        ballColliderDisabledUntil.current,
        now + BALL_PLAYER_COLLISION_REENABLE_DELAY_SEC,
      );
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

    const tr = body.translation();
    const multiplayerNow = multiplayerStore.getState();
    const coopAdventureMode =
      multiplayerNow.enabled && isCoopAdventureMode(multiplayerNow.roomInfo?.mode);
    const arenaMechanicsEnabled = !coopAdventureMode && !disableArenaBounds;
    const padY = arenaMechanicsEnabled ? sampleTrampolineFloorY(tr.x, tr.z) : null;
    if (arenaMechanicsEnabled && padY !== null) {
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
    const playerBallPushScale =
      inputManager.isSprint() && energy.current > 0
        ? BALL_SHIFT_PUSH_SCALE
        : BALL_WALK_PUSH_SCALE;
    separateBallFromPlayer(body, ball, 0.35, true, playerBallPushScale);

    const pv = body.linvel();
    const bt = ball.translation();
    const feetY = playerFeetY(tr.y);
    const ballTopY = bt.y + BALL.radius;
    const horizToBall = Math.hypot(bt.x - tr.x, bt.z - tr.z);
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
      arenaMechanicsEnabled &&
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

  const syncScoopColliderTilt = useCallback((reset = false) => {
    alignPlayerBodyYaw(inputManager.getRotation().yaw, reset);
  }, [alignPlayerBodyYaw]);

  useFrame((_, dt) => {
    const body = bodyRef.current;
    if (!body) return;
    const coopAdventureMode =
      multiplayerEnabled && isCoopAdventureMode(multiplayerRoomMode);

    if (debugFreelook) {
      syncScoopColliderTilt(true);
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
      refreshPlayerBallCollision(performance.now() / 1000);
    }
    refreshPlayerBallCollision(performance.now() / 1000);

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
        0,
        world,
        body,
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
      syncScoopColliderTilt();
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
          0,
          world,
          body,
        );
      }
      return;
    }

    if (phase !== 'playing' && phase !== 'countdown') return;
    if (tuningStore.getState().showMenu) return;

    const tune = tuningStore.getState();
    if (!tune.grapplingHookEnabled && grappleActive.current) {
      stopGrapple(false);
    }
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
        isSprinting: false,
        holdPosition: null,
        visualTilt: { x: inputManager.getAimPitch(), y: 0, z: 0 },
        flipActive: isForwardFlipActive('local'),
        danceActive: isDanceActive('local'),
      });
      updateThirdPersonCamera(
        camera,
        pivot,
        rot.yaw,
        inputManager.getAimPitch(),
        dt,
        true,
        0,
        world,
        body,
      );
      setShiftWindActive(false);
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
        stunFactor *
          (tune.cameraSpeedPullbackEnabled ? CAMERA.speedDistanceMax : 0),
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
        isSprinting: gameStore.getState().isSprinting,
        holdPosition: null,
        visualTilt: { x: inputManager.getAimPitch(), y: 0, z: 0 },
        flipActive: isForwardFlipActive('local'),
        danceActive: isDanceActive('local'),
      });
      updateThirdPersonCamera(
        camera,
        pivot,
        rot.yaw,
        inputManager.getAimPitch(),
        dt,
        false,
        camSpeedExtra.current,
        world,
        body,
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
      syncScoopColliderTilt();
      setShiftWindActive(false);
      return;
    }
    knockStunWasActive.current = false;
    const localTeam = gameStore.getState().localTeam;
    dashCooldown.current = Math.max(0, dashCooldown.current - dt);
    ePropelCooldown.current = Math.max(0, ePropelCooldown.current - dt);
    groundSlideSparkTimer.current = Math.max(0, groundSlideSparkTimer.current - dt);
    coopCloudBounceCooldown.current = Math.max(0, coopCloudBounceCooldown.current - dt);
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
    const multiplayerNow = multiplayerStore.getState();
    const networkCoopAdventureMode =
      multiplayerNow.enabled && isCoopAdventureMode(multiplayerNow.roomInfo?.mode);
    const networkTrainingMode =
      multiplayerNow.enabled && multiplayerNow.roomInfo?.mode === 'training';
    const nowSec = performance.now() / 1000;
    let loveMessage = inputManager.consumeLoveMessage();
    while (loveMessage) {
      setLoveToast(loveMessage === 'love' ? 'I love you' : 'Love you more');
      loveToastUntil.current = nowSec + 2.4;
      if (networkCoopAdventureMode) {
        multiplayerStore.sendCoopAction({
          kind: 'loveMessage',
          targetId: '',
          message: loveMessage,
          position: { x: pos.x, y: pos.y, z: pos.z },
          velocity: { x: 0, y: 0, z: 0 },
        });
      }
      loveMessage = inputManager.consumeLoveMessage();
    }
    const dancePressed = inputManager.consumeDance();
    if (dancePressed && networkCoopAdventureMode) {
      coopDanceUntil.current = nowSec + 2.2;
      triggerDanceEmote('local');
      multiplayerStore.sendCoopAction({
        kind: 'dance',
        targetId: '',
        position: { x: pos.x, y: pos.y, z: pos.z },
        velocity: { x: 0, y: 0, z: 0 },
      });
    }
    if (loveToast && nowSec > loveToastUntil.current) {
      setLoveToast(null);
    }

    if (networkCoopAdventureMode) {
      const selfId = multiplayerNow.selfId;
      for (const action of multiplayerStore.drainRemoteCoopActions()) {
        if (!selfId || action.targetId !== selfId) continue;
        if (action.kind === 'playerPull') {
          const hold = action.holdPosition ?? action.position;
          if (coopHeldTargetReady.current) {
            _posScratch.current.set(hold.x, hold.y, hold.z);
            coopHeldTarget.current.lerp(
              _posScratch.current,
              1 - Math.exp(-dt * 18),
            );
          } else {
            coopHeldTarget.current.set(hold.x, hold.y, hold.z);
          }
          if (
            !coopHeldTargetReady.current ||
            coopHeldTarget.current.distanceTo(pos) > 28
          ) {
            body.setTranslation(coopHeldTarget.current, true);
            pos.copy(coopHeldTarget.current);
          }
          coopHeldTargetReady.current = true;
          coopCarriedUntil.current = nowSec + 0.22;
          coopThrownRagdollActive.current = false;
          if (!coopRagdollVisualActive.current) {
            impulseKnockVisualTumble(knockTumble.current);
            coopRagdollVisualActive.current = true;
          }
          applyCoopAdventureActionToBody(body, action, dt);
          const v = body.linvel();
          velocity.current.set(v.x, v.y, v.z);
          jumpsLeft.current = 0;
          grounded.current = false;
          jumpAirGrace.current = MOVEMENT.jumpAirGraceSec;
        } else if (action.kind === 'playerSetDown') {
          coopCarriedUntil.current = 0;
          coopHeldTargetReady.current = false;
          coopThrownRagdollActive.current = false;
          coopRagdollVisualActive.current = false;
          clearKnockVisualTumble(knockTumble.current);
          applyCoopAdventureActionToBody(body, action, dt);
          const v = body.linvel();
          velocity.current.set(v.x, v.y, v.z);
          jumpsLeft.current = MOVEMENT.maxJumps;
          jumpAirGrace.current = MOVEMENT.jumpAirGraceSec;
        } else if (action.kind === 'playerThrow') {
          coopCarriedUntil.current = 0;
          coopHeldTargetReady.current = false;
          coopThrownRagdollActive.current = true;
          coopThrowCollisionGraceUntil.current = nowSec + 0.18;
          coopThrowMinRagdollUntil.current = nowSec + 0.42;
          coopRagdollVisualActive.current = true;
          impulseKnockVisualTumble(knockTumble.current);
          applyCoopAdventureActionToBody(body, action, dt);
          const v = body.linvel();
          velocity.current.set(v.x, v.y, v.z);
          grounded.current = false;
          jumpsLeft.current = 1;
          jumpAirGrace.current = MOVEMENT.jumpAirGraceSec;
        }
      }
    } else {
      coopCarriedUntil.current = 0;
      coopThrownRagdollActive.current = false;
      coopHeldTargetReady.current = false;
      coopRagdollVisualActive.current = false;
    }

    if (networkTrainingMode) {
      for (const action of multiplayerStore.drainRemoteTrainingObjectActions()) {
        if (action.ownerId === multiplayerNow.selfId) continue;
        const target = getTrainingCubeById(action.objectId);
        if (!target) continue;
        if (heldTrainingCube.current?.id === action.objectId) {
          heldTrainingCube.current = null;
          trainingCubeSocketReady.current = false;
        }
        target.body.wakeUp();
        if (action.kind === 'hold') {
          setTrainingCubeHeldBy(action.objectId, action.ownerId);
          target.body.setBodyType(RAPIER_BODY_KINEMATIC, true);
          target.body.setGravityScale(0, true);
          target.body.setTranslation(action.position, true);
          target.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
          target.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        } else {
          setTrainingCubeHeldBy(action.objectId, null);
          target.body.setBodyType(RAPIER_BODY_DYNAMIC, true);
          target.body.setGravityScale(1, true);
          target.body.setTranslation(action.position, true);
          target.body.setLinvel(action.velocity, true);
          target.body.setAngvel(
            action.angularVelocity ?? { x: 0, y: 0, z: 0 },
            true,
          );
        }
      }
    }

    const pivot = writeCameraPivot(pos.x, pos.y, pos.z, dt, false);
    chestPos.current.set(pos.x, pos.y + BEAM.chestHeight, pos.z);
    lightGlowBodyPos.current.set(pos.x, pos.y + capCenterY, pos.z);
    if (lightGlowBodyReady.current) {
      punchLightGlowForBody(
        lastLightGlowBodyPos.current,
        lightGlowBodyPos.current,
        MOVEMENT.capsuleRadius * 1.35,
      );
    }
    lastLightGlowBodyPos.current.copy(lightGlowBodyPos.current);
    lightGlowBodyReady.current = true;
    const linvel = body.linvel();
    onPositionUpdate(pos, chestPos.current, {
      yaw: rot.yaw,
      pitch: inputManager.getAimPitch(),
      velocity: { x: linvel.x, y: linvel.y, z: linvel.z },
      isBeaming: gameStore.getState().isBeaming,
      isHoldingBall:
        holdingBall.current || gameStore.getState().ballHolderId === 'local',
      isSprinting: gameStore.getState().isSprinting,
      holdPosition:
        holdingBall.current || gameStore.getState().ballHolderId === 'local'
          ? {
              x: holdSocketSmoothed.current.x,
              y: holdSocketSmoothed.current.y,
              z: holdSocketSmoothed.current.z,
            }
          : null,
      coopRagdoll:
        networkCoopAdventureMode &&
        (nowSec < coopCarriedUntil.current || coopThrownRagdollActive.current),
      visualTilt: {
        x: inputManager.getAimPitch(),
        y: 0,
        z: 0,
      },
      flipActive: isForwardFlipActive('local'),
      danceActive: isDanceActive('local'),
    });

    const coopCarried = networkCoopAdventureMode && nowSec < coopCarriedUntil.current;
    const coopThrown = networkCoopAdventureMode && coopThrownRagdollActive.current;
    if (coopCarried || coopThrown) {
      stopGrindRailRide();
      if (grappleActive.current) stopGrapple(false);
      holdingBall.current = false;
      gameStore.setIsBeaming(false);
      setBeamAttractActive(false);
      coopCarryTargetId.current = null;
      coopWasBeamDown.current = false;
      coopCarryVisualStore.setHeldTarget(null);
      if (coopCarryProxyPlayer !== null) setCoopCarryProxyPlayer(null);
      setShiftWindActive(false);
      thrusterThrottle.current = smoothAsymmetric(
        thrusterThrottle.current,
        0,
        dt,
        18,
        22,
      );

      if (coopCarried && coopHeldTargetReady.current) {
        const current = body.translation();
        _posScratch.current.set(current.x, current.y, current.z);
        _posScratch.current.lerp(
          coopHeldTarget.current,
          1 - Math.exp(-dt * 28),
        );
        body.setTranslation(_posScratch.current, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        pos.copy(_posScratch.current);
        velocity.current.set(0, 0, 0);
      } else {
        const v = body.linvel();
        velocity.current.set(v.x, v.y + tune.gravity * dt * 1.15, v.z);
        const cloudBounce =
          coopCloudBounceCooldown.current <= 0
            ? sampleCoopAdventureCloudBounce(
                pos.x,
                playerFeetY(pos.y),
                pos.z,
                velocity.current.y,
                false,
              )
            : null;
        if (cloudBounce) {
          coopCloudBounceCooldown.current = 0.22;
          velocity.current.y = Math.max(velocity.current.y, cloudBounce.bounceVy);
          const liftedY = cloudBounce.liftOnly
            ? pos.y
            : Math.max(pos.y, cloudBounce.y + 0.08);
          body.setTranslation({ x: pos.x, y: liftedY, z: pos.z }, true);
          pos.y = liftedY;
          jumpsLeft.current = MOVEMENT.maxJumps;
          if (coopThrown) {
            coopThrownRagdollActive.current = false;
            coopRagdollVisualActive.current = false;
            coopCarriedUntil.current = 0;
            jumpAirGrace.current = MOVEMENT.jumpAirGraceSec;
            clearKnockVisualTumble(knockTumble.current);
          }
        }
        if (
          coopThrown &&
          jumpsLeft.current > 0 &&
          inputManager.wantsJump() &&
          inputManager.consumeJump()
        ) {
          playJump(0);
          velocity.current.y = Math.max(
            velocity.current.y,
            tuningStore.getJumpImpulse(0) * 0.9,
          );
          jumpsLeft.current = 0;
          grounded.current = false;
          jumpAirGrace.current = MOVEMENT.jumpAirGraceSec;
          coyoteTime.current = 0;
          const tr = body.translation();
          body.setTranslation(
            { x: tr.x, y: tr.y + MOVEMENT.jumpLiftY, z: tr.z },
            true,
          );
          pos.y = tr.y + MOVEMENT.jumpLiftY;
        }
        const thrownMove = inputManager.getMoveVector();
        if (Math.hypot(thrownMove.x, thrownMove.y) > 0.01) {
          cameraMoveTargetXZ(
            _moveVelXZ,
            forward,
            right,
            thrownMove,
            effectiveWalkSpeed * 0.95,
          );
          const steerAlpha = 1 - Math.exp(-dt * 3.1);
          velocity.current.x = THREE.MathUtils.lerp(
            velocity.current.x,
            _moveVelXZ.x,
            steerAlpha,
          );
          velocity.current.z = THREE.MathUtils.lerp(
            velocity.current.z,
            _moveVelXZ.z,
            steerAlpha,
          );
          clampHorizontalVelocity(velocity.current, effectiveSprintSpeed * 1.55);
        }
        body.setLinvel(velocity.current, true);
        const probe = probePlayerGround(
          world,
          pos.x,
          pos.y,
          pos.z,
          velocity.current.y,
          body,
          MOVEMENT.groundProbeDist,
          MOVEMENT.groundMaxVerticalSpeed,
        );
        if (
          nowSec >= coopThrowMinRagdollUntil.current &&
          probe.grounded &&
          Math.abs(velocity.current.y) < 10
        ) {
          coopThrownRagdollActive.current = false;
          coopRagdollVisualActive.current = false;
          jumpsLeft.current = MOVEMENT.maxJumps;
          jumpAirGrace.current = 0;
          grounded.current = true;
          clearKnockVisualTumble(knockTumble.current);
        }
      }

      const after = body.translation();
      pos.set(after.x, after.y, after.z);
      chestPos.current.set(pos.x, pos.y + BEAM.chestHeight, pos.z);
      tickKnockVisualTumble(knockTumble.current, dt);
      alignCharacterVisualUpright(
        body,
        visualPresentation,
        rot.yaw,
        knockTumble.current,
        inputManager.getAimPitch(),
      );
      syncScoopColliderTilt();
      const ragdollLv = body.linvel();
      onPositionUpdate(pos, chestPos.current, {
        yaw: rot.yaw,
        pitch: inputManager.getAimPitch(),
        velocity: { x: ragdollLv.x, y: ragdollLv.y, z: ragdollLv.z },
        isBeaming: false,
        isHoldingBall: false,
        isSprinting: false,
        holdPosition: null,
        coopRagdoll: true,
        visualTilt: {
          x: inputManager.getAimPitch(),
          y: knockTumble.current.rollZ,
          z: knockTumble.current.rollX,
        },
        flipActive: isForwardFlipActive('local'),
        danceActive: isDanceActive('local'),
      });
      const ragdollPivot = writeCameraPivot(pos.x, pos.y, pos.z, dt, false);
      updateThirdPersonCamera(
        camera,
        ragdollPivot,
        rot.yaw,
        inputManager.getAimPitch(),
        dt,
        false,
        0,
        world,
        body,
      );
      return;
    }

    const moveSpeed = Math.hypot(linvel.x, linvel.z);
    const goalEjectMoveLocked = isPlayerGoalEjectMoveLocked();
    const moveEarly = goalEjectMoveLocked
      ? { x: 0, y: 0 }
      : inputManager.getMoveVector();
    const sprintGlowTarget =
      !goalEjectMoveLocked &&
      inputManager.isSprint() &&
      energy.current > 0 &&
      ((moveEarly.x !== 0 || moveEarly.y !== 0) || !grounded.current)
        ? 1
        : 0;
    setShiftWindActive(
      !goalEjectMoveLocked && inputManager.isSprint() && energy.current > 0,
    );
    const speedFactor = speedCameraFactor(
      moveSpeed,
      effectiveWalkSpeed,
      effectiveSprintSpeed,
    );
    camSpeedExtra.current = smoothAsymmetric(
      camSpeedExtra.current,
      speedFactor *
        (tune.cameraSpeedPullbackEnabled ? CAMERA.speedDistanceMax : 0),
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
      world,
      body,
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
    syncScoopColliderTilt();
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

    const arenaMechanicsEnabled = !coopAdventureMode && !disableArenaBounds;
    const padFloorY = arenaMechanicsEnabled
      ? sampleTrampolineFloorY(pos.x, pos.z)
      : null;
    const feetY = playerFeetY(pos.y);
    const inTrampZone =
      arenaMechanicsEnabled && isPlayerInTrampolineZone(pos.x, pos.z, feetY);
    const overTrampDeck =
      inTrampZone ||
      (arenaMechanicsEnabled && isPlayerOverTrampolineDeck(pos.x, pos.z, feetY));
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
    const moveForAirControl = move;
    const sprintInput = !goalEjectMoveLocked && inputManager.isSprint();
    const canSprint = energy.current > 0;
    const sprinting =
      sprintInput &&
      canSprint &&
      (moveForAirControl.x !== 0 || moveForAirControl.y !== 0);
    let airFlying = false;
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
    const jumpRequested = inputManager.wantsJump();
    const jumpPressed =
      !goalEjectMoveLocked &&
      (grappleActive.current || jumpsLeft.current > 0) &&
      jumpRequested &&
      inputManager.consumeJump();
    let railConsumedJump = false;

    if (
      !goalEjectMoveLocked &&
      !grindRailActive.current &&
      !grappleActive.current &&
      !isPlayerKnockStunActive() &&
      !holdingBall.current &&
      !networkCoopAdventureMode &&
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
    if (grappleActive.current) {
      velocity.current.x = linvel.x;
      velocity.current.z = linvel.z;
    } else if (ePropelling) {
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

    const slideSpeed = Math.hypot(velocity.current.x, velocity.current.z);
    const groundSlideActive =
      grounded.current &&
      !goalEjectMoveLocked &&
      !grappleActive.current &&
      !grindRailActive.current &&
      move.y > 0.25 &&
      lookDir.y < -0.42 &&
      slideSpeed > walkSpeed * 0.45;
    if (groundSlideActive) {
      setGrindRailActive(false);
      const slideDrag = Math.exp(-7.4 * dt);
      velocity.current.x *= slideDrag;
      velocity.current.z *= slideDrag;
      if (groundSlideSparkTimer.current <= 0) {
        groundSlideSparkTimer.current = 0.045;
        const sparkY =
          padFloorY !== null && Math.abs(feetY - padFloorY) < 2
            ? padFloorY + 0.08
            : probe.groundY + 0.08;
        burstGroundSlideSparks(
          pos.x,
          sparkY,
          pos.z,
          velocity.current.x,
          velocity.current.z,
        );
      }
    }

    let railJumpVy: number | null = null;
    const railCenterY = pos.y + capCenterY;
    const railContactRange = grindRailActive.current
      ? GRIND_RAIL.activeHorizontalM
      : GRIND_RAIL.contactHorizontalM;
    const railContact = coopAdventureMode
      ? sampleCoopAdventureRailContact(
          pos.x,
          railCenterY,
          pos.z,
          railContactRange,
          GRIND_RAIL.contactVerticalM + 1.8,
        )
      : sampleGrindRailContact(
          pos.x,
          railCenterY,
          pos.z,
          railContactRange,
          GRIND_RAIL.contactVerticalM,
        );
    const horizontalSpeed = Math.hypot(linvel.x, linvel.z);

    if (grindRailActive.current) {
      jumpsLeft.current = MOVEMENT.maxJumps;
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
          const rideY = railContact.y + GRIND_RAIL.radius - capCenterY + 0.31 + wobbleLift;
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
      !groundSlideActive &&
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
      jumpsLeft.current = MOVEMENT.maxJumps;
      grindRailDir.current.set(tangentX, tangentZ);
      grindRailWobble.current = 0;
      grindRailSparkTimer.current = 0;
      grindRailSpeed.current = THREE.MathUtils.clamp(
        Math.max(horizontalSpeed * 3, walkSpeed * 3),
        walkSpeed * 3,
        sprintSpeed * GRIND_RAIL.maxSpeedSprintMul,
      );
      const rideY = railContact.y + GRIND_RAIL.radius - capCenterY + 0.31;
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
    airFlying =
      tune.airFlyModeEnabled &&
      sprintInput &&
      energy.current > 0 &&
      !goalEjectMoveLocked &&
      !grounded.current &&
      !grindRailActive.current &&
      !grappleActive.current &&
      !ePropelling &&
      !dashing;
    if (airFlying) {
      if (!airFlyDirReady.current && airFlyPulseTimer.current <= 0) {
        airFlyPulseTimer.current = MOVEMENT.airFlyPulseSec;
      }
      airFlyPulseTimer.current += dt;
      if (airFlyPulseTimer.current >= MOVEMENT.airFlyPulseSec) {
        airFlyPulseTimer.current %= MOVEMENT.airFlyPulseSec;
        _airFlyAimDir.copy(lookDir);
        _airFlyAimDir.y = THREE.MathUtils.clamp(
          _airFlyAimDir.y,
          MOVEMENT.airFlyMinAimY,
          1,
        );
        if (_airFlyAimDir.y < MOVEMENT.airFlyNeutralLiftY) {
          _airFlyAimDir.y = THREE.MathUtils.lerp(
            _airFlyAimDir.y,
            MOVEMENT.airFlyNeutralLiftY,
            0.35,
          );
        }
        if (_airFlyAimDir.lengthSq() < 0.001) {
          _airFlyAimDir.set(forward.x, MOVEMENT.airFlyNeutralLiftY, forward.z);
        }
        _airFlyAimDir.normalize();
        if (!airFlyDirReady.current) {
          airFlyDir.current.copy(_airFlyAimDir);
          airFlyDirReady.current = true;
        } else {
          airFlyDir.current.lerp(
            _airFlyAimDir,
            MOVEMENT.airFlyDirectionBlend,
          );
          airFlyDir.current.normalize();
        }
        velocity.current.x +=
          airFlyDir.current.x * MOVEMENT.airFlyImpulseSpeed;
        velocity.current.z +=
          airFlyDir.current.z * MOVEMENT.airFlyImpulseSpeed;
        vy +=
          airFlyDir.current.y * MOVEMENT.airFlyImpulseSpeed +
          MOVEMENT.airFlyLiftImpulse;
      }
      clampHorizontalVelocity(
        velocity.current,
        sprintSpeed * MOVEMENT.airFlyMaxHorizontalSpeedSprintMul,
      );
      vy = Math.min(
        vy,
        sprintSpeed * MOVEMENT.airFlyMaxHorizontalSpeedSprintMul * 0.55,
      );
    } else {
      airFlyPulseTimer.current = 0;
      airFlyDirReady.current = false;
    }

    const cloudBounce =
      coopAdventureMode && coopCloudBounceCooldown.current <= 0
        ? sampleCoopAdventureCloudBounce(
            pos.x,
            playerFeetY(pos.y),
            pos.z,
            vy,
            grindRailActive.current,
          )
        : null;
    if (cloudBounce && !grappleActive.current) {
      coopCloudBounceCooldown.current = 0.22;
      vy = Math.max(vy, cloudBounce.bounceVy);
      const liftedY = cloudBounce.liftOnly
        ? pos.y
        : Math.max(pos.y, cloudBounce.y + 0.08);
      body.setTranslation({ x: pos.x, y: liftedY, z: pos.z }, true);
      pos.y = liftedY;
      jumpsLeft.current = MOVEMENT.maxJumps;
      grounded.current = false;
      jumpAirGrace.current = MOVEMENT.jumpAirGraceSec;
      coyoteTime.current = 0;
    }

    if (!grindRailActive.current) {
      if (!grappleActive.current && !grounded.current && vy < -0.1) {
        fallAssistTimer.current += dt;
      } else {
        fallAssistTimer.current = 0;
      }
      const fallMult =
        fallAssistTimer.current >= MOVEMENT.fallAssistDelaySec
          ? MOVEMENT.fallAssistMult
          : 1;
      vy += tune.gravity * dt * fallMult;
    }

    velocity.current.y = vy;
    if (grappleActive.current) {
      const chestX = pos.x;
      const chestY = pos.y + BEAM.chestHeight;
      const chestZ = pos.z;

      grappleSwingPower.current = Math.max(
        MOVEMENT.grapplePendulumMinPower,
        grappleSwingPower.current *
          Math.exp(-MOVEMENT.grapplePendulumPowerDecay * dt),
      );
      const swingPower = grappleSwingPower.current;
      grappleSwingPhase.current +=
        MOVEMENT.grapplePendulumAngularSpeed *
        THREE.MathUtils.lerp(0.78, 1.08, swingPower) *
        dt;
      const phase = grappleSwingPhase.current;
      const swingSin = Math.sin(phase);
      const swingCos = Math.cos(phase);
      const swingRadius = grappleSwingRadius.current;
      _grapplePendulumTarget.set(
        grappleAnchor.current.x + grappleSwingAxis.current.x * swingSin * swingRadius,
        pos.y,
        grappleAnchor.current.z + grappleSwingAxis.current.z * swingSin * swingRadius,
      );
      _grapplePendulumVel.set(
        grappleSwingAxis.current.x *
          swingCos *
          swingRadius *
          MOVEMENT.grapplePendulumAngularSpeed *
          swingPower,
        0,
        grappleSwingAxis.current.z *
          swingCos *
          swingRadius *
          MOVEMENT.grapplePendulumAngularSpeed *
          swingPower,
      );
      _grapplePlanarDir.set(
        _grapplePendulumTarget.x - chestX,
        0,
        _grapplePendulumTarget.z - chestZ,
      );
      if (_grapplePlanarDir.lengthSq() > 0.001) {
        _grapplePlanarDir.normalize();
      }

      const grappleSpeed = sprintSpeed * MOVEMENT.grappleArcadeSpeedSprintMul;
      const grappleAlpha = 1 - Math.exp(-MOVEMENT.grappleArcadeAccel * dt);
      const targetVelX =
        _grapplePendulumVel.x +
        (_grapplePendulumTarget.x - chestX) * MOVEMENT.grapplePendulumFollow +
        (wishDir.lengthSq() > 0.001
          ? wishDir.x * grappleSpeed * MOVEMENT.grappleArcadeInputBlend
          : 0);
      const targetVelZ =
        _grapplePendulumVel.z +
        (_grapplePendulumTarget.z - chestZ) * MOVEMENT.grapplePendulumFollow +
        (wishDir.lengthSq() > 0.001
          ? wishDir.z * grappleSpeed * MOVEMENT.grappleArcadeInputBlend
          : 0);
      velocity.current.x = THREE.MathUtils.lerp(
        velocity.current.x,
        THREE.MathUtils.clamp(targetVelX, -grappleSpeed, grappleSpeed),
        grappleAlpha,
      );
      velocity.current.z = THREE.MathUtils.lerp(
        velocity.current.z,
        THREE.MathUtils.clamp(targetVelZ, -grappleSpeed, grappleSpeed),
        grappleAlpha,
      );

      _grappleConstraintDir.set(
        chestX - grappleAnchor.current.x,
        chestY - grappleAnchor.current.y,
        chestZ - grappleAnchor.current.z,
      );
      const ropeDist = _grappleConstraintDir.length();
      if (ropeDist > Math.max(0.1, grappleLength.current)) {
        _grappleConstraintDir.multiplyScalar(1 / ropeDist);
        const correctedChest = _grapplePendulumTarget
          .copy(grappleAnchor.current)
          .addScaledVector(_grappleConstraintDir, grappleLength.current);
        const correctedY = correctedChest.y - BEAM.chestHeight;
        body.setTranslation(
          { x: correctedChest.x, y: correctedY, z: correctedChest.z },
          true,
        );
        pos.set(correctedChest.x, correctedY, correctedChest.z);
        const radialVel =
          velocity.current.x * _grappleConstraintDir.x +
          velocity.current.y * _grappleConstraintDir.y +
          velocity.current.z * _grappleConstraintDir.z;
        if (radialVel > 0) {
          velocity.current.x -= _grappleConstraintDir.x * radialVel;
          velocity.current.y -= _grappleConstraintDir.y * radialVel;
          velocity.current.z -= _grappleConstraintDir.z * radialVel;
        }
      }
      grappleKickPending.current = false;
      grounded.current = false;
      jumpAirGrace.current = Math.max(jumpAirGrace.current, 0.06);
      clampHorizontalVelocity(
        velocity.current,
        sprintSpeed * MOVEMENT.grappleMaxHorizontalSpeedSprintMul,
      );
      vy = velocity.current.y;
    }
    const feetNow = playerFeetY(pos.y);
    const padLaunched =
      arenaMechanicsEnabled &&
      !grappleActive.current &&
      tryPlayerPads(
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
    } else if (!grappleActive.current && padFloorY !== null && !inTrampZone) {
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
      arenaMechanicsEnabled &&
      !grappleActive.current &&
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

    if (arenaMechanicsEnabled) {
      applyPlayerArenaWallBumper(
        body,
        pos,
        velocity.current,
        dt,
        () => stopGrapple(false),
        grappleActive.current,
      );
    }

    const ceilingMaxBodyY =
      ARENA.wallHeight -
      0.85 -
      capCenterY -
      capHalfH -
      MOVEMENT.capsuleRadius;
    if (arenaMechanicsEnabled && pos.y > ceilingMaxBodyY) {
      if (grappleActive.current) stopGrapple(false);
      body.setTranslation(
        { x: pos.x, y: ceilingMaxBodyY, z: pos.z },
        true,
      );
      pos.y = ceilingMaxBodyY;
      velocity.current.y = Math.min(velocity.current.y, -3);
    }

    body.setLinvel(
      { x: velocity.current.x, y: velocity.current.y, z: velocity.current.z },
      true,
    );

    draining.current = false;
    if (airFlying) {
      energy.current -= ENERGY.airFlyDrain * dt;
      draining.current = true;
    } else if (!grappleActive.current && sprinting && wishDir.lengthSq() > 0) {
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
    const remoteBallHeld =
      multiplayerNow.enabled &&
      multiplayerNow.remotePlayers.some((player) => player.isHoldingBall);
    const canBeamBall = ballHolder === null && !remoteBallHeld;

    if (networkCoopAdventureMode) {
      inputManager.consumeEPropel();
      coopActionSendTimer.current = Math.max(0, coopActionSendTimer.current - dt);
      const carryTarget =
        coopCarryTargetId.current !== null
          ? multiplayerNow.remotePlayers.find(
              (player) => player.id === coopCarryTargetId.current,
            ) ?? null
          : null;
      const target =
        carryTarget ?? findCoopAdventureTarget(
          multiplayerNow.remotePlayers,
          chestPos.current,
          lookDir,
        );
      const canCoopBeam =
        beamDown &&
        !knockStunned &&
        !frozen &&
        !grappleActive.current &&
        target !== null;
      const coopThrowPressed =
        coopCarryTargetId.current !== null && inputManager.consumeFireEdge();

      if (canCoopBeam && target) {
        const isNewCarryTarget = coopCarryTargetId.current !== target.id;
        coopCarryTargetId.current = target.id;
        coopCarryProxyDesired.current
          .copy(chestPos.current)
          .addScaledVector(lookDir, 2.45);
        coopCarryProxyDesired.current.y += 0.35;
        if (
          isNewCarryTarget ||
          coopCarryProxyPos.current.distanceTo(coopCarryProxyDesired.current) > 10
        ) {
          coopCarryProxyPos.current.copy(coopCarryProxyDesired.current);
        } else {
          coopCarryProxyPos.current.lerp(
            coopCarryProxyDesired.current,
            1 - Math.exp(-dt * 18),
          );
        }
        coopCarryProxyLookDir.current.copy(lookDir);
        coopCarryVisualStore.setHeldTarget(target.id);
        if (coopCarryProxyPlayer?.id !== target.id) {
          setCoopCarryProxyPlayer(target);
        }
        gameStore.setIsBeaming(true);
        setBeamAttractActive(false);
        if (coopActionSendTimer.current <= 0) {
          coopActionSendTimer.current = 1 / 60;
          multiplayerStore.sendCoopAction(
            makeCoopPullActionFromHold(
              target.id,
              coopCarryProxyPos.current,
              target.position,
            ),
          );
        }
      } else {
        coopCarryVisualStore.setHeldTarget(null);
        if (coopCarryProxyPlayer !== null) setCoopCarryProxyPlayer(null);
        gameStore.setIsBeaming(false);
        setBeamAttractActive(false);
        if (beamDown && !coopWasBeamDown.current && now - beamNoLockSoundAt.current > 0.45) {
          beamNoLockSoundAt.current = now;
          playBeamNoLock();
        }
      }

      if (coopThrowPressed && coopCarryTargetId.current) {
        const lv = body.linvel();
        multiplayerStore.sendCoopAction(
          makeCoopThrowAction(
            coopCarryTargetId.current,
            coopCarryProxyPos.current,
            lookDir,
            { x: lv.x, y: lv.y, z: lv.z },
            tune.coopThrowStrength,
          ),
        );
        coopCarryTargetId.current = null;
        coopCarryVisualStore.setHeldTarget(null);
        if (coopCarryProxyPlayer !== null) setCoopCarryProxyPlayer(null);
      } else if (!beamDown && coopWasBeamDown.current && coopCarryTargetId.current) {
        const lv = body.linvel();
        multiplayerStore.sendCoopAction(
          makeCoopSetDownAction(
            coopCarryTargetId.current,
            coopCarryProxyPos.current,
            { x: lv.x, y: lv.y, z: lv.z },
          ),
        );
        coopCarryTargetId.current = null;
        coopCarryVisualStore.setHeldTarget(null);
        if (coopCarryProxyPlayer !== null) setCoopCarryProxyPlayer(null);
      }
      if (!beamDown && !coopWasBeamDown.current) {
        coopCarryTargetId.current = null;
        coopCarryVisualStore.setHeldTarget(null);
        if (coopCarryProxyPlayer !== null) setCoopCarryProxyPlayer(null);
      }
      coopWasBeamDown.current = beamDown;
    } else {
      coopCarryTargetId.current = null;
      coopWasBeamDown.current = false;
      coopCarryVisualStore.setHeldTarget(null);
      if (coopCarryProxyPlayer !== null) setCoopCarryProxyPlayer(null);
    }

    if (
      tune.grapplingHookEnabled &&
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
      !networkCoopAdventureMode &&
      beamDown &&
      !beamNeedsRepress.current &&
      !knockStunned &&
      energy.current >= ENERGY.minBeam &&
      !frozen &&
      !grappleActive.current;
    const beamRequested = beamAttempt && !beamDenied;
    let canLockBeamTarget = false;
    let trainingCubeTarget:
      | { target: TrainingCubeTarget; distance: number; position: THREE.Vector3 }
      | null = null;
    let canLockTrainingCubeTarget = false;
    const trainingCubeBeamEnabled =
      disableArenaBounds && !networkCoopAdventureMode;

    if (
      beamRequested &&
      !holdingBall.current &&
      !heldTrainingCube.current &&
      ball &&
      ballLooseCooldown &&
      canBeamBall
    ) {
      const bt = ball.translation();
      const ballPos = _beamBallPos.current.set(bt.x, bt.y, bt.z);
      const { grabDist } = beamGrabDistance(ballPos, chestPos.current, pos);
      canLockBeamTarget = grabDist < BEAM.range;
    }

    if (
      beamRequested &&
      trainingCubeBeamEnabled &&
      !holdingBall.current &&
      !heldTrainingCube.current
    ) {
      trainingCubeTarget = getNearestTrainingCube(
        chestPos.current,
        BEAM.range,
        null,
        multiplayerNow.selfId,
      );
      canLockTrainingCubeTarget = trainingCubeTarget !== null;
    }

    const beamInput =
      beamRequested &&
      (holdingBall.current ||
        heldTrainingCube.current !== null ||
        canLockBeamTarget ||
        canLockTrainingCubeTarget);

    if (beamAttempt && !beamInput) {
      if (now - beamNoLockSoundAt.current > 0.45) {
        beamNoLockSoundAt.current = now;
        playBeamNoLock();
      }
    }

    if (beamInput && (holdingBall.current || heldTrainingCube.current)) {
      energy.current -= ENERGY.carryBeamDrain * dt;
      draining.current = true;
    } else if (beamInput && !holdingBall.current) {
      energy.current -= ENERGY.beamDrain * dt;
      draining.current = true;
    }

    const clearHoldState = () => {
      holdingBall.current = false;
      ballColliderDisabledUntil.current = Math.max(
        ballColliderDisabledUntil.current,
        now + BALL_PLAYER_COLLISION_REENABLE_DELAY_SEC,
      );
      ballReleaseLockUntil.current = Math.max(
        ballReleaseLockUntil.current,
        now + BALL.beamRegrabLockSec,
      );
      if (gameStore.getState().ballHolderId === 'local') {
        gameStore.clearBallHolder(true);
      }
      requestAnimationFrame(() => onBallHeldChange(false));
    };

    const clearTrainingCubeHold = () => {
      const cube = heldTrainingCube.current;
      if (!cube) return null;
      heldTrainingCube.current = null;
      trainingCubeSocketReady.current = false;
      setTrainingCubeHeldBy(cube.id, null);
      cube.body.setBodyType(RAPIER_BODY_DYNAMIC, true);
      cube.body.setGravityScale(1, true);
      return cube;
    };

    const sendTrainingObjectSync = (
      cube: TrainingCubeTarget,
      kind: 'hold' | 'release',
    ) => {
      if (!networkTrainingMode) return;
      const t = cube.body.translation();
      const v = cube.body.linvel();
      const av = cube.body.angvel();
      multiplayerStore.sendTrainingObjectAction({
        kind,
        objectId: cube.id,
        objectKind: cube.kind,
        position: { x: t.x, y: t.y, z: t.z },
        velocity: { x: v.x, y: v.y, z: v.z },
        angularVelocity: { x: av.x, y: av.y, z: av.z },
      });
    };

    const releaseTrainingCube = (speed: number) => {
      const cube = clearTrainingCubeHold();
      if (!cube) return false;
      const plv = body.linvel();
      if (speed >= TRAINING_CUBE_THROW_SPEED) {
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
        }
      } else {
        _launchVel.current.set(
          lookDir.x * speed + plv.x * 0.45,
          lookDir.y * speed + 2.5 + Math.max(0, plv.y * 0.2),
          lookDir.z * speed + plv.z * 0.45,
        );
      }
      cube.body.setTranslation(
        {
          x: trainingCubeSocket.current.x,
          y: trainingCubeSocket.current.y,
          z: trainingCubeSocket.current.z,
        },
        true,
      );
      applyBallLaunchImpulse(
        cube.body,
        _launchVel.current,
        averageMomentum(ballSwingSamples.current),
        lookDir,
      );
      cube.body.setAngvel(
        {
          x: (Math.random() - 0.5) * 7,
          y: (Math.random() - 0.5) * 9,
          z: (Math.random() - 0.5) * 7,
        },
        true,
      );
      sendTrainingObjectSync(cube, 'release');
      resetHoldMomentum();
      return true;
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
      if (heldTrainingCube.current) {
        const released = clearTrainingCubeHold();
        if (released) sendTrainingObjectSync(released, 'release');
        onBeamBreak();
        gameStore.setEnergyFlash(true);
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
    gameStore.setIsSprinting(sprinting || airFlying);
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

      energy.current = Math.max(
        0,
        energy.current * (1 - ENERGY.ballShotCostFraction),
      );
      draining.current = true;
      regenTimer.current = 0;
      resetHoldMomentum();
      armPostShotRocketBlock();
      return true;
    };

    const beamingLoose =
      beamInput &&
      !holdingBall.current &&
      !heldTrainingCube.current &&
      canLockBeamTarget &&
      canBeamBall &&
      !!ball &&
      !frozen;
    setBeamAttractActive(beamingLoose || (beamInput && canLockTrainingCubeTarget));

    if (
      ball &&
      beamInput &&
      ballLooseCooldown &&
      canBeamBall &&
      !holdingBall.current &&
      !heldTrainingCube.current &&
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

    if (
      beamInput &&
      trainingCubeBeamEnabled &&
      !holdingBall.current &&
      !heldTrainingCube.current &&
      trainingCubeTarget &&
      !frozen
    ) {
      const cube = trainingCubeTarget.target;
      cube.body.wakeUp();
      const cubePos = trainingCubeTarget.position;
      const toPlayer = _swingVelScratch.current.copy(chestPos.current).sub(cubePos);
      const dist = Math.max(0.001, toPlayer.length());
      toPlayer.multiplyScalar(1 / dist);
      const lv = cube.body.linvel();
      const nearT = 1 - THREE.MathUtils.clamp(dist / BEAM.range, 0, 1);
      const accel = BEAM.pullAccel * (0.85 + nearT * 1.45);
      cube.body.setLinvel(
        {
          x: lv.x + toPlayer.x * accel * dt,
          y: lv.y + toPlayer.y * accel * dt + BEAM.pullVerticalAssist * 0.35 * dt,
          z: lv.z + toPlayer.z * accel * dt,
        },
        true,
      );
      cube.body.wakeUp();

      const captureDist =
        BEAM.captureDistance + cube.radius * 0.5 + TRAINING_CUBE_CAPTURE_EXTRA_M;
      if (dist <= captureDist) {
        heldTrainingCube.current = cube;
        setTrainingCubeHeldBy(cube.id, multiplayerNow.selfId ?? 'local');
        cube.body.setBodyType(RAPIER_BODY_KINEMATIC, true);
        cube.body.setGravityScale(0, true);
        cube.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        cube.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        trainingCubeSocket.current.copy(cubePos);
        trainingCubeLastSocket.current.copy(cubePos);
        trainingCubeSocketReady.current = false;
        trainingCubeSyncTimer.current = 0;
        sendTrainingObjectSync(cube, 'hold');
      }
    }

    const holdingFire = inputManager.isFireDown();
    const ballHeld = gameStore.getState().ballHolderId === 'local';
    const cubeHeld = heldTrainingCube.current !== null;
    const canShootRockets = !ballHeld && !cubeHeld;
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
      if (cubeHeld) {
        launchedBallThisFrame = releaseTrainingCube(TRAINING_CUBE_THROW_SPEED);
        fireLaunchedBall.current = launchedBallThisFrame;
        fireHoldStart.current = null;
        if (launchedBallThisFrame) {
          playBallLaunch();
          firePressHandled.current = true;
          armPostShotRocketBlock();
        }
      } else if (ballHeld) {
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
      if (heldTrainingCube.current) {
        if (releaseTrainingCube(TRAINING_CUBE_THROW_SPEED)) {
          playBallLaunch();
          armPostShotRocketBlock();
        }
      } else if (launchHeldBall()) armPostShotRocketBlock();
    }

    if (heldTrainingCube.current && !beamInput && !launchedBallThisFrame) {
      releaseTrainingCube(TRAINING_CUBE_DROP_SPEED);
      if (inputManager.isFireDown()) {
        fireHoldStart.current = now;
        fireLaunchedBall.current = false;
        chargedRocketFired.current = false;
      }
    } else if (holdingBall.current && !beamInput && !launchedBallThisFrame) {
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
    } else if (heldTrainingCube.current && !knockStunned) {
      const cube = heldTrainingCube.current;
      const aim = _swingVelScratch.current.copy(lookDir);
      if (aim.lengthSq() < 1e-6) aim.copy(forward);
      if (aim.lengthSq() < 1e-6) aim.set(0, 0, -1);
      aim.normalize();

      const target = _holdSocket.current.copy(chestPos.current);
      target.addScaledVector(aim, BEAM.holdDistance + cube.radius * 0.35);
      target.y = Math.max(target.y, chestPos.current.y - 0.65);

      if (!trainingCubeSocketReady.current) {
        trainingCubeSocket.current.copy(target);
        trainingCubeLastSocket.current.copy(target);
        trainingCubeSocketReady.current = true;
      } else {
        trainingCubeSocket.current.lerp(
          target,
          1 - Math.exp(-TRAINING_CUBE_HOLD_SMOOTH * dt),
        );
      }

      cube.body.setTranslation(
        {
          x: trainingCubeSocket.current.x,
          y: trainingCubeSocket.current.y,
          z: trainingCubeSocket.current.z,
        },
        true,
      );
      cube.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      cube.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      trainingCubeLastSocket.current.copy(trainingCubeSocket.current);
      trainingCubeSyncTimer.current -= dt;
      if (trainingCubeSyncTimer.current <= 0) {
        trainingCubeSyncTimer.current = 1 / 24;
        sendTrainingObjectSync(cube, 'hold');
      }
    } else {
      holdSocketSmoothReady.current = false;
      trainingCubeSocketReady.current = false;
    }

    if (!coopAdventureMode && !disableArenaBounds) {
      const clamped = clampToHex(pos.x, pos.z, ARENA.hexRadius, 2.5);
      if (clamped.x !== pos.x || clamped.z !== pos.z) {
        body.setTranslation({ x: clamped.x, y: pos.y, z: clamped.z }, true);
      }
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
    <group position={[0, PLAYER_VISUAL_LIFT_Y, 0]} renderOrder={CHARACTER_MESH_RENDER_ORDER}>
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
      {loveToast && (
        <Html fullscreen>
          <div className="coop-love-toast">{loveToast}</div>
        </Html>
      )}
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
      <CoopHeldPlayerProxy
        player={coopCarryProxyPlayer}
        positionRef={coopCarryProxyPos}
        lookDirRef={coopCarryProxyLookDir}
      />
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
          const now = performance.now() / 1000;
          if (
            coopThrownRagdollActive.current &&
            now >= coopThrowCollisionGraceUntil.current &&
            now >= coopThrowMinRagdollUntil.current
          ) {
            coopThrownRagdollActive.current = false;
            coopCarriedUntil.current = 0;
            coopHeldTargetReady.current = false;
            coopRagdollVisualActive.current = false;
            jumpsLeft.current = MOVEMENT.maxJumps;
            jumpAirGrace.current = 0;
            grounded.current = true;
            clearKnockVisualTumble(knockTumble.current);
          }
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
          ref={capsuleColliderRef}
          args={[capHalfH, MOVEMENT.capsuleRadius]}
          position={[0, capCenterY, 0]}
          friction={0.65}
          collisionGroups={playerBodyCollisionGroups}
        />
        <CuboidCollider
          ref={lowerScoopColliderRef}
          args={PLAYER_LOWER_COLLIDER.halfExtents}
          position={[0, PLAYER_LOWER_COLLIDER.centerY, PLAYER_LOWER_COLLIDER.centerZ]}
          friction={0.55}
          collisionGroups={playerBallCollisionGroups}
        />
        <CuboidCollider
          ref={upperScoopColliderRef}
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
