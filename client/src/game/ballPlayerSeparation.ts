import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { BALL, MOVEMENT } from '../shared/Constants';

const _ball = new THREE.Vector3();
const _player = new THREE.Vector3();
const _away = new THREE.Vector3();

/**
 * Push player and ball apart when overlapping (reduces tunneling).
 * Optionally adds outward velocity on the ball so Rapier does not zero the shot.
 */
export function separateBallFromPlayer(
  player: RapierRigidBody,
  ball: RapierRigidBody,
  playerMassRatio = 0.35,
  preserveBallMomentum = false,
) {
  const pt = player.translation();
  const bt = ball.translation();
  _player.set(pt.x, pt.y, pt.z);
  _ball.set(bt.x, bt.y, bt.z);
  _away.subVectors(_ball, _player);
  const dist = _away.length();
  const minSep = BALL.radius + MOVEMENT.capsuleRadius + 0.08;
  if (dist >= minSep || dist < 1e-4) return;

  const overlap = minSep - dist;
  const push = overlap * 0.85;
  _away.multiplyScalar(1 / dist);

  const pm = playerMassRatio * 0.28;
  const bm = 1 - pm;
  player.setTranslation(
    {
      x: pt.x - _away.x * push * pm,
      y: pt.y - _away.y * push * pm * 0.6,
      z: pt.z - _away.z * push * pm,
    },
    true,
  );
  ball.setTranslation(
    {
      x: bt.x + _away.x * push * bm,
      y: bt.y + _away.y * push * bm * 0.6,
      z: bt.z + _away.z * push * bm,
    },
    true,
  );

  if (!preserveBallMomentum) return;

  const lv = ball.linvel();
  const plv = player.linvel();
  const playerTowardBall = Math.max(
    0,
    plv.x * _away.x + plv.y * _away.y * 0.35 + plv.z * _away.z,
  );
  const horiz = Math.hypot(lv.x, lv.z);
  const boost = Math.min(
    85.8,
    21.45 + overlap * 35.1 + horiz * 0.234 + playerTowardBall * 2.145,
  );
  ball.setLinvel(
    {
      x: lv.x + _away.x * boost * bm,
      y: Math.max(lv.y, _away.y * boost * bm * 0.35),
      z: lv.z + _away.z * boost * bm,
    },
    true,
  );
}
