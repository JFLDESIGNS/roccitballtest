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
    targetYaw.current = player.rotation.yaw;
  }, [player.position.x, player.position.y, player.position.z, player.rotation.yaw]);

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
      const alpha = 1 - Math.exp(-dt * 14);
      smoothedPos.current.lerp(targetPos.current, alpha);
      smoothedYaw.current = THREE.MathUtils.lerp(
        smoothedYaw.current,
        targetYaw.current,
        alpha,
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
