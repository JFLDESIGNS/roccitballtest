import { useFrame, useThree } from '@react-three/fiber';
import {
  CapsuleCollider,
  interactionGroups,
  RigidBody,
  useAfterPhysicsStep,
  useRapier,
  type RapierRigidBody,
} from '@react-three/rapier';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  ARENA,
  BALL,
  BEAM,
  CAMERA,
  ENERGY,
  MOVEMENT,
  ROCKET,
  TEAM_SPAWN,
} from '../shared/Constants';
import {
  captureBallSocket,
  getBallSocketPosition,
  releaseBallPhysics,
  smoothHoldSocketTarget,
  updateBallSocketSmooth,
} from './ballAttach';
import {
  applyBeamAttraction,
  beamGrabDistance,
  canPlayerContactCapture,
} from './beamPhysics';
import { separateBallFromPlayer } from './ballPlayerSeparation';
import { applyBallLaunchImpulse } from './ballPhysics';
import { clampToHex } from './arenaHex';
import { getCameraBasis, updateThirdPersonCamera } from './CameraController';
import { gameStore } from './gameStore';
import { inputManager } from './InputManager';
import { playBallLaunch, playJump, setBeamAttractActive } from './audio';
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
import { tuningStore } from './tuningStore';
import { isBeamDenied, registerBeamDenyZone } from './beamDenyZones';
import { canCaptureWithContest, recordBeamPull } from './ballBeamContest';
import { createRocket } from './rocketSystem';
import { applyPlayerStepUp, probePlayerGround } from './playerGroundProbe';

type PlayerProps = {
  ballBodyRef: React.RefObject<RapierRigidBody | null>;
  onRocketFired: (rocket: ReturnType<typeof createRocket>) => void;
  onBallHeldChange: (held: boolean) => void;
  onBeamBreak: () => void;
  onPositionUpdate: (pos: THREE.Vector3, chest: THREE.Vector3) => void;
  onPlayerBodyReady: (body: RapierRigidBody) => void;
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
}: PlayerProps) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const visualRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const { world } = useRapier();
  const velocity = useRef(new THREE.Vector3());
  const grounded = useRef(true);
  const jumpsLeft = useRef(MOVEMENT.maxJumps);
  const jumpAirGrace = useRef(0);
  const rocketKnockGrace = useRef(0);
  const coyoteTime = useRef(0);
  const _wishDir = useRef(new THREE.Vector3());
  const rocketCooldown = useRef(0);
  const energy = useRef<number>(ENERGY.max);
  const regenTimer = useRef(0);
  const draining = useRef(false);
  const holdingBall = useRef(false);
  const ballReleaseLockUntil = useRef(0);
  const ballSeparationGraceUntil = useRef(0);
  /** After LMB ball shot, beam stays off until RMB is released and pressed again */
  const beamNeedsRepress = useRef(false);
  const team = gameStore.getState().localTeam;
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
  useEffect(() => {
    const spawn = TEAM_SPAWN[team];
    bodyRef.current?.setTranslation({ x: spawn.x, y: spawn.y, z: spawn.z }, true);
    inputManager.resetLookForTeam(team);
    cameraSnapped.current = false;
  }, [team]);

  useEffect(() => {
    if (!onRocketBoostRef) return;
    onRocketBoostRef.current = () => {
      jumpsLeft.current = MOVEMENT.maxJumps;
      rocketKnockGrace.current = MOVEMENT.rocketKnockGraceSec;
    };
    return () => {
      onRocketBoostRef.current = null;
    };
  }, [onRocketBoostRef]);

  useEffect(() => {
    if (bodyRef.current) onPlayerBodyReady(bodyRef.current);
  }, [onPlayerBodyReady]);

  const lastWishDir = useRef(new THREE.Vector3());

  useAfterPhysicsStep(() => {
    const body = bodyRef.current;
    const ball = ballBodyRef.current;
    if (!body) return;
    if (gameStore.getState().ballFrozen || gameStore.getState().phase !== 'playing') {
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

    if (!ball || holdingBall.current) return;
    const now = performance.now() / 1000;
    if (now < ballSeparationGraceUntil.current) return;
    separateBallFromPlayer(body, ball, 0.35, true);
  });

  useFrame((_, dt) => {
    const body = bodyRef.current;
    if (!body) return;
    const phase = gameStore.getState().phase;
    if (phase !== 'playing' && phase !== 'countdown') return;
    if (tuningStore.getState().showMenu) return;

    const tune = tuningStore.getState();
    const localTeam = gameStore.getState().localTeam;
    rocketCooldown.current = Math.max(0, rocketCooldown.current - dt);
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
      world,
      body,
    );

    if (visualRef.current) {
      visualRef.current.rotation.y = rot.yaw;
    }

    const linvel = body.linvel();
    const holdingNow =
      holdingBall.current || gameStore.getState().ballHolderId === 'local';

    jumpAirGrace.current = Math.max(0, jumpAirGrace.current - dt);
    rocketKnockGrace.current = Math.max(0, rocketKnockGrace.current - dt);

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

    if (jumpAirGrace.current > 0) {
      grounded.current = false;
    } else {
      grounded.current = probe.grounded;
    }

    const risingFromJump =
      rocketKnockGrace.current <= 0 &&
      (jumpAirGrace.current > 0 || linvel.y > 2.8);
    if (grounded.current && !risingFromJump) {
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

    let vy = linvel.y;
    const hasAirJump = jumpsLeft.current < MOVEMENT.maxJumps;
    const canJump =
      jumpsLeft.current > 0 &&
      (hasAirJump || grounded.current || coyoteTime.current > 0);
    if (canJump && inputManager.consumeJump()) {
      const doubleJump = jumpsLeft.current < MOVEMENT.maxJumps;
      playJump(doubleJump);
      vy =
        jumpsLeft.current === MOVEMENT.maxJumps
          ? tune.jumpForce
          : tuningStore.getDoubleJumpForce();
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

    body.setLinvel(
      { x: velocity.current.x, y: velocity.current.y, z: velocity.current.z },
      true,
    );

    draining.current = false;
    if (sprinting && wishDir.lengthSq() > 0) {
      energy.current -= ENERGY.sprintDrain * dt;
      draining.current = true;
    }

    const beamDenied =
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

    if (energy.current <= 0) {
      energy.current = 0;
      if (holdingBall.current) {
        holdingBall.current = false;
        onBallHeldChange(false);
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

    const now = performance.now() / 1000;
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
      holdingBall.current = false;
      onBallHeldChange(false);
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
      holdingBall.current = false;
      onBallHeldChange(false);
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
    const canBeamBall =
      ballHolder === null || ballHolder === 'local';

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
          holdingBall.current = true;
          onBallHeldChange(true);
          const lv0 = body.linvel();
          resetMomentumSamples(
            launchMomentumSamples.current,
            launchMomentumTimer,
            new THREE.Vector3(lv0.x, lv0.y, lv0.z),
          );
          resetMomentumSamples(ballSwingSamples.current, ballSwingTimer);
          const socket = getBallSocketPosition(
            chestPos.current,
            lookDir,
            BEAM.holdDistance,
            BALL.radius,
            _holdSocket.current,
          );
          lastHoldSocketPos.current.copy(ballPos);
          holdSocketReady.current = false;
          holdLatchT.current = 0;
          holdSocketSmoothed.current.copy(socket);
          holdSocketSmoothReady.current = true;
          captureBallSocket(ball, holdSocketSmoothed.current, ballPos);
        } else if (pull.applied || chestDist <= BEAM.contactCaptureDistance) {
          gameStore.setBallState('pulled');
        }
      }
    }

    if (holdingBall.current && !beamInput) {
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
      );
    } else {
      holdSocketSmoothReady.current = false;
    }

    const fireRocket = (explosive: boolean) => {
      if (rocketCooldown.current > 0) return;
      rocketCooldown.current = ROCKET.cooldown;
      _rocketOrigin.current
        .copy(chestPos.current)
        .addScaledVector(lookDir, 1.2);
      const lv = body.linvel();
      onRocketFired(
        createRocket(
          {
            x: _rocketOrigin.current.x,
            y: _rocketOrigin.current.y,
            z: _rocketOrigin.current.z,
          },
          { x: lookDir.x, y: lookDir.y, z: lookDir.z },
          'local',
          { x: lv.x, y: lv.y, z: lv.z },
          explosive,
        ),
      );
    };

    const holdingFire = inputManager.isFireDown();
    const ballHeld = gameStore.getState().ballHolderId === 'local';
    const canShootRockets = !ballHeld;

    if (inputManager.consumeFireEdge()) {
      chargedRocketFired.current = false;
      if (ballHeld) {
        fireLaunchedBall.current = launchHeldBall();
        fireHoldStart.current = null;
      } else {
        fireLaunchedBall.current = false;
        fireHoldStart.current = now;
        if (!inputManager.isFireDown()) {
          fireRocket(true);
          fireHoldStart.current = null;
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
        fireRocket(false);
        chargedRocketFired.current = true;
      }
    }

    if (inputManager.consumeFireRelease()) {
      const holdDur =
        fireHoldStart.current !== null ? now - fireHoldStart.current : 0;
      fireHoldStart.current = null;
      if (
        canShootRockets &&
        !fireLaunchedBall.current &&
        !chargedRocketFired.current &&
        holdDur < ROCKET.chargedHoldSec
      ) {
        fireRocket(true);
      }
      fireLaunchedBall.current = false;
      chargedRocketFired.current = false;
    }

    if (inputManager.consumeThrow()) {
      launchHeldBall();
    }

    const clamped = clampToHex(pos.x, pos.z, ARENA.hexRadius, 2.5);
    if (clamped.x !== pos.x || clamped.z !== pos.z) {
      body.setTranslation({ x: clamped.x, y: pos.y, z: clamped.z }, true);
    }
  });

  const bodyColor = team === 'blue' ? '#55bbee' : '#ee8844';
  const capHalfH = MOVEMENT.capsuleHeight / 2 - MOVEMENT.capsuleRadius;
  const capCenterY = capHalfH + MOVEMENT.capsuleRadius;

  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      mass={12}
      lockRotations
      linearDamping={0.5}
      enabledRotations={[false, false, false]}
      gravityScale={0}
      ccd
      userData={{ character: true, hitTarget: false }}
    >
      <CapsuleCollider
        args={[capHalfH, MOVEMENT.capsuleRadius]}
        position={[0, capCenterY, 0]}
        friction={0.55}
        collisionGroups={interactionGroups(0, [0, 1, 2])}
      />
      <group ref={visualRef} position={[0, capCenterY, 0]}>
        <mesh>
          <capsuleGeometry args={[MOVEMENT.capsuleRadius, capHalfH * 2, 6, 12]} />
          <meshStandardMaterial color={bodyColor} metalness={0.35} roughness={0.55} />
        </mesh>
      </group>
    </RigidBody>
  );
}
