import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { BALL } from '../shared/Constants';

const _push = new THREE.Vector3();

/** Knock a character away from the ball along the hit / separation normal */
export function applyBallStrikeKnock(
  body: RapierRigidBody,
  ballX: number,
  ballY: number,
  ballZ: number,
  ballVx: number,
  ballVy: number,
  ballVz: number,
  impactSpeed: number,
): void {
  const t = body.translation();
  _push.set(t.x - ballX, t.y - ballY, t.z - ballZ);
  const sepLen = _push.length();
  if (sepLen > 0.08) {
    _push.multiplyScalar(1 / sepLen);
  } else {
    const travel = Math.hypot(ballVx, ballVy, ballVz);
    if (travel > 0.2) _push.set(ballVx, ballVy, ballVz).multiplyScalar(1 / travel);
    else _push.set(0, 1, 0);
  }

  const travelH = Math.hypot(ballVx, ballVz);
  if (travelH > 1.2) {
    _push.x = _push.x * 0.25 + (ballVx / travelH) * 0.75;
    _push.z = _push.z * 0.25 + (ballVz / travelH) * 0.75;
    _push.y = _push.y * 0.4 + (ballVy / Math.max(travelH, 1)) * 0.15;
    _push.normalize();
  }

  const knock = THREE.MathUtils.clamp(
    impactSpeed * BALL.characterStrikeKnock,
    BALL.characterStrikeKnockMin,
    BALL.characterStrikeKnockMax,
  );
  const lv = body.linvel();
  body.setLinvel(
    {
      x: lv.x + _push.x * knock,
      y: lv.y + _push.y * knock * 0.28 + Math.min(knock * 0.14, 5),
      z: lv.z + _push.z * knock,
    },
    true,
  );
}
