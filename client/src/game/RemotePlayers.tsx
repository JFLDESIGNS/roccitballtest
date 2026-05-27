import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
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
  const rootRef = useRef<THREE.Group>(null);
  const targetPos = useRef(
    new THREE.Vector3(
      player.position.x,
      player.position.y,
      player.position.z,
    ),
  );
  const targetYaw = useRef(player.rotation.yaw);
  const ready = useRef(false);

  useEffect(() => {
    targetPos.current.set(
      player.position.x,
      player.position.y,
      player.position.z,
    );
    targetYaw.current = player.rotation.yaw;
  }, [player.position.x, player.position.y, player.position.z, player.rotation.yaw]);

  useFrame((_, dt) => {
    const root = rootRef.current;
    if (!root) return;
    if (!ready.current) {
      root.position.copy(targetPos.current);
      root.rotation.y = targetYaw.current;
      ready.current = true;
      return;
    }
    const alpha = 1 - Math.exp(-dt * 14);
    root.position.lerp(targetPos.current, alpha);
    root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, targetYaw.current, alpha);
  });

  return (
    <group ref={rootRef}>
      <group position={[0, capCenterY, 0]}>
        <PlayerAvatar team={player.team} />
      </group>
      <Html center position={[0, MOVEMENT.capsuleHeight + 1.1, 0]}>
        <div className="remote-player-nameplate">
          <span>{player.name}</span>
          <small>#{player.jerseyNumber.toString().padStart(2, '0')}</small>
        </div>
      </Html>
    </group>
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
