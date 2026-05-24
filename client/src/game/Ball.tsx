import { useFrame } from '@react-three/fiber';
import {
  BallCollider,
  interactionGroups,
  RigidBody,
  useAfterPhysicsStep,
  type RapierRigidBody,
} from '@react-three/rapier';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { CollisionEnterPayload } from '@react-three/rapier';
import * as THREE from 'three';
import { BALL, BALL_SPAWN, RENDER, SUPERBALL } from '../shared/Constants';
import { getBallDropLayout } from './arenaLayout';
import { parkBallAtDropSpawn } from './ballDropSpawn';
import { releaseBallPhysics } from './ballAttach';
import { createBallPolkaTexture } from './ballPolkaTexture';
import { decayBeamContest, getBeamBallGlow, resetBeamContest } from './ballBeamContest';
import { stepBallPhysics } from './ballRuntime';
import {
  refreshFanGlassBoxes,
  triggerFanGlassHit,
  trySegmentHitsFanGlass,
} from './fanGlassHit';
import {
  armBallDropCollisionGrace,
  applyBallSpinBounce,
  setBallHeldCollider,
  syncBallLooseCollision,
  type PendingSpinBounce,
} from './ballPhysics';
import { playBallBounce, shouldSuppressBallBounceSound, suppressBallBounceForMs } from './audio';
import { announceBallStrike } from './announcements';
import { registerLocalBallComboHit } from './ballCombo';
import { applyBallStrikeKnock } from './characterKnock';
import { BallMotionRibbons } from './BallMotionRibbons';
import { LooseBallVisual } from './LooseBallVisual';
import { PhysicsBallWireframe } from './PhysicsBallWireframe';
import type { ActorId } from './playerRoster';
import { tryBallGoalScore, tryBallGoalScoreAtPoint } from './goalScoreHandler';
import {
  isGoalBallSuckActive,
  getGoalBallSuckVisualAlpha,
  tickGoalBallSuck,
} from './ballGoalSuck';
import {
  advanceHeldBallReleaseBlend,
  heldBallVisualBridge,
} from './heldBallVisualBridge';
import { gameStore, type BallHolderId } from './gameStore';
import { tuningStore } from './tuningStore';
import type { Team } from '../shared/Types';

function holderGlowTeam(holderId: BallHolderId, localTeam: Team): Team | null {
  if (!holderId) return null;
  if (holderId === 'local') return localTeam;
  if (holderId === 'bot-2') return localTeam;
  return localTeam === 'red' ? 'blue' : 'red';
}

export type BallHandle = {
  reset: () => void;
  spawn: () => void;
  parkAtDrop: () => void;
  getBody: () => RapierRigidBody | null;
};

type BallProps = {
  onBotBallStrike?: (actorId: ActorId) => void;
};

export const Ball = forwardRef<BallHandle, BallProps>(function Ball(
  { onBotBallStrike },
  ref,
) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const ballMeshRef = useRef<THREE.Mesh>(null);
  const ballMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const looseVisualRef = useRef<THREE.Mesh>(null);
  const looseVisualMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const physicsWireRef = useRef<THREE.Mesh>(null);
  const showPhysicsBall = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().showPhysicsBall,
  );
  const isHeld = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().ballHolderId !== null,
  );
  const isLocalHeld = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().ballHolderId === 'local',
  );
  const hideTrail = useSyncExternalStore(
    gameStore.subscribe,
    () => {
      const s = gameStore.getState();
      return (s.phase === 'playing' && s.countdown > 0) || s.ballFrozen;
    },
  );
  const ballType = useSyncExternalStore(
    tuningStore.subscribe,
    () => tuningStore.getState().ballType,
  );
  const isSuperball = ballType === 'superball';
  const wasHeldRef = useRef(false);
  const lastBounceAt = useRef(0);
  const lastBodyHitAt = useRef(0);
  const pendingSpinBounceRef = useRef<PendingSpinBounce | null>(null);
  const glowTick = useRef(0);
  const lastHolderId = useRef<BallHolderId>(null);
  const prevBallPos = useRef(new THREE.Vector3());
const _ballTo = useRef(new THREE.Vector3());
const hasPrevBallPos = useRef(false);

  const surfaceMap = useMemo(
    () => createBallPolkaTexture(RENDER.ballPolkaTextureSize, 'original'),
    [],
  );

  useEffect(() => () => surfaceMap.dispose(), [surfaceMap]);

  const onBallCollisionEnter = useCallback((payload: CollisionEnterPayload) => {
    if (gameStore.getState().ballHolderId) return;
    const now = performance.now();
    if (now - lastBounceAt.current < 80) return;

    const body = bodyRef.current;
    if (!body) return;

    const v = body.linvel();
    let impact = Math.hypot(v.x, v.y, v.z);
    const n = payload.manifold.normal();
    impact = Math.abs(v.x * n.x + v.y * n.y + v.z * n.z);

    const otherObj = payload.other.rigidBodyObject as
      | { userData?: { hitTarget?: boolean; actorId?: ActorId } }
      | undefined;
    const actorId = otherObj?.userData?.actorId;
    if (otherObj?.userData?.hitTarget || actorId) {
      if (impact < 1.8) return;
      if (now - lastBodyHitAt.current < 140) return;
      lastBodyHitAt.current = now;

      const otherBody = payload.other.rigidBody;
      if (otherBody) {
        const t = body.translation();
        const v = body.linvel();
        applyBallStrikeKnock(
          otherBody,
          t.x,
          t.y,
          t.z,
          v.x,
          v.y,
          v.z,
          impact,
        );
      }

      if (actorId) {
        const t = body.translation();
        const v = body.linvel();
        const approach = Math.abs(v.x * n.x + v.y * n.y + v.z * n.z);
        if (approach >= 1.5) {
          if (actorId === 'local') {
            registerLocalBallComboHit(t.y, v.y, approach);
          }
          announceBallStrike(actorId, t.y, v.y, approach);
        }
        if (actorId.startsWith('bot-')) {
          onBotBallStrike?.(actorId);
        }
      }
      return;
    }

    if (impact < 1.2) return;
    const pending = pendingSpinBounceRef.current;
    if (!pending || impact > pending.impact) {
      pendingSpinBounceRef.current = { nx: n.x, ny: n.y, nz: n.z, impact };
    }
    if (shouldSuppressBallBounceSound()) return;
    lastBounceAt.current = now;
    const impactSpd = impact;
    requestAnimationFrame(() => playBallBounce(impactSpd));
  }, []);

  const placeAtDrop = (release: boolean) => {
    const body = bodyRef.current;
    if (!body) return;
    if (release) releaseBallPhysics(body);
    if (release) {
      const { releaseY } = getBallDropLayout();
      body.setTranslation({ x: BALL_SPAWN.x, y: releaseY, z: BALL_SPAWN.z }, true);
      body.setLinvel({ x: 0, y: -5.5, z: 0 }, true);
      armBallDropCollisionGrace(3);
      syncBallLooseCollision(body);
    } else {
      parkBallAtDropSpawn(body);
    }
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    gameStore.setBallState('loose');
    gameStore.setIsHoldingBall(false);
    gameStore.clearBallHolder();
    resetBeamContest();
  };

  const dropFromVortex = () => placeAtDrop(true);
  const parkAtDrop = () => {
    suppressBallBounceForMs(2500);
    placeAtDrop(false);
  };

  useImperativeHandle(ref, () => ({
    reset: dropFromVortex,
    spawn: dropFromVortex,
    parkAtDrop,
    getBody: () => bodyRef.current,
  }));

  useAfterPhysicsStep(() => {
    const body = bodyRef.current;
    if (!body) return;
    if (isGoalBallSuckActive()) return;
    if (gameStore.getState().ballFrozen) {
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    const t = body.translation();
    if (gameStore.getState().ballHolderId) {
      tryBallGoalScoreAtPoint({ x: t.x, y: t.y, z: t.z }, body);
      prevBallPos.current.set(t.x, t.y, t.z);
      hasPrevBallPos.current = true;
      return;
    }

    const spinBounce = pendingSpinBounceRef.current;
    if (spinBounce) {
      pendingSpinBounceRef.current = null;
      applyBallSpinBounce(body, spinBounce);
    }

    const from = prevBallPos.current;
    if (hasPrevBallPos.current) {
      if (
        tryBallGoalScore(
          { x: from.x, y: from.y, z: from.z },
          { x: t.x, y: t.y, z: t.z },
          body,
        )
      ) {
        prevBallPos.current.set(t.x, t.y, t.z);
        hasPrevBallPos.current = true;
        return;
      }
      _ballTo.current.set(t.x, t.y, t.z);
      refreshFanGlassBoxes();
      const glass = trySegmentHitsFanGlass(from, _ballTo.current);
      if (glass) triggerFanGlassHit(glass.bayKey);
    }
    prevBallPos.current.set(t.x, t.y, t.z);
    hasPrevBallPos.current = true;

    stepBallPhysics(body);
  });

  // Release timer + goal-suck overrides; loose proxy handles bot carry + loose display.
  useFrame((_, dt) => {
    const nowSec = performance.now() / 1000;
    if (isGoalBallSuckActive()) {
      tickGoalBallSuck(dt);
      const body = bodyRef.current;
      const alpha = getGoalBallSuckVisualAlpha();
      const visible = alpha > 0.03;
      if (body) {
        const t = body.translation();
        const scale = 0.35 + alpha * 0.65;
        const showWire = gameStore.getState().showPhysicsBall;
        if (looseVisualRef.current) {
          looseVisualRef.current.position.set(t.x, t.y, t.z);
          looseVisualRef.current.scale.setScalar(scale);
          looseVisualRef.current.visible = visible;
        }
        if (physicsWireRef.current) {
          physicsWireRef.current.position.set(t.x, t.y, t.z);
          physicsWireRef.current.scale.setScalar(scale);
          physicsWireRef.current.visible = visible && showWire;
        }
        if (ballMeshRef.current) {
          ballMeshRef.current.visible = false;
        }
        const applyAlpha = (m: THREE.MeshStandardMaterial | null) => {
          if (!m) return;
          m.transparent = alpha < 0.999;
          m.opacity = alpha;
        };
        applyAlpha(ballMatRef.current);
        applyAlpha(looseVisualMatRef.current);
      }
      return;
    }

    if (ballMatRef.current) {
      ballMatRef.current.transparent = false;
      ballMatRef.current.opacity = 1;
    }
    if (looseVisualMatRef.current) {
      looseVisualMatRef.current.transparent = false;
      looseVisualMatRef.current.opacity = 1;
    }

    if (ballMeshRef.current) {
      ballMeshRef.current.scale.setScalar(1);
    }
    if (looseVisualRef.current) {
      looseVisualRef.current.scale.setScalar(1);
    }

    advanceHeldBallReleaseBlend(nowSec);

    if (ballMeshRef.current) {
      ballMeshRef.current.visible = false;
      ballMeshRef.current.position.set(0, 0, 0);
    }
    if (physicsWireRef.current && heldBallVisualBridge.release.active) {
      physicsWireRef.current.visible = false;
    }
  }, -1);

  useFrame(({ clock }, dt) => {
    decayBeamContest(dt);

    const body = bodyRef.current;
    const holderId = gameStore.getState().ballHolderId;
    const held = holderId !== null;
    if (body && held !== wasHeldRef.current) {
      wasHeldRef.current = held;
      setBallHeldCollider(body, held);
    } else if (body && !held) {
      syncBallLooseCollision(body);
    }
    const localTeam = gameStore.getState().localTeam;
    const mat = ballMatRef.current;
    const looseMat = looseVisualMatRef.current;
    const holderChanged = holderId !== lastHolderId.current;
    lastHolderId.current = holderId;

    glowTick.current += 1;
    if (
      (mat || looseMat) &&
      (holderChanged ||
        isHeld ||
        !held ||
        glowTick.current % 2 === 0)
    ) {
      const t = clock.getElapsedTime();
      const holdImmunityActive =
        isHeld &&
        performance.now() < gameStore.getState().holdImmunityUntilMs;
      const applyGlow = (m: THREE.MeshStandardMaterial | null) => {
        if (!m) return;
        if (isHeld) {
          const ht = holderGlowTeam(holderId, localTeam);
          const immune = holdImmunityActive;
          const pulse = immune
            ? 1.18 + Math.sin(t * 7) * 0.24
            : 0.78 + Math.sin(t * 5) * 0.18;
          m.emissiveIntensity = pulse;
          if (ht === 'red') m.emissive.set(immune ? '#ff8877' : '#ff5544');
          else if (ht === 'blue') m.emissive.set(immune ? '#88ccff' : '#55aaff');
          else m.emissive.set(immune ? '#fff4aa' : '#ffee88');
        } else {
          const glow = getBeamBallGlow();
          if (glow.contested) {
            m.emissiveIntensity = 0.3 + Math.sin(t * 8) * 0.2;
            m.emissive.copy(glow.color);
          } else {
            m.emissive.set('#ffffff');
            m.emissiveIntensity = 0.58 + Math.sin(t * 4) * 0.14;
          }
        }
      };
      applyGlow(mat);
      applyGlow(looseMat);
    }
  });

  const looseProxyHidden = isLocalHeld || isGoalBallSuckActive();

  const physicsWireVisible =
    showPhysicsBall &&
    !isLocalHeld &&
    !heldBallVisualBridge.release.active &&
    !isGoalBallSuckActive();

  return (
    <>
    <BallMotionRibbons bodyRef={bodyRef} hidden={isHeld || hideTrail} />
    <PhysicsBallWireframe
      bodyRef={bodyRef}
      visible={physicsWireVisible}
      meshRef={physicsWireRef}
    />
    <LooseBallVisual
      bodyRef={bodyRef}
      hidden={looseProxyHidden}
      surfaceMap={surfaceMap}
      matRef={looseVisualMatRef}
      meshRef={looseVisualRef}
    />
    <RigidBody
      ref={bodyRef}
      colliders={false}
      mass={isSuperball ? SUPERBALL.mass : BALL.mass}
      onCollisionEnter={onBallCollisionEnter}
      restitution={BALL.restitution}
      friction={BALL.friction}
      linearDamping={isSuperball ? SUPERBALL.linearDamping : BALL.linearDamping}
      angularDamping={BALL.angularDamping}
      gravityScale={BALL.gravityScale}
      ccd
      canSleep={false}
      position={[BALL_SPAWN.x, BALL_SPAWN.y, BALL_SPAWN.z]}
      collisionGroups={interactionGroups(1, [0, 1, 2, 4])}
    >
      <BallCollider
        args={[BALL.radius]}
        restitution={BALL.restitution}
        friction={BALL.friction}
        collisionGroups={interactionGroups(1, [0, 1, 2, 4])}
      />
      <mesh
        ref={ballMeshRef}
        visible={false}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[BALL.radius, 14, 12]} />
        <meshStandardMaterial
          ref={ballMatRef}
          map={surfaceMap}
          color="#c8d8ec"
          emissive="#5ec8ff"
          emissiveIntensity={0.22}
          metalness={0.52}
          roughness={0.32}
        />
      </mesh>
    </RigidBody>
    </>
  );
});
