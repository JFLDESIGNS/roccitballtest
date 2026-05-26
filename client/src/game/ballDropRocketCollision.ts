import * as THREE from 'three';
import { ARENA } from '../shared/Constants';
import { getBallDropLayout } from './arenaLayout';
import type { ActiveRocket } from './rocketSystem';

const _push = new THREE.Vector2();

function sampleSegmentHitsAABB(
  from: THREE.Vector3,
  to: THREE.Vector3,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
  samples = 10,
): boolean {
  const inside = (x: number, y: number, z: number) =>
    x >= minX && x <= maxX && y >= minY && y <= maxY && z >= minZ && z <= maxZ;

  if (inside(from.x, from.y, from.z) || inside(to.x, to.y, to.z)) return true;

  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    const z = from.z + (to.z - from.z) * t;
    if (inside(x, y, z)) return true;
  }
  return false;
}

function getBallDropBounds(pad: number) {
  const { centerY, drumBottomY, drumTopY } = getBallDropLayout();
  const cubeHalf = ARENA.ballDropCubeSize * 0.5 + pad;
  const drumR = ARENA.ballDropDrumRadius * ARENA.ballDropDrumScale + pad;
  const yMin = drumBottomY - pad - 2;
  const yMax = centerY + cubeHalf;
  return {
    minX: -cubeHalf,
    maxX: cubeHalf,
    minY: yMin,
    maxY: yMax,
    minZ: -Math.max(cubeHalf, drumR),
    maxZ: Math.max(cubeHalf, drumR),
    drumTopY,
  };
}

/** Swept rocket vs jumbotron cube + lower drum */
export function rocketSegmentHitsBallDrop(
  from: THREE.Vector3,
  to: THREE.Vector3,
  rocketRadius = 0.45,
): boolean {
  const b = getBallDropBounds(rocketRadius);
  return sampleSegmentHitsAABB(
    from,
    to,
    b.minX,
    b.minY,
    b.minZ,
    b.maxX,
    b.maxY,
    b.maxZ,
  );
}

function pushOutOfCircleXZ(
  pos: THREE.Vector3,
  cx: number,
  cz: number,
  radius: number,
): boolean {
  _push.set(pos.x - cx, pos.z - cz);
  const d = _push.length();
  if (d >= radius || d < 1e-6) return false;
  _push.multiplyScalar(radius / d);
  pos.x = cx + _push.x;
  pos.z = cz + _push.y;
  return true;
}

/** Ricochet rockets off the ball-drop structure */
export function tryBallDropRocketBounce(
  r: ActiveRocket,
  prev: THREE.Vector3,
  pos: THREE.Vector3,
): boolean {
  if (r.bouncesLeft <= 0) return false;
  if (!rocketSegmentHitsBallDrop(prev, pos)) return false;

  const { centerY, drumBottomY } = getBallDropLayout();
  const cubeHalf = ARENA.ballDropCubeSize * 0.5;
  const drumR =
    ARENA.ballDropDrumRadius * ARENA.ballDropDrumScale + 0.45;
  const rest = 0.55;
  let bounced = false;

  if (pushOutOfCircleXZ(pos, 0, 0, drumR)) {
    _push.set(pos.x, pos.z).normalize();
    const vDotN = r.velocity.x * _push.x + r.velocity.z * _push.y;
    if (vDotN > 0) {
      r.velocity.x -= 2 * vDotN * _push.x * rest;
      r.velocity.z -= 2 * vDotN * _push.y * rest;
    } else {
      r.velocity.x *= -rest;
      r.velocity.z *= -rest;
    }
    bounced = true;
  }

  const yMin = drumBottomY - 0.5;
  const yMax = centerY + cubeHalf;
  if (pos.y < yMin) {
    pos.y = yMin;
    r.velocity.y = Math.abs(r.velocity.y) * rest;
    bounced = true;
  } else if (pos.y > yMax) {
    pos.y = yMax;
    r.velocity.y = -Math.abs(r.velocity.y) * rest;
    bounced = true;
  }

  const maxXZ = cubeHalf + 0.45;
  if (Math.abs(pos.x) > maxXZ) {
    pos.x = Math.sign(pos.x) * maxXZ;
    r.velocity.x *= -rest;
    bounced = true;
  }
  if (Math.abs(pos.z) > maxXZ) {
    pos.z = Math.sign(pos.z) * maxXZ;
    r.velocity.z *= -rest;
    bounced = true;
  }

  if (bounced) {
    r.bouncesLeft -= 1;
    return true;
  }

  r.bouncesLeft -= 1;
  pos.copy(prev);
  r.velocity.multiplyScalar(-0.35);
  return true;
}
