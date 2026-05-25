import type { RapierRigidBody } from '@react-three/rapier';
import { ROCKET } from '../shared/Constants';

const FT = 0.3048;

export function isDownwardSelfRocketBoost(
  chestY: number,
  ex: number,
  ey: number,
  ez: number,
  px: number,
  pz: number,
  feetY: number,
  fromOwnerId: string | undefined,
  rocketVx: number | undefined,
  rocketVy: number | undefined,
  rocketVz: number | undefined,
): boolean {
  if (fromOwnerId !== 'local') return false;
  if (feetY > ROCKET.downRocketBoostMaxHeightFt * FT) return false;
  if (rocketVy === undefined) return false;

  const speed = Math.hypot(rocketVx ?? 0, rocketVy, rocketVz ?? 0);
  if (speed < 6) return false;

  const downDot = -rocketVy / speed;
  if (downDot < ROCKET.downRocketBoostMinDownDot) return false;

  const horiz = Math.hypot(px - ex, pz - ez);
  if (horiz > ROCKET.downRocketBoostMaxHorizM) return false;

  if (ey > chestY - 0.8) return false;

  return true;
}

/** Big upward launch — skips horizontal knock flatten */
export function applyDownwardSelfRocketBoost(
  player: RapierRigidBody,
  falloff: number,
): void {
  const lv = player.linvel();
  const up =
    ROCKET.playerForce *
    falloff *
    ROCKET.downRocketBoostForceMult *
    ROCKET.downRocketBoostUpScale;

  player.setLinvel(
    {
      x: lv.x * 0.72,
      y: Math.max(lv.y, 0) + up,
      z: lv.z * 0.72,
    },
    true,
  );
}
