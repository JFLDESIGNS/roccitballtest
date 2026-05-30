import * as THREE from 'three';
import type { RapierRigidBody } from '@react-three/rapier';
import type {
  NetworkCoopAction,
  RemoteMultiplayerPlayer,
  RoomMode,
} from '../multiplayer/multiplayerStore';
import type { Vec3 } from '../shared/Types';

export const COOP_ADVENTURE_MODE: RoomMode = 'coop-adventure';

const COOP_PULL_RANGE = 22;
const COOP_LOCK_RAY_RADIUS = 5.5;
const COOP_HOLD_DISTANCE = 4.0;
const COOP_PULL_SPEED = 38;
const COOP_THROW_SPEED = 18;
const COOP_THROW_UP_SPEED = 5;

const _toTarget = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _hold = new THREE.Vector3();
const _velocity = new THREE.Vector3();

export function isCoopAdventureMode(mode: RoomMode | null | undefined): boolean {
  return mode === COOP_ADVENTURE_MODE;
}

export function vec3ToNetwork(v: THREE.Vector3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

export function findCoopAdventureTarget(
  players: RemoteMultiplayerPlayer[],
  origin: THREE.Vector3,
  lookDir: THREE.Vector3,
): RemoteMultiplayerPlayer | null {
  let best: RemoteMultiplayerPlayer | null = null;
  let bestScore = -Infinity;

  for (const player of players) {
    if (player.coopRagdoll) continue;
    _targetPos.set(player.position.x, player.position.y + 1.1, player.position.z);
    _toTarget.subVectors(_targetPos, origin);
    const distance = _toTarget.length();
    if (distance <= 0.001 || distance > COOP_PULL_RANGE) continue;

    const along = _toTarget.dot(lookDir);
    if (along < 0) continue;

    const rayDistanceSq = _toTarget.lengthSq() - along * along;
    if (rayDistanceSq > COOP_LOCK_RAY_RADIUS * COOP_LOCK_RAY_RADIUS) continue;

    const aimScore = along / distance;
    const score = aimScore * 3 - distance / COOP_PULL_RANGE;
    if (score > bestScore) {
      best = player;
      bestScore = score;
    }
  }

  return best;
}

export function makeCoopPullAction(
  targetId: string,
  holderPosition: THREE.Vector3,
  lookDir: THREE.Vector3,
  targetPosition: Vec3,
): Omit<NetworkCoopAction, 'id' | 'ownerId'> {
  _hold.copy(holderPosition).addScaledVector(lookDir, COOP_HOLD_DISTANCE);
  _hold.y += 0.5;
  _targetPos.set(targetPosition.x, targetPosition.y, targetPosition.z);
  _velocity.subVectors(_hold, _targetPos);
  const distance = _velocity.length();
  if (distance > 0.001) {
    _velocity.multiplyScalar(Math.min(COOP_PULL_SPEED, distance * 8) / distance);
  }
  return {
    kind: 'playerPull',
    targetId,
    position: vec3ToNetwork(_targetPos),
    holdPosition: vec3ToNetwork(_hold),
    velocity: vec3ToNetwork(_velocity),
  };
}

export function makeCoopThrowAction(
  targetId: string,
  holderPosition: THREE.Vector3,
  lookDir: THREE.Vector3,
  holderVelocity: Vec3,
): Omit<NetworkCoopAction, 'id' | 'ownerId'> {
  _velocity
    .copy(lookDir)
    .multiplyScalar(COOP_THROW_SPEED)
    .add(new THREE.Vector3(holderVelocity.x * 0.12, 0, holderVelocity.z * 0.12));
  _velocity.y = THREE.MathUtils.clamp(
    _velocity.y + COOP_THROW_UP_SPEED,
    COOP_THROW_UP_SPEED * 0.65,
    COOP_THROW_UP_SPEED + 3.5,
  );
  _hold.copy(holderPosition).addScaledVector(lookDir, 0.85);
  _hold.y += 0.35;
  return {
    kind: 'playerThrow',
    targetId,
    position: vec3ToNetwork(_hold),
    velocity: vec3ToNetwork(_velocity),
  };
}

export function applyCoopAdventureActionToBody(
  body: RapierRigidBody,
  action: NetworkCoopAction,
  dt: number,
): void {
  if (action.kind === 'playerThrow') {
    body.setTranslation(action.position, true);
    body.setLinvel(action.velocity, true);
    return;
  }

  const hold = action.holdPosition ?? action.position;
  const t = body.translation();
  const current = body.linvel();
  const toward = {
    x: (hold.x - t.x) * 18,
    y: (hold.y - t.y) * 18,
    z: (hold.z - t.z) * 18,
  };
  const alpha = 1 - Math.exp(-dt * 22);
  body.setLinvel(
    {
      x: THREE.MathUtils.lerp(current.x, toward.x + action.velocity.x * 0.2, alpha),
      y: THREE.MathUtils.lerp(current.y, toward.y + action.velocity.y * 0.2, alpha),
      z: THREE.MathUtils.lerp(current.z, toward.z + action.velocity.z * 0.2, alpha),
    },
    true,
  );
}
