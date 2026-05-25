import * as THREE from 'three';
import { ARENA, BOT } from '../shared/Constants';
import type { Team } from '../shared/Types';
import { goalEndFaceX, stackedRingCenters } from './goals';
import { isInsideShootZone } from './botShootZone';

const _escapeWish = new THREE.Vector3();

/** Enemy goal end wall when this team is attacking */
function enemyGoalWallSide(attackingTeam: Team): 'red' | 'blue' {
  return attackingTeam === 'red' ? 'blue' : 'red';
}

function pitBounds(side: 'red' | 'blue') {
  const face = goalEndFaceX();
  const depth = BOT.goalBottomPitDepthFromWallM;
  const { bottomY } = stackedRingCenters();
  const yMin = ARENA.floorY;
  const yMax = Math.min(bottomY + BOT.goalBottomPitBelowRingM, yMin + BOT.goalBottomPitMaxHeightM);
  const zHalf = BOT.goalBottomPitHalfSpanZM;

  if (side === 'red') {
    return {
      xMin: -face,
      xMax: -face + depth,
      yMin,
      yMax,
      zMin: -zHalf,
      zMax: zHalf,
      pushX: 1,
    };
  }
  return {
    xMin: face - depth,
    xMax: face,
    yMin,
    yMax,
    zMin: -zHalf,
    zMax: zHalf,
    pushX: -1,
  };
}

/** Small floor volume under the bottom (large) ring — bots should not path here */
export function isInsideGoalBottomPit(
  x: number,
  y: number,
  z: number,
  attackingTeam: Team,
): boolean {
  const b = pitBounds(enemyGoalWallSide(attackingTeam));
  return (
    x >= b.xMin &&
    x <= b.xMax &&
    y >= b.yMin &&
    y <= b.yMax &&
    z >= b.zMin &&
    z <= b.zMax
  );
}

/** Steer wish out of the bottom goal pit (unless already in shoot zone). */
export function tickBotGoalBottomPitKeepOut(
  pos: THREE.Vector3,
  wish: THREE.Vector3,
  attackingTeam: Team | null,
): void {
  if (!attackingTeam) return;
  if (isInsideShootZone(pos.x, pos.z, attackingTeam)) return;
  if (!isInsideGoalBottomPit(pos.x, pos.y, pos.z, attackingTeam)) return;

  const b = pitBounds(enemyGoalWallSide(attackingTeam));
  _escapeWish.set(b.pushX, 0, 0);
  if (Math.abs(pos.z) > b.zMax * 0.55) {
    _escapeWish.z += pos.z > 0 ? -0.35 : 0.35;
  }
  if (_escapeWish.lengthSq() > 0.01) _escapeWish.normalize();

  wish.x = THREE.MathUtils.lerp(wish.x, _escapeWish.x, 0.82);
  wish.z = THREE.MathUtils.lerp(wish.z, _escapeWish.z, 0.55);
  if (wish.lengthSq() > 0.01) wish.normalize();
}

/** Keep dribble / approach targets out of the pit */
export function clampMoveTargetFromGoalBottomPit(
  target: THREE.Vector3,
  attackingTeam: Team | null,
): void {
  if (!attackingTeam) return;
  if (isInsideShootZone(target.x, target.z, attackingTeam)) return;
  if (!isInsideGoalBottomPit(target.x, target.y, target.z, attackingTeam)) return;

  const b = pitBounds(enemyGoalWallSide(attackingTeam));
  const margin = 1.2;
  if (b.pushX > 0) {
    target.x = Math.max(target.x, b.xMax + margin);
  } else {
    target.x = Math.min(target.x, b.xMin - margin);
  }
  if (target.z > b.zMax * 0.85) target.z = b.zMax + margin;
  if (target.z < -b.zMax * 0.85) target.z = -b.zMax - margin;
  target.y = Math.max(target.y, b.yMax + 0.5);
}
