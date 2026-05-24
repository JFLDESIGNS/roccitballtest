import * as THREE from 'three';
import { SUPERBALL, type BallTypeId } from '../shared/Constants';

const _dir = new THREE.Vector3();

/** Original ball — rocket travel axis, or radial push from blast center. */
function originalKnockDirection(
  tx: number,
  ty: number,
  tz: number,
  ex: number,
  ey: number,
  ez: number,
  rocketVx?: number,
  rocketVy?: number,
  rocketVz?: number,
): THREE.Vector3 {
  const hasRocket =
    rocketVx !== undefined && rocketVy !== undefined && rocketVz !== undefined;
  const rocketSpeed = hasRocket
    ? Math.hypot(rocketVx!, rocketVy!, rocketVz!)
    : 0;

  if (hasRocket && rocketSpeed > 1) {
    return _dir.set(rocketVx!, rocketVy!, rocketVz!).normalize();
  }

  const dx = tx - ex;
  const dy = ty - ey;
  const dz = tz - ez;
  if (dx * dx + dy * dy + dz * dz < 0.01) {
    return _dir.set(0, 0.08, 1).normalize();
  }
  return _dir.set(dx, dy, dz).normalize();
}

/**
 * Superball — flies opposite the surface normal at contact (billiards cue).
 * Right-side hit → normal points right → ball flies left.
 */
function superballKnockFromImpactNormal(
  impactNx: number,
  impactNy: number,
  impactNz: number,
  rocketVx: number,
  rocketVy: number,
  rocketVz: number,
): THREE.Vector3 {
  const rocketSpeed = Math.hypot(rocketVx, rocketVy, rocketVz) || 1;
  const rdx = rocketVx / rocketSpeed;
  const rdy = rocketVy / rocketSpeed;
  const rdz = rocketVz / rocketSpeed;

  const kx = -impactNx;
  const ky = -impactNy;
  const kz = -impactNz;
  const kLen = Math.hypot(kx, ky, kz) || 1;
  const knockX = kx / kLen;
  const knockY = ky / kLen;
  const knockZ = kz / kLen;

  const forwardDot = knockX * rdx + knockY * rdy + knockZ * rdz;
  const latX = knockX - rdx * forwardDot;
  const latY = knockY - rdy * forwardDot;
  const latZ = knockZ - rdz * forwardDot;
  const latLen = Math.hypot(latX, latY, latZ);

  if (
    forwardDot >= SUPERBALL.forwardAxialMin &&
    latLen < SUPERBALL.centerHitMaxLateral
  ) {
    return _dir.set(rdx, rdy, rdz);
  }

  return _dir.set(knockX, knockY, knockZ);
}

function superballKnockFromExplosion(
  ballX: number,
  ballY: number,
  ballZ: number,
  ex: number,
  ey: number,
  ez: number,
  rocketVx: number,
  rocketVy: number,
  rocketVz: number,
): THREE.Vector3 {
  const pdx = ballX - ex;
  const pdy = ballY - ey;
  const pdz = ballZ - ez;
  const pushLen = Math.hypot(pdx, pdy, pdz);
  if (pushLen < 0.01) {
    const rocketSpeed = Math.hypot(rocketVx, rocketVy, rocketVz) || 1;
    return _dir.set(
      rocketVx / rocketSpeed,
      rocketVy / rocketSpeed,
      rocketVz / rocketSpeed,
    );
  }
  return superballKnockFromImpactNormal(
    pdx / pushLen,
    pdy / pushLen,
    pdz / pushLen,
    rocketVx,
    rocketVy,
    rocketVz,
  );
}

export function ballRocketKnockDirection(
  ballType: BallTypeId,
  ballX: number,
  ballY: number,
  ballZ: number,
  ex: number,
  ey: number,
  ez: number,
  rocketVx?: number,
  rocketVy?: number,
  rocketVz?: number,
  impactNx?: number,
  impactNy?: number,
  impactNz?: number,
): THREE.Vector3 {
  const hasRocket =
    rocketVx !== undefined && rocketVy !== undefined && rocketVz !== undefined;
  const rocketSpeed = hasRocket
    ? Math.hypot(rocketVx!, rocketVy!, rocketVz!)
    : 0;

  if (ballType === 'superball' && hasRocket && rocketSpeed > 1) {
    if (
      impactNx !== undefined &&
      impactNy !== undefined &&
      impactNz !== undefined
    ) {
      return superballKnockFromImpactNormal(
        impactNx,
        impactNy,
        impactNz,
        rocketVx!,
        rocketVy!,
        rocketVz!,
      );
    }
    return superballKnockFromExplosion(
      ballX,
      ballY,
      ballZ,
      ex,
      ey,
      ez,
      rocketVx!,
      rocketVy!,
      rocketVz!,
    );
  }

  return originalKnockDirection(
    ballX,
    ballY,
    ballZ,
    ex,
    ey,
    ez,
    rocketVx,
    rocketVy,
    rocketVz,
  );
}

/** 0 = full side deflect, 1 = centered rear hit — scales rocket speed inherit. */
export function superballCenterHitFactor(
  impactNx?: number,
  impactNy?: number,
  impactNz?: number,
  rocketVx?: number,
  rocketVy?: number,
  rocketVz?: number,
): number {
  if (
    impactNx === undefined ||
    impactNy === undefined ||
    impactNz === undefined ||
    rocketVx === undefined ||
    rocketVy === undefined ||
    rocketVz === undefined
  ) {
    return 1;
  }

  const rocketSpeed = Math.hypot(rocketVx, rocketVy, rocketVz) || 1;
  const rdx = rocketVx / rocketSpeed;
  const rdy = rocketVy / rocketSpeed;
  const rdz = rocketVz / rocketSpeed;

  const kx = -impactNx;
  const ky = -impactNy;
  const kz = -impactNz;
  const kLen = Math.hypot(kx, ky, kz) || 1;
  const forwardDot = (kx / kLen) * rdx + (ky / kLen) * rdy + (kz / kLen) * rdz;
  const latX = kx / kLen - rdx * forwardDot;
  const latY = ky / kLen - rdy * forwardDot;
  const latZ = kz / kLen - rdz * forwardDot;
  const latLen = Math.hypot(latX, latY, latZ);

  if (
    forwardDot >= SUPERBALL.forwardAxialMin &&
    latLen < SUPERBALL.centerHitMaxLateral
  ) {
    return 1;
  }

  return THREE.MathUtils.clamp(1 - latLen * 2.2, 0.08, 1);
}
