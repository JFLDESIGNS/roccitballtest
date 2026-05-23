import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { BALL, BOT } from '../shared/Constants';
import { releaseBallPhysics } from './ballAttach';
import { applyBallLaunchImpulse } from './ballPhysics';
import {
  computeBallLaunchSpawn,
  computeDirectedShotVelocity,
  type LaunchVelocityInput,
} from './launchShot';
import { tuningStore } from './tuningStore';
import type { BotId } from './Bots';
import { gameStore } from './gameStore';
import type { BotShotStyle } from './botGoalOffense';

const _zero = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _spawn = new THREE.Vector3();
const _look = new THREE.Vector3();

export type BotLaunchKind = 'shoot' | 'pass' | 'loft';

function botLaunchTune(kind: BotLaunchKind, tune = tuningStore.getState()) {
  const forceScale =
    (BOT.launchForce * tune.botLaunchForceScale) /
    (BALL.launchForce * tune.baseLaunchForce);
  void kind;
  return {
    ...tune,
    baseLaunchForce: tune.baseLaunchForce * forceScale,
  };
}

/** Same recipe as player LMB — use lookDir from writeLookDirection / smoothAimToward */
export function botFireHeldBall(
  _botId: BotId,
  ball: RapierRigidBody,
  chest: THREE.Vector3,
  bodyVel: THREE.Vector3,
  lookDir: THREE.Vector3,
  kind: BotLaunchKind,
  shotStyle: BotShotStyle = 'normal',
): void {
  const tune = tuningStore.getState();
  _look.copy(lookDir);
  if (_look.lengthSq() < 1e-6) _look.set(0, 0, 1);
  _look.normalize();

  const input: LaunchVelocityInput = {
    lookDir: _look,
    playerCarry: bodyVel,
    ballSwing: _zero,
    playerVel: bodyVel,
    tune: botLaunchTune(kind, tune),
  };

  computeDirectedShotVelocity(input, _vel);

  if (_vel.lengthSq() < 16) {
    _vel.copy(_look).multiplyScalar(BOT.launchForce * tune.botLaunchForceScale);
  }
  if (kind === 'loft') {
    _vel.y += BOT.launchUp * tune.botLaunchForceScale * 0.85;
  } else if (shotStyle === 'dunk') {
    _vel.y += BOT.launchUp * tune.botLaunchForceScale * BOT.dunkLaunchUpMult;
  } else if (shotStyle === 'jam') {
    _vel.y = Math.min(_vel.y, _look.y * BOT.launchForce * 0.28);
    const horiz = Math.hypot(_vel.x, _vel.z);
    if (horiz < 18) {
      const boost = 18 / Math.max(horiz, 0.5);
      _vel.x *= boost;
      _vel.z *= boost;
    }
  }

  const launchVel = _vel.clone();
  const spd = launchVel.length();
  if (spd > BALL.maxSpeed) launchVel.multiplyScalar(BALL.maxSpeed / spd);

  releaseBallPhysics(ball);
  computeBallLaunchSpawn(chest, _look, launchVel, _spawn);
  ball.setTranslation({ x: _spawn.x, y: _spawn.y, z: _spawn.z }, true);
  applyBallLaunchImpulse(ball, launchVel, _zero);
  gameStore.clearBallHolder();
  gameStore.setBallState('launched');
}
