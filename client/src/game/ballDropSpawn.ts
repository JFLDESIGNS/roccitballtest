import type { RapierRigidBody } from '@react-three/rapier';
import { BALL_SPAWN } from '../shared/Constants';
import { getBallDropLayout } from './arenaLayout';
import { setBallHeldCollider, syncBallLooseCollision } from './ballPhysics';

/** Park the ball inside the drop cube (hidden until flaps open). */
export function parkBallAtDropSpawn(body: RapierRigidBody): void {
  setBallHeldCollider(body, false);
  const { spawnY } = getBallDropLayout();
  body.setTranslation({ x: BALL_SPAWN.x, y: spawnY, z: BALL_SPAWN.z }, true);
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  syncBallLooseCollision(body);
}
