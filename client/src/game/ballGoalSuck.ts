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
  duration: number;
  centerPhase: number;
  hideVisual: boolean;
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

export function isGoalBallSuckHidden(): boolean {
  return suckState?.hideVisual ?? false;
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

  suckState = {
    body,
    from: new THREE.Vector3(from.x, from.y, from.z),
    center: new THREE.Vector3(center.x, center.y, center.z),
    retreat: new THREE.Vector3(retreat.x, retreat.y, retreat.z),
    elapsed: 0,
    duration: GOAL_RINGS.goalBallSuckDurationSec,
    centerPhase: GOAL_RINGS.goalBallSuckCenterPhase,
    hideVisual: false,
    onComplete,
  };
}

export function tickGoalBallSuck(dt: number): void {
  if (!suckState) return;

  const s = suckState;
  s.elapsed += dt;
  const u = Math.min(1, s.elapsed / Math.max(s.duration, 1e-4));

  if (u < s.centerPhase) {
    const local = easeOutCubic(u / Math.max(s.centerPhase, 1e-4));
    _pos.lerpVectors(s.from, s.center, local);
    s.hideVisual = false;
  } else {
    const retreatT = (u - s.centerPhase) / Math.max(1 - s.centerPhase, 1e-4);
    const local = easeInCubic(retreatT);
    _pos.lerpVectors(s.center, s.retreat, local);
    s.hideVisual = retreatT > 0.58;
  }

  s.body.setTranslation({ x: _pos.x, y: _pos.y, z: _pos.z }, true);
  s.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  s.body.setAngvel({ x: 0, y: 0, z: 0 }, true);

  if (u < 1) return;

  const done = s.onComplete;
  suckState = null;
  s.body.setBodyType(DYNAMIC, true);
  s.body.setGravityScale(BALL.gravityScale, true);
  done();
}
