import * as THREE from 'three';
import {
  lightGlowPunchNowSec,
  LIGHT_GLOW_BALL_PUNCH_REGEN_S,
  LIGHT_GLOW_BALL_RADIUS_MULTIPLIER,
  LIGHT_GLOW_ROCKET_PUNCH_REGEN_S,
  LIGHT_GLOW_ROCKET_RADIUS_MULTIPLIER,
  punchLightGlowHoleAtWorld,
} from './lightGlowHoles';
import {
  findLightGlowBallContact,
  intersectLightGlowScreenSegment,
} from './lightGlowScreenRegistry';
import type { ActiveRocket } from './rocketSystem';

export type LightGlowSegmentHit = {
  glowId: string;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  u: number;
  v: number;
};

const _segFrom = new THREE.Vector3();
const _segTo = new THREE.Vector3();

const lastBallPunchByGlow = new Map<
  string,
  { x: number; y: number; z: number; at: number }
>();

/** New crater while rolling; resting contact can repeat on a slower cadence. */
const BALL_PUNCH_MIN_INTERVAL_S = 0.05;
const BALL_PUNCH_MIN_MOVE_M = 0.25;
const BALL_PUNCH_RESTING_INTERVAL_S = 0.11;
const BODY_PUNCH_RADIUS_MULTIPLIER = 1.18;

export function findLightGlowSegmentHit(
  from: THREE.Vector3,
  to: THREE.Vector3,
): LightGlowSegmentHit | null {
  const hit = intersectLightGlowScreenSegment(from, to);
  if (!hit) return null;
  return {
    glowId: hit.glowId,
    point: hit.point,
    normal: hit.normal,
    u: hit.u,
    v: hit.v,
  };
}

/** Punch once per glow per rocket; does not block movement. */
export function punchLightGlowAlongRocketSegment(
  rocket: ActiveRocket,
  from: THREE.Vector3,
  to: THREE.Vector3,
): void {
  const hit = findLightGlowSegmentHit(from, to);
  if (!hit) return;
  if (rocket.punchedGlowIds.has(hit.glowId)) return;
  rocket.punchedGlowIds.add(hit.glowId);
  const radiusMul = rocket.explosive
    ? LIGHT_GLOW_ROCKET_RADIUS_MULTIPLIER * 1.2
    : LIGHT_GLOW_ROCKET_RADIUS_MULTIPLIER;
  punchLightGlowHoleAtWorld(
    hit.glowId,
    hit.point,
    rocket.explosive,
    radiusMul,
    LIGHT_GLOW_ROCKET_PUNCH_REGEN_S,
  );
}

function shouldAddBallPunch(
  glowId: string,
  point: THREE.Vector3,
  allowRestingRepeat: boolean,
): boolean {
  const now = lightGlowPunchNowSec();
  const prev = lastBallPunchByGlow.get(glowId);
  if (!prev) return true;

  const minInterval = allowRestingRepeat
    ? BALL_PUNCH_RESTING_INTERVAL_S
    : BALL_PUNCH_MIN_INTERVAL_S;
  if (now - prev.at < minInterval) return false;

  const dx = point.x - prev.x;
  const dy = point.y - prev.y;
  const dz = point.z - prev.z;
  const moveSq = dx * dx + dy * dy + dz * dz;
  if (moveSq >= BALL_PUNCH_MIN_MOVE_M * BALL_PUNCH_MIN_MOVE_M) return true;

  return allowRestingRepeat;
}

function recordBallPunch(glowId: string, point: THREE.Vector3): void {
  lastBallPunchByGlow.set(glowId, {
    x: point.x,
    y: point.y,
    z: point.z,
    at: lightGlowPunchNowSec(),
  });
}

function punchLightGlowFromBallHit(
  hit: LightGlowSegmentHit,
  allowRestingRepeat: boolean,
): void {
  if (!shouldAddBallPunch(hit.glowId, hit.point, allowRestingRepeat)) return;
  recordBallPunch(hit.glowId, hit.point);
  punchLightGlowHoleAtWorld(
    hit.glowId,
    hit.point,
    false,
    LIGHT_GLOW_BALL_RADIUS_MULTIPLIER,
    LIGHT_GLOW_BALL_PUNCH_REGEN_S,
  );
}

function punchLightGlowFromBodyHit(hit: LightGlowSegmentHit, allowRestingRepeat: boolean): void {
  if (!shouldAddBallPunch(hit.glowId, hit.point, allowRestingRepeat)) return;
  recordBallPunch(hit.glowId, hit.point);
  punchLightGlowHoleAtWorld(
    hit.glowId,
    hit.point,
    false,
    BODY_PUNCH_RADIUS_MULTIPLIER,
    LIGHT_GLOW_BALL_PUNCH_REGEN_S,
  );
}

function punchSegmentSample(
  from: THREE.Vector3,
  to: THREE.Vector3,
  ballRadius: number,
): void {
  const hit = findLightGlowSegmentHit(from, to);
  if (hit) punchLightGlowFromBallHit(hit, false);
  const contact = findLightGlowBallContact(to, ballRadius);
  if (contact) punchLightGlowFromBallHit(contact, true);
}

/**
 * Ball vs glow — segment sweep (fast travel) + sphere contact (touch / roll / held).
 * Each punch heals out over {@link LIGHT_GLOW_BALL_PUNCH_REGEN_S}.
 */
export function punchLightGlowForBall(
  from: THREE.Vector3,
  to: THREE.Vector3,
  ballRadius: number,
): void {
  const dist = from.distanceTo(to);
  const step = Math.max(ballRadius * 0.225, 0.11);
  if (dist <= step) {
    punchSegmentSample(from, to, ballRadius);
    return;
  }

  const steps = Math.min(56, Math.ceil(dist / step));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const t0 = (i - 1) / steps;
    _segTo.lerpVectors(from, to, t);
    _segFrom.lerpVectors(from, to, t0);
    punchSegmentSample(_segFrom, _segTo, ballRadius);
  }
}

export function punchLightGlowForBody(
  from: THREE.Vector3,
  to: THREE.Vector3,
  bodyRadius: number,
): void {
  const contact = findLightGlowBallContact(to, bodyRadius);
  if (contact) punchLightGlowFromBodyHit(contact, true);

  const dist = from.distanceTo(to);
  const step = Math.max(bodyRadius * 0.275, 0.14);
  const steps = Math.min(36, Math.ceil(dist / step));
  if (steps <= 1) {
    const hit = findLightGlowSegmentHit(from, to);
    if (hit) punchLightGlowFromBodyHit(hit, false);
    return;
  }

  for (let i = 1; i <= steps; i++) {
    _segTo.lerpVectors(from, to, i / steps);
    _segFrom.lerpVectors(from, to, (i - 1) / steps);
    const hit = findLightGlowSegmentHit(_segFrom, _segTo);
    if (hit) punchLightGlowFromBodyHit(hit, false);
  }
}

/** @deprecated Use {@link punchLightGlowForBall} */
export function punchLightGlowAlongBallSegment(
  from: THREE.Vector3,
  to: THREE.Vector3,
): void {
  punchLightGlowForBall(from, to, 1.6);
}
