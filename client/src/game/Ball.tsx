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
import { BALL, BALL_SPAWN, RENDER } from '../shared/Constants';
import { getBallDropLayout } from './arenaLayout';
import { releaseBallPhysics } from './ballAttach';
import { createBallPolkaTexture } from './ballPolkaTexture';
import { decayBeamContest, getBeamBallGlow, resetBeamContest } from './ballBeamContest';
import { stepBallPhysics } from './ballRuntime';
import { setBallHeldCollider } from './ballPhysics';
import { playBallBounce, playGoalRimHit, playPlayerHit } from './audio';
import { isBallOnGoalRim } from './goalRimHit';
import { gameStore, type BallHolderId } from './gameStore';
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

export const Ball = forwardRef<BallHandle>(function Ball(_, ref) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const ballMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const isHeld = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().ballHolderId !== null,
  );
  const wasHeldRef = useRef(false);
  const lastBounceAt = useRef(0);
  const lastRimAt = useRef(0);
  const lastBodyHitAt = useRef(0);
  const glowTick = useRef(0);
  const lastHolderId = useRef<BallHolderId>(null);

  const polkaMap = useMemo(
    () => createBallPolkaTexture(RENDER.ballPolkaTextureSize),
    [],
  );

  useEffect(() => () => polkaMap.dispose(), [polkaMap]);

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
      | { userData?: { hitTarget?: boolean } }
      | undefined;
    if (otherObj?.userData?.hitTarget) {
      if (impact < 1.8) return;
      if (now - lastBodyHitAt.current < 140) return;
      lastBodyHitAt.current = now;
      playPlayerHit();
      return;
    }

    if (impact < 1.2) return;
    lastBounceAt.current = now;
    playBallBounce(impact);
  }, []);

  const placeAtDrop = (release: boolean) => {
    const body = bodyRef.current;
    if (!body) return;
    if (release) releaseBallPhysics(body);
    const { spawnY } = getBallDropLayout();
    body.setTranslation({ x: BALL_SPAWN.x, y: spawnY, z: BALL_SPAWN.z }, true);
    body.setLinvel({ x: 0, y: release ? -2.5 : 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    gameStore.setBallState('loose');
    gameStore.setIsHoldingBall(false);
    gameStore.clearBallHolder();
    resetBeamContest();
  };

  const dropFromVortex = () => placeAtDrop(true);
  const parkAtDrop = () => placeAtDrop(false);

  useImperativeHandle(ref, () => ({
    reset: dropFromVortex,
    spawn: dropFromVortex,
    parkAtDrop,
    getBody: () => bodyRef.current,
  }));

  useAfterPhysicsStep(() => {
    const body = bodyRef.current;
    if (!body) return;
    if (gameStore.getState().ballHolderId) return;
    if (gameStore.getState().ballFrozen) {
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    stepBallPhysics(body);

    const t = body.translation();
    const v = body.linvel();
    const speed = Math.hypot(v.x, v.y, v.z);
    const now = performance.now();
    if (
      speed >= 2.2 &&
      now - lastRimAt.current >= 110 &&
      isBallOnGoalRim(t)
    ) {
      lastRimAt.current = now;
      playGoalRimHit(speed);
    }
  });

  useFrame(({ clock }, dt) => {
    decayBeamContest(dt);

    const body = bodyRef.current;
    const holderId = gameStore.getState().ballHolderId;
    const held = holderId !== null;
    if (body && held !== wasHeldRef.current) {
      wasHeldRef.current = held;
      setBallHeldCollider(body, held);
    }
    const localTeam = gameStore.getState().localTeam;
    const mat = ballMatRef.current;
    const holderChanged = holderId !== lastHolderId.current;
    lastHolderId.current = holderId;

    glowTick.current += 1;
    if (mat && (holderChanged || isHeld || glowTick.current % 2 === 0)) {
      const t = clock.getElapsedTime();
      if (isHeld) {
        const ht = holderGlowTeam(holderId, localTeam);
        const pulse = 0.45 + Math.sin(t * 5) * 0.15;
        mat.emissiveIntensity = pulse;
        if (ht === 'red') mat.emissive.set('#ff6655');
        else if (ht === 'blue') mat.emissive.set('#66bbff');
        else mat.emissive.set('#ffee88');
      } else {
        const glow = getBeamBallGlow();
        const pulse = glow.contested
          ? 0.3 + Math.sin(t * 8) * 0.2
          : glow.intensity + Math.sin(t * 4) * 0.08;
        mat.emissiveIntensity = pulse;
        mat.emissive.copy(glow.color);
      }
    }
  });

  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      mass={BALL.mass}
      onCollisionEnter={onBallCollisionEnter}
      restitution={BALL.restitution}
      friction={BALL.friction}
      linearDamping={BALL.linearDamping}
      angularDamping={BALL.angularDamping}
      gravityScale={BALL.gravityScale}
      ccd
      canSleep={false}
      position={[BALL_SPAWN.x, BALL_SPAWN.y, BALL_SPAWN.z]}
      collisionGroups={interactionGroups(1, [0, 1, 2])}
    >
      <BallCollider
        args={[BALL.radius]}
        restitution={BALL.restitution}
        friction={BALL.friction}
        collisionGroups={interactionGroups(1, [0, 1, 2])}
      />
      <mesh>
        <sphereGeometry args={[BALL.radius, 14, 12]} />
        <meshStandardMaterial
          ref={ballMatRef}
          map={polkaMap}
          color="#ffffff"
          emissive="#ffee44"
          emissiveIntensity={0.12}
          metalness={0.08}
          roughness={0.42}
        />
      </mesh>
    </RigidBody>
  );
});
