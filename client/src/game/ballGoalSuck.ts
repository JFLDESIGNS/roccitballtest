import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { GOAL_RINGS, BALL } from '../shared/Constants';

const KINEMATIC = 2;
const DYNAMIC = 0;

type Vec3 = { x: number; y: number; z: number };

type GoalBallSuckState = {
  body: RapierRigidBody;
  from: THREE.Vector3;
  center: THREE.Vector3;
  retreat: THREE.Vector3;
  elapsed: number;
  pauseSec: number;
  lerpSec: number;
  fadeSec: number;
  visualAlpha: number;
  onComplete: () => void;
};

let suckState: GoalBallSuckState | null = null;

const _pos = new THREE.Vector3();

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeInCubic(t: number): number {
  return t * t * t;
}

export function isGoalBallSuckActive(): boolean {
  return suckState !== null;
}

/** 1 during pause/lerp; fades to 0 while retreating into the wall */
export function getGoalBallSuckVisualAlpha(): number {
  return suckState?.visualAlpha ?? 1;
}

/** @deprecated use getGoalBallSuckVisualAlpha */
export function isGoalBallSuckHidden(): boolean {
  return getGoalBallSuckVisualAlpha() < 0.04;
}

export function startGoalBallSuck(
  body: RapierRigidBody,
  from: Vec3,
  center: Vec3,
  retreat: Vec3,
  onComplete: () => void,
): void {
  body.setBodyType(KINEMATIC, true);
  body.setGravityScale(0, true);
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  body.setTranslation({ x: from.x, y: from.y, z: from.z }, true);

  suckState = {
    body,
    from: new THREE.Vector3(from.x, from.y, from.z),
    center: new THREE.Vector3(center.x, center.y, center.z),
    retreat: new THREE.Vector3(retreat.x, retreat.y, retreat.z),
    elapsed: 0,
    pauseSec: GOAL_RINGS.goalBallSuckPauseSec,
    lerpSec: GOAL_RINGS.goalBallSuckLerpSec,
    fadeSec: GOAL_RINGS.goalBallSuckFadeSec,
    visualAlpha: 1,
    onComplete,
  };
}

export function tickGoalBallSuck(dt: number): void {
  if (!suckState) return;

  const s = suckState;
  s.elapsed += dt;

  const pauseEnd = s.pauseSec;
  const lerpEnd = pauseEnd + s.lerpSec;
  const total = lerpEnd + s.fadeSec;

  if (s.elapsed < pauseEnd) {
    _pos.copy(s.from);
    s.visualAlpha = 1;
  } else if (s.elapsed < lerpEnd) {
    const t = (s.elapsed - pauseEnd) / Math.max(s.lerpSec, 1e-4);
    const local = easeOutCubic(Math.min(1, t));
    _pos.lerpVectors(s.from, s.center, local);
    s.visualAlpha = 1;
  } else if (s.elapsed < total) {
    const t = (s.elapsed - lerpEnd) / Math.max(s.fadeSec, 1e-4);
    const local = easeInCubic(Math.min(1, t));
    _pos.lerpVectors(s.center, s.retreat, local);
    s.visualAlpha = 1 - local;
  } else {
    _pos.copy(s.retreat);
    s.visualAlpha = 0;
  }

  s.body.setTranslation({ x: _pos.x, y: _pos.y, z: _pos.z }, true);
  s.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  s.body.setAngvel({ x: 0, y: 0, z: 0 }, true);

  if (s.elapsed < total) return;

  const done = s.onComplete;
  suckState = null;
  s.body.setBodyType(DYNAMIC, true);
  s.body.setGravityScale(BALL.gravityScale, true);
  done();
}
