import { Html } from '@react-three/drei';
import {
  CapsuleCollider,
  interactionGroups,
  RigidBody,
  useBeforePhysicsStep,
  type RapierRigidBody,
} from '@react-three/rapier';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { MOVEMENT } from '../shared/Constants';
import {
  multiplayerStore,
  type RemoteMultiplayerPlayer,
} from '../multiplayer/multiplayerStore';
import { PlayerAvatar } from './PlayerAvatar';

const capHalfH = MOVEMENT.capsuleHeight / 2 - MOVEMENT.capsuleRadius;
const capCenterY = capHalfH + MOVEMENT.capsuleRadius;
const REMOTE_PLAYER_EXTRAPOLATE_SEC = 0.08;
const REMOTE_PLAYER_MAX_EXTRAPOLATE_SPEED = 38;
const REMOTE_PLAYER_SNAP_DISTANCE = 7;

function lerpAngle(from: number, to: number, alpha: number): number {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * alpha;
}

function RemotePlayer({ player }: { player: RemoteMultiplayerPlayer }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const targetPos = useRef(
    new THREE.Vector3(
      player.position.x,
      player.position.y,
      player.position.z,
    ),
  );
  const smoothedPos = useRef(targetPos.current.clone());
  const predictedPos = useRef(targetPos.current.clone());
  const targetVel = useRef(
    new THREE.Vector3(
      player.velocity.x,
      player.velocity.y,
      player.velocity.z,
    ),
  );
  const targetYaw = useRef(player.rotation.yaw);
  const smoothedYaw = useRef(player.rotation.yaw);
  const rotationQuat = useRef(new THREE.Quaternion());
  const ready = useRef(false);
  const lastStepAt = useRef(performance.now());

  useEffect(() => {
    targetPos.current.set(
      player.position.x,
      player.position.y,
      player.position.z,
    );
    targetVel.current.set(
      player.velocity.x,
      player.velocity.y,
      player.velocity.z,
    );
    const speed = targetVel.current.length();
    if (speed > REMOTE_PLAYER_MAX_EXTRAPOLATE_SPEED) {
      targetVel.current.multiplyScalar(REMOTE_PLAYER_MAX_EXTRAPOLATE_SPEED / speed);
    }
    targetYaw.current = player.rotation.yaw;
  }, [
    player.position.x,
    player.position.y,
    player.position.z,
    player.rotation.yaw,
    player.velocity.x,
    player.velocity.y,
    player.velocity.z,
  ]);

  useBeforePhysicsStep(() => {
    const body = bodyRef.current;
    if (!body) return;
    const now = performance.now();
    const dt = Math.min(0.08, Math.max(0.001, (now - lastStepAt.current) / 1000));
    lastStepAt.current = now;
    if (!ready.current) {
      smoothedPos.current.copy(targetPos.current);
      smoothedYaw.current = targetYaw.current;
      ready.current = true;
    } else {
      predictedPos.current
        .copy(targetPos.current)
        .addScaledVector(targetVel.current, REMOTE_PLAYER_EXTRAPOLATE_SEC);
      const dist = smoothedPos.current.distanceTo(predictedPos.current);
      if (dist > REMOTE_PLAYER_SNAP_DISTANCE) {
        smoothedPos.current.copy(predictedPos.current);
      } else {
        const alpha = 1 - Math.exp(-dt * 18);
        smoothedPos.current.lerp(predictedPos.current, alpha);
      }
      const yawAlpha = 1 - Math.exp(-dt * 20);
      smoothedYaw.current = lerpAngle(
        smoothedYaw.current,
        targetYaw.current,
        yawAlpha,
      );
    }
    rotationQuat.current.setFromEuler(new THREE.Euler(0, smoothedYaw.current, 0));
    body.setNextKinematicTranslation(smoothedPos.current);
    body.setNextKinematicRotation(rotationQuat.current);
  });

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      position={[player.position.x, player.position.y, player.position.z]}
      userData={{ character: true, hitTarget: true, actorId: player.id }}
    >
      <CapsuleCollider
        args={[capHalfH, MOVEMENT.capsuleRadius]}
        position={[0, capCenterY, 0]}
        friction={0.65}
        collisionGroups={interactionGroups(0, [0, 1, 2, 4])}
      />
      <group position={[0, capCenterY, 0]}>
        <PlayerAvatar team={player.team} />
      </group>
      <Html center position={[0, MOVEMENT.capsuleHeight + 1.1, 0]}>
        <div className="remote-player-nameplate">
          <span>{player.name}</span>
          <small>#{player.jerseyNumber.toString().padStart(2, '0')}</small>
        </div>
      </Html>
    </RigidBody>
  );
}

export function RemotePlayers() {
  const players = useSyncExternalStore(
    multiplayerStore.subscribe,
    () => multiplayerStore.getState().remotePlayers,
  );

  if (players.length === 0) return null;

  return (
    <>
      {players.map((player) => (
        <RemotePlayer key={player.id} player={player} />
      ))}
    </>
  );
}
