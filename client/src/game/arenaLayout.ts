import { ARENA, BALL } from '../shared/Constants';

/** Kickoff drop — cube + jumbotrons + 12-door drum */
export function getBallDropLayout() {
  const centerY = ARENA.ballDropCenterY;
  const cubeHalf = ARENA.ballDropCubeSize * 0.5;
  const cubeBottomY = centerY - cubeHalf;
  const drumTopY = cubeBottomY;
  const drumH = ARENA.ballDropDrumHeight * ARENA.ballDropDrumScale;
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
