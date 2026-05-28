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
const REMOTE_PLAYER_INTERPOLATION_BACKTIME_SEC = 0.075;
const REMOTE_PLAYER_EXTRAPOLATE_SEC = 0.12;
const REMOTE_PLAYER_MAX_EXTRAPOLATE_SPEED = 44;
const REMOTE_PLAYER_SNAP_DISTANCE = 7;
const REMOTE_PLAYER_SMOOTH_RATE = 18;

type RemotePlayerSample = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw: number;
  at: number;
};

function makeSample(player: RemoteMultiplayerPlayer): RemotePlayerSample {
  return {
    position: new THREE.Vector3(
      player.position.x,
      player.position.y,
      player.position.z,
    ),
    velocity: new THREE.Vector3(
      player.velocity.x,
      player.velocity.y,
      player.velocity.z,
    ),
    yaw: player.rotation.yaw,
    at: player.updatedAt,
  };
}

function lerpAngle(from: number, to: number, alpha: number): number {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * alpha;
}

function RemotePlayer({ player }: { player: RemoteMultiplayerPlayer }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const latestSample = useRef(makeSample(player));
  const previousSample = useRef(makeSample(player));
  const displayPos = useRef(latestSample.current.position.clone());
  const displayYaw = useRef(latestSample.current.yaw);
  const interpolatedPos = useRef(new THREE.Vector3());
  const blendedVel = useRef(new THREE.Vector3());
  const rotationQuat = useRef(new THREE.Quaternion());
  const ready = useRef(false);
  const lastStepAt = useRef(0);

  useEffect(() => {
    const next = makeSample(player);
    const prev = latestSample.current;
    if (
      !ready.current ||
      next.at <= prev.at ||
      next.position.distanceTo(prev.position) > REMOTE_PLAYER_SNAP_DISTANCE * 1.75
    ) {
      previousSample.current = next;
    } else {
      previousSample.current = {
        position: prev.position.clone(),
        velocity: prev.velocity.clone(),
        yaw: prev.yaw,
        at: prev.at,
      };
    }
    latestSample.current = next;
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
    const dt = lastStepAt.current > 0 ? Math.min(0.05, (now - lastStepAt.current) / 1000) : 1 / 60;
    lastStepAt.current = now;
    if (!ready.current) {
      displayPos.current.copy(latestSample.current.position);
      displayYaw.current = latestSample.current.yaw;
      ready.current = true;
    } else {
      const from = previousSample.current;
      const to = latestSample.current;
      const renderAt = now - REMOTE_PLAYER_INTERPOLATION_BACKTIME_SEC * 1000;
      let targetYaw = to.yaw;
      if (to.at > from.at && renderAt <= to.at) {
        const alpha = THREE.MathUtils.clamp(
          (renderAt - from.at) / Math.max(1, to.at - from.at),
          0,
          1,
        );
        interpolatedPos.current.lerpVectors(from.position, to.position, alpha);
        blendedVel.current.lerpVectors(from.velocity, to.velocity, alpha);
        targetYaw = lerpAngle(from.yaw, to.yaw, alpha);
      } else {
        interpolatedPos.current.copy(to.position);
        blendedVel.current.copy(to.velocity);
        const speed = blendedVel.current.length();
        if (speed > REMOTE_PLAYER_MAX_EXTRAPOLATE_SPEED) {
          blendedVel.current.multiplyScalar(
            REMOTE_PLAYER_MAX_EXTRAPOLATE_SPEED / speed,
          );
        }
        const extraSec = Math.min(
          REMOTE_PLAYER_EXTRAPOLATE_SEC,
          Math.max(0, (renderAt - to.at) / 1000),
        );
        interpolatedPos.current.addScaledVector(blendedVel.current, extraSec);
      }
      const dist = displayPos.current.distanceTo(interpolatedPos.current);
      if (dist > REMOTE_PLAYER_SNAP_DISTANCE) {
        displayPos.current.copy(interpolatedPos.current);
      } else {
        const alpha = 1 - Math.exp(-dt * REMOTE_PLAYER_SMOOTH_RATE);
        displayPos.current.lerp(interpolatedPos.current, alpha);
      }
      displayYaw.current = lerpAngle(
        displayYaw.current,
        targetYaw,
        1 - Math.exp(-dt * (REMOTE_PLAYER_SMOOTH_RATE + 2)),
      );
    }
    rotationQuat.current.setFromEuler(new THREE.Euler(0, displayYaw.current, 0));
    body.setNextKinematicTranslation(displayPos.current);
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
