import * as THREE from 'three';

export type RegisteredLightGlowScreen = {
  glowId: string;
  mesh: THREE.Object3D;
};

const screens: RegisteredLightGlowScreen[] = [];

const _inv = new THREE.Matrix4();
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _hitLocal = new THREE.Vector3();
const _hitWorld = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _worldScale = new THREE.Vector3();

export function registerLightGlowScreen(
  entry: RegisteredLightGlowScreen,
): () => void {
  screens.push(entry);
  return () => {
    const i = screens.indexOf(entry);
    if (i >= 0) screens.splice(i, 1);
  };
}

export type LightGlowScreenHit = {
  glowId: string;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  u: number;
  v: number;
};

/**
 * Segment vs camera-facing glow plane (mesh world matrix, local z = 0).
 */
export function intersectLightGlowScreenSegment(
  from: THREE.Vector3,
  to: THREE.Vector3,
  edgePad = 0.02,
): LightGlowScreenHit | null {
  let bestT = 2;
  let best: LightGlowScreenHit | null = null;

  for (const screen of screens) {
    screen.mesh.updateWorldMatrix(true, false);
    _inv.copy(screen.mesh.matrixWorld).invert();
    _from.copy(from).applyMatrix4(_inv);
    _to.copy(to).applyMatrix4(_inv);
    _dir.subVectors(_to, _from);

    const dz = _dir.z;
    if (Math.abs(dz) < 1e-7) continue;

    const t = -_from.z / dz;
    if (t < 0 || t > 1 || t >= bestT) continue;

    _hitLocal.copy(_from).addScaledVector(_dir, t);
    if (Math.abs(_hitLocal.z) > 0.35) continue;

    const lx = _hitLocal.x;
    const ly = _hitLocal.y;
    const hw = 0.5 + edgePad;
    const hh = 0.5 + edgePad;
    if (Math.abs(lx) > hw || Math.abs(ly) > hh) continue;

    const u = lx + 0.5;
    const v = ly + 0.5;
    if (u < -0.02 || u > 1.02 || v < -0.02 || v > 1.02) continue;

    const dist = Math.hypot(u - 0.5, v - 0.5) * 2;
    if (dist > 1.02) continue;

    _hitWorld.copy(_hitLocal).applyMatrix4(screen.mesh.matrixWorld);
    _normal.set(0, 0, 1).transformDirection(screen.mesh.matrixWorld).normalize();
    _rayDir.subVectors(to, from);
    if (_rayDir.lengthSq() > 1e-8) {
      _rayDir.normalize();
      if (_normal.dot(_rayDir) > 0.04) continue;
    }

    bestT = t;
    best = {
      glowId: screen.glowId,
      point: _hitWorld.clone(),
      normal: _normal.clone(),
      u: THREE.MathUtils.clamp(u, 0, 1),
      v: THREE.MathUtils.clamp(v, 0, 1),
    };
  }

  return best;
}

/**
 * Ball sphere overlapping a glow plane (resting contact, held ball, slow rolls).
 */
export function findLightGlowBallContact(
  center: THREE.Vector3,
  ballRadius: number,
): LightGlowScreenHit | null {
  let bestPlaneDist = Infinity;
  let best: LightGlowScreenHit | null = null;

  for (const screen of screens) {
    screen.mesh.updateWorldMatrix(true, false);
    _inv.copy(screen.mesh.matrixWorld).invert();
    _hitLocal.copy(center).applyMatrix4(_inv);

    const planeDist = Math.abs(_hitLocal.z);
    screen.mesh.getWorldScale(_worldScale);
    const maxScale = Math.max(_worldScale.x, _worldScale.y, 1e-3);
    const maxDepth = ballRadius + 0.9;
    if (planeDist > maxDepth) continue;

    const localBallPad = (ballRadius + 0.25) / maxScale;
    const hw = 0.5 + localBallPad * 0.58;
    const hh = 0.5 + localBallPad * 0.58;
    const lx = _hitLocal.x;
    const ly = _hitLocal.y;
    if (Math.abs(lx) > hw || Math.abs(ly) > hh) continue;

    const u = lx + 0.5;
    const v = ly + 0.5;
    const dist = Math.hypot(u - 0.5, v - 0.5) * 2;
    if (dist > 1.02 + localBallPad * 0.32) continue;

    if (planeDist >= bestPlaneDist) continue;
    bestPlaneDist = planeDist;

    _hitLocal.z = 0;
    _hitWorld.copy(_hitLocal).applyMatrix4(screen.mesh.matrixWorld);
    _normal.set(0, 0, 1).transformDirection(screen.mesh.matrixWorld).normalize();

    best = {
      glowId: screen.glowId,
      point: _hitWorld.clone(),
      normal: _normal.clone(),
      u: THREE.MathUtils.clamp(u, 0, 1),
      v: THREE.MathUtils.clamp(v, 0, 1),
    };
  }

  return best;
}
