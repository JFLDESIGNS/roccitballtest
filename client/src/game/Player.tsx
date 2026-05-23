import { useFrame, useThree } from '@react-three/fiber';
import {
  CapsuleCollider,
  interactionGroups,
  RigidBody,
  useAfterPhysicsStep,
  useRapier,
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
import { getCameraBasis, updateThirdPersonCamera } from './CameraController';
import { gameStore } from './gameStore';
import { PlayerAvatar } from './PlayerAvatar';
import {
  alignCharacterVisualUpright,
  createKnockVisualTumbleState,
  createVisualRecoveryState,
  forceCharacterUpright,
  impulseKnockVisualTumble,
  syncCharacterVisualPresentation,
  tickCharacterVisualRecovery,
  tickKnockVisualTumble,
} from './characterVisual';
import {
  CHARACTER_MESH_RENDER_ORDER,
  GroundJerseyDecal,
} from './JerseyDecal';
import { DroneThrusterFlames } from './DroneThrusterFlames';
import { VelocityPathRibbon } from './VelocityPathRibbon';
import { inputManager } from './InputManager';
import {
  playBallLaunch,
  playDash,
  playJump,
  playRocketFire,
  playRocketEmpty,
  setBeamAttractActive,
} from './audio';
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
  blendPlayerKnockStunMovement,
  tickPlayerKnockStun,
} from './rocketKnockStun';
import { tuningStore } from './tuningStore';
import { isBeamDenied, registerBeamDenyZone } from './beamDenyZones';
import { canCaptureWithContest, recordBeamPull } from './ballBeamContest';
import { createRocket } from './rocketSystem';
import { sampleTrampolineFloorY } from './arenaPadLayout';
import {
  applyPlayerStepUp,
  playerFeetY,
  probePlayerGround,
} from './playerGroundProbe';
import { tryPlayerPads, isPlayerOverTrampolineDeck } from './arenaPadPhysics';
import { getJerseyNumber } from './playerRoster';
import { PLAYER_RIM_PROBE_RADIUS } from './goalRingBounce';
import { tickGoalEntryCharacterBounce } from './goalNetBounce';
import { tryBallGoalScoreAtPoint } from './goalScoreHandler';

const PLAYER_LOOSE_COLLISION = interactionGroups(0, [0, 1, 2, 4]);
const PLAYER_CARRY_COLLISION = interactionGroups(0, [0, 2, 4]);

type PlayerProps = {
  ballBodyRef: React.RefObject<RapierRigidBody | null>;
  onRocketFired: (rocket: ReturnType<typeof createRocket>) => void;
  onBallHeldChange: (held: boolean) => void;
  onBeamBreak: () => void;
  onPositionUpdate: (pos: THREE.Vector3, chest: THREE.Vector3) => void;
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
  const bodyRef = useRef<RapierRigidBody>(null);
  const visualRef = useRef<THREE.Group>(null);
  const tiltRef = useRef<THREE.Group>(null);
  const bobRef = useRef<THREE.Group>(null);
  const pitchSmooth = useRef(0);
  const bobPhase = useRef(0);
  const visualRecovery = useRef(createVisualRecoveryState());
  const knockTumble = useRef(createKnockVisualTumbleState());
  const knockStunWasActive = useRef(false);
  const trailPos = useRef(new THREE.Vector3());
  const { camera } = useThree();
  const { world } = useRapier();
  const velocity = useRef(new THREE.Vector3());
  const grounded = useRef(true);
  const jumpsLeft = useRef(MOVEMENT.maxJumps);
  const jumpAirGrace = useRef(0);
  const coyoteTime = useRef(0);
  const _wishDir = useRef(new THREE.Vector3());
  /** One fire SFX per LMB press; edge attempt skips release retry */
  const firePressHandled = useRef(false);
  const dashCooldown = useRef(0);
  const dashActiveTimer = useRef(0);
  const goalNetCooldown = useRef(0);
  const goalRimCooldown = useRef(0);
  const _dashDir = useRef(new THREE.Vector3());
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
  const spawnApplied = useRef(false);
  const spawnInitialized = useRef(false);
  const chestPos = useRef(new THREE.Vector3());
  const _posScratch = useRef(new THREE.Vector3());
  const _beamBallPos = useRef(new THREE.Vector3());
  const pivotRef = useRef(new THREE.Vector3());
  const cameraSnapped = useRef(false);
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
  const holdSocketSmoothed = useRef(new THREE.Vector3());
  const holdSocketSmoothReady = useRef(false);
  const _rocketOrigin = useRef(new THREE.Vector3());
  const spawnPos = useMemo(() => {
    const team = gameStore.getState().localTeam;
    return getTeamSpawn(team);
  }, []);

  const applyTeamSpawn = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return false;
    body.setTranslation(
      { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
      true,
    );
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    inputManager.resetLookFromPosition(spawnPos.x, spawnPos.z);
    cameraSnapped.current = false;
    spawnApplied.current = true;
    return true;
  }, [spawnPos]);

  useEffect(() => {
    if (!onRocketBoostRef) return;
    onRocketBoostRef.current = () => {
      jumpsLeft.current = MOVEMENT.maxJumps;
    };
    return () => {
      onRocketBoostRef.current = null;
    };
  }, [onRocketBoostRef]);

  const interruptBeamOnHit = useCallback(() => {
    const now = performance.now() / 1000;
    const dur = ROCKET.beamDenyDurationSec;
    playerBeamDenyUntil.current = now + dur;
    ballReleaseLockUntil.current = Math.max(ballReleaseLockUntil.current, now + dur);
    setBeamAttractActive(false);

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
        gameStore.clearBallHolder();
      }
      gameStore.setBallState('loose');
      onBallHeldChange(false);
      onBeamBreak();
      if (ball && body) {
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
        tr.y + BEAM.chestHeight * 0.35,
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

  useFrame((_, dt) => {
    const body = bodyRef.current;
    if (!body) return;

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
    if (phase !== 'playing' && phase !== 'countdown') return;
    if (tuningStore.getState().showMenu) return;

    const tune = tuningStore.getState();

    const knockTick = tickPlayerKnockStun(body);
    const rotEarly = inputManager.getRotation();
    const visualPresentation = {
      visual: visualRef.current,
      tilt: tiltRef.current,
      bob: bobRef.current,
      pitchSmooth,
      bobPhase,
    };
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
      const move = inputManager.getMoveVector();
      const wishDir = _wishDir.current
        .set(0, 0, 0)
        .addScaledVector(forward, move.y)
        .addScaledVector(right, -move.x);

      const linvel = body.linvel();
      const feetY = playerFeetY(pos.y);
      const groundedStun =
        feetY <= MOVEMENT.groundProbeDist + 0.35 && Math.abs(linvel.y) < 8;

      blendPlayerKnockStunMovement(body, velocity.current, {
        wishX: wishDir.x,
        wishZ: wishDir.z,
        walkSpeed: tune.walkSpeed,
        grounded: groundedStun,
        dt,
      });

      const lv = body.linvel();
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
      onPositionUpdate(pos, chestPos.current);
      updateThirdPersonCamera(
        camera,
        pivotRef.current,
        rot.yaw,
        inputManager.getAimPitch(),
        dt,
        false,
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
    dashActiveTimer.current = Math.max(0, dashActiveTimer.current - dt);
    goalNetCooldown.current = Math.max(0, goalNetCooldown.current - dt);
    goalRimCooldown.current = Math.max(0, goalRimCooldown.current - dt);
    const t = body.translation();
    const pos = _posScratch.current.set(t.x, t.y, t.z);
    const rot = inputManager.getRotation();
    const lookDir = inputManager.getLookDirection();
    const { forward, right } = getCameraBasis(rot.yaw);

    pivotRef.current.set(pos.x, pos.y + CAMERA.pivotHeight, pos.z);
    chestPos.current.set(pos.x, pos.y + BEAM.chestHeight, pos.z);
    onPositionUpdate(pos, chestPos.current);

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
    );

    const linvel = body.linvel();
    const aimPitch = inputManager.getAimPitch();
    const moveSpeed = Math.hypot(linvel.x, linvel.z);

    if (
      !tickCharacterVisualRecovery(
        body,
        visualRecovery.current,
        visualPresentation,
        rot.yaw,
        aimPitch,
        moveSpeed,
        dt,
      )
    ) {
      syncCharacterVisualPresentation(
        body,
        visualPresentation,
        rot.yaw,
        aimPitch,
        moveSpeed,
        dt,
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
    const overTrampDeck = isPlayerOverTrampolineDeck(pos.x, pos.z, feetY);
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

    const move = inputManager.getMoveVector();
    const sprintInput = inputManager.isSprint();
    const canSprint = energy.current > 0;
    const sprinting =
      sprintInput && canSprint && (move.x !== 0 || move.y !== 0);
    const speed = sprinting ? tune.sprintSpeed : tune.walkSpeed;
    const accel = grounded.current ? MOVEMENT.groundAccel : MOVEMENT.groundAccel * 0.65;

    const wishDir = _wishDir.current
      .set(0, 0, 0)
      .addScaledVector(forward, move.y)
      .addScaledVector(right, -move.x);
    if (wishDir.lengthSq() > 0) {
      wishDir.normalize();
      lastWishDir.current.copy(wishDir);
    }

    const dashing = dashActiveTimer.current > 0;
    if (dashing) {
      const dashSpd = MOVEMENT.dashForwardSpeed;
      velocity.current.x = _dashDir.current.x * dashSpd;
      velocity.current.z = _dashDir.current.z * dashSpd;
    } else {
      const control = grounded.current ? 1 : MOVEMENT.airControl;
      const targetVelX = wishDir.x * speed * control;
      const targetVelZ = wishDir.z * speed * control;
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

    let vy = linvel.y;

    if (
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

    if (jumpsLeft.current > 0 && inputManager.consumeJump()) {
      const jumpIndex = MOVEMENT.maxJumps - jumpsLeft.current;
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
    vy += tune.gravity * dt;

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
    } else if (padFloorY !== null && !overTrampDeck) {
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
        pos.y + BEAM.chestHeight * 0.35,
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

    const beamInput =
      inputManager.isBeam() &&
      !beamNeedsRepress.current &&
      energy.current >= ENERGY.minBeam &&
      !beamDenied &&
      !gameStore.getState().ballFrozen;
    if (beamInput && !holdingBall.current) {
      energy.current -= ENERGY.beamDrain * dt;
      draining.current = true;
    }

    if (holdingBall.current && ENERGY.holdBallDrain > 0) {
      energy.current -= ENERGY.holdBallDrain * dt;
      draining.current = true;
    }

    const clearHoldState = () => {
      holdingBall.current = false;
      if (gameStore.getState().ballHolderId === 'local') {
        gameStore.clearBallHolder();
      }
      requestAnimationFrame(() => onBallHeldChange(false));
    };

    if (energy.current <= 0) {
      energy.current = 0;
      if (holdingBall.current) {
        clearHoldState();
        onBeamBreak();
        gameStore.setEnergyFlash(true);
        if (ballBodyRef.current) releaseBallPhysics(ballBodyRef.current);
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

    const ballLooseCooldown = now >= ballReleaseLockUntil.current;
    const ball = ballBodyRef.current;

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
      releaseBallPhysics(ball);
      computeBallLaunchSpawn(
        chestPos.current,
        lookDir,
        velocity,
        _holdSocket.current,
      );
      ball.setTranslation(
        {
          x: _holdSocket.current.x,
          y: _holdSocket.current.y,
          z: _holdSocket.current.z,
        },
        true,
      );
      applyBallLaunchImpulse(ball, velocity, swingVel);
      gameStore.setBallState(ballState);
      if (ballState === 'launched') {
        ballSeparationGraceUntil.current =
          now + BALL.postLaunchSeparationGraceSec;
      }
    };

    const dropHeldBall = () => {
      if (!holdingBall.current) return;
      clearHoldState();
      ballReleaseLockUntil.current = now + BALL.beamRegrabLockSec;

      if (ball) {
        const plv = body.linvel();
        const release = computeBeamReleaseVelocity(
          {
            lookDir,
            playerCarry: averageMomentum(launchMomentumSamples.current),
            ballSwing: averageMomentum(ballSwingSamples.current),
            playerVel: new THREE.Vector3(plv.x, plv.y, plv.z),
            tune,
          },
          _launchVel.current,
        );
        releaseBallWithVelocity(
          release.velocity,
          release.active ? 'launched' : 'loose',
        );
        if (release.active) playBallLaunch();
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
      return true;
    };

    const ballHolder = gameStore.getState().ballHolderId;
    const canBeamBall = ballHolder === null;

    const beamingLoose =
      beamInput &&
      !holdingBall.current &&
      canBeamBall &&
      !!ball &&
      !gameStore.getState().ballFrozen;
    setBeamAttractActive(beamingLoose);

    if (
      ball &&
      beamInput &&
      ballLooseCooldown &&
      canBeamBall &&
      !holdingBall.current &&
      !gameStore.getState().ballFrozen
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
      if (canFireRocket && !canFireRocket()) {
        if (!firePressHandled.current) {
          playRocketEmpty();
          firePressHandled.current = true;
        }
        return false;
      }
      if (lookDir.lengthSq() < 1e-6) return false;

      _rocketOrigin.current
        .copy(chestPos.current)
        .addScaledVector(lookDir, ROCKET.rocketSpawnAhead);
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
      onRocketFired(rocket);
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
      launchHeldBall();
    }

    if (holdingBall.current && !beamInput && !launchedBallThisFrame) {
      dropHeldBall();
      if (inputManager.isFireDown()) {
        fireHoldStart.current = now;
        fireLaunchedBall.current = false;
        chargedRocketFired.current = false;
      }
    } else if (holdingBall.current && ball) {
      const plv = body.linvel();
      tickMomentumSamples(
        launchMomentumSamples.current,
        launchMomentumTimer,
        dt,
        new THREE.Vector3(plv.x, plv.y, plv.z),
      );

      holdSocketSmoothReady.current = smoothHoldSocketTarget(
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

  return (
    <>
      <VelocityPathRibbon
        opacity={0.26}
        maxPoints={12}
        minStep={0.28}
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
        position={[spawnPos.x, spawnPos.y, spawnPos.z]}
        colliders={false}
        mass={12}
        lockRotations
        linearDamping={0.5}
        enabledRotations={[false, false, false]}
        gravityScale={0}
        ccd
        userData={{ character: true, hitTarget: true, actorId: 'local' as const }}
      >
        <CapsuleCollider
          args={[capHalfH, MOVEMENT.capsuleRadius]}
          position={[0, capCenterY, 0]}
          friction={0.55}
          collisionGroups={PLAYER_LOOSE_COLLISION}
        />
        <group ref={visualRef} position={[0, capCenterY, 0]}>
          <group ref={tiltRef}>
            <group ref={bobRef}>
              <group renderOrder={CHARACTER_MESH_RENDER_ORDER}>
                <PlayerAvatar rotationY={0} team={localTeam} />
                <DroneThrusterFlames team={localTeam} />
              </group>
            </group>
          </group>
        </group>
      </RigidBody>
      <GroundJerseyDecal
        bodyRef={bodyRef}
        jerseyNumber={getJerseyNumber('local')}
        fillColor="#b8f4ff"
      />
    </>
  );
}
