import { ARENA, BALL } from '../shared/Constants';

const FT_TO_M = 0.3048;

/** Vertical lift of lower octagon drum + flaps below the cube (m) */
export function ballDropDrumOffsetM(): number {
  return ARENA.ballDropDrumOffsetFt * FT_TO_M;
}

/** Kickoff drop — cube + jumbotrons + 12-door drum */
export function getBallDropLayout() {
  const centerY = ARENA.ballDropCenterY;
  const cubeHalf = ARENA.ballDropCubeSize * 0.5;
  const cubeBottomY = centerY - cubeHalf;
  const drumH = ARENA.ballDropDrumHeight * ARENA.ballDropDrumScale;
  const drumTopY = cubeBottomY + ballDropDrumOffsetM();
  const drumBottomY = drumTopY - drumH;
  const spawnY = centerY + cubeHalf - ARENA.ballDropSpawnInset;
  /** Below open flaps — clears cube/drum colliders */
  const releaseY = drumBottomY - BALL.radius - 2.2;
  return {
    centerY,
    cubeBottomY,
    drumTopY,
    drumBottomY,
    spawnY,
    releaseY,
  };
}

/** Wall-mounted and perimeter logo banner mounts */
export function getArenaLogoBannerMounts(): {
  x: number;
  y: number;
  z: number;
  yaw: number;
}[] {
  const y = ARENA.arenaLogoBannerY;
  const r = ARENA.arenaLogoBannerRadius;
  const yaws = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  return yaws.map((yaw) => ({
    x: Math.sin(yaw) * r,
    y,
    z: Math.cos(yaw) * r,
    yaw: yaw + Math.PI,
  }));
}
