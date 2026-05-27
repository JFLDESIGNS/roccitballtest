import * as THREE from 'three';
import {
  LIGHT_GLOW_BALL_RADIUS_MULTIPLIER,
  punchLightGlowHoleAtWorld,
} from './lightGlowHoles';
import { intersectLightGlowScreenSegment } from './lightGlowScreenRegistry';
import type { ActiveRocket } from './rocketSystem';

export type LightGlowSegmentHit = {
  glowId: string;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  u: number;
  v: number;
};

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
  punchLightGlowHoleAtWorld(hit.glowId, hit.point, rocket.explosive);
}

/** Ball sweep punch — larger crater, does not block movement. */
export function punchLightGlowAlongBallSegment(
  from: THREE.Vector3,
  to: THREE.Vector3,
): void {
  const hit = findLightGlowSegmentHit(from, to);
  if (!hit) return;
  punchLightGlowHoleAtWorld(
    hit.glowId,
    hit.point,
    false,
    LIGHT_GLOW_BALL_RADIUS_MULTIPLIER,
  );
}
