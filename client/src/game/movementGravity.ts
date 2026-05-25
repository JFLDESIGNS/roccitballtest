/** Apply gravity — stronger when descending so jumps stay unchanged */
export function integrateFallGravity(
  vy: number,
  gravity: number,
  dt: number,
  fallGravityMult: number,
): number {
  const mult = vy > 0 ? 1 : fallGravityMult;
  return vy + gravity * dt * mult;
}
