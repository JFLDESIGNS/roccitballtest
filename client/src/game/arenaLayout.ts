import { ARENA } from '../shared/Constants';

/** Ball drop tube layout from explicit center height in ARENA */
export function getBallDropLayout() {
  const half = ARENA.ballDropCylinderHeight / 2;
  const centerY = ARENA.ballDropCylinderCenterY;
  const bottomY = centerY - half;
  const spawnY =
    centerY + half - ARENA.ballDropSpawnInset;
  return { bottomY, centerY, spawnY };
}
