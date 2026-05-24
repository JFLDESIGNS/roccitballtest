import * as THREE from 'three';
import { ROCKET } from '../shared/Constants';

export const WALL_SCORCH_POOL_SIZE = 14;

export type WallScorchKind = 'wall' | 'floor' | 'ceiling';

export type WallScorchEmber = {
  offset: THREE.Vector3;
  vel: THREE.Vector3;
  phase: number;
};

export type WallScorchSlot = {
  active: boolean;
  pos: THREE.Vector3;
  normal: THREE.Vector3;
  kind: WallScorchKind;
  /** When the black scorch becomes visible */
  scorchSpawnAt: number;
  /** When embers become visible */
  emberSpawnAt: number;
  embers: WallScorchEmber[];
};

export function createWallScorchPool(): WallScorchSlot[] {
  return Array.from({ length: WALL_SCORCH_POOL_SIZE }, () => ({
    active: false,
    pos: new THREE.Vector3(),
    normal: new THREE.Vector3(0, 1, 0),
    kind: 'wall' as WallScorchKind,
    scorchSpawnAt: 0,
    emberSpawnAt: 0,
    embers: [],
  }));
}

export function spawnWallScorch(
  pool: WallScorchSlot[],
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
  kind: WallScorchKind,
) {
  let slot = pool.find((s) => !s.active);
  if (!slot) {
    let oldest = pool[0]!;
    for (const s of pool) {
      if (s.scorchSpawnAt < oldest.scorchSpawnAt) oldest = s;
    }
    slot = oldest;
  }

  const nowSec = performance.now() / 1000;
  slot.active = true;
  slot.pos.set(x, y, z);
  slot.normal.set(nx, ny, nz).normalize();
  slot.kind = kind;
  slot.scorchSpawnAt = nowSec + ROCKET.wallScorchSpawnDelaySec;
  slot.emberSpawnAt = nowSec + ROCKET.wallScorchEmberSpawnDelaySec;

  slot.embers.length = 0;
  const count = ROCKET.wallScorchEmberCount;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.8;
    const rad = ROCKET.wallScorchRadiusM * (0.08 + Math.random() * 0.38);
    const tangent = new THREE.Vector3();
    const bitangent = new THREE.Vector3();
    if (Math.abs(slot.normal.y) > 0.85) {
      tangent.set(Math.cos(angle), 0, Math.sin(angle));
    } else {
      tangent.set(0, 1, 0).cross(slot.normal);
      if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0);
      tangent.normalize();
    }
    bitangent.crossVectors(slot.normal, tangent).normalize();
    const offset = new THREE.Vector3()
      .addScaledVector(tangent, Math.cos(angle) * rad)
      .addScaledVector(bitangent, Math.sin(angle) * rad);
    const rise = slot.normal.clone().multiplyScalar(0.6 + Math.random() * 1.4);
    const drift = tangent
      .clone()
      .multiplyScalar((Math.random() - 0.5) * 0.8)
      .add(
        bitangent.clone().multiplyScalar((Math.random() - 0.5) * 0.8),
      );
    slot.embers.push({
      offset,
      vel: rise.add(drift),
      phase: Math.random() * Math.PI * 2,
    });
  }
}

export function tickWallScorchPool(pool: WallScorchSlot[], nowSec: number) {
  const life = ROCKET.wallScorchHoldSec + ROCKET.wallScorchFadeSec;
  for (const slot of pool) {
    if (!slot.active) continue;
    if (nowSec - slot.scorchSpawnAt >= life) slot.active = false;
  }
}

function makeScorchGradientTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.5);
    g.addColorStop(0, 'rgba(0, 0, 0, 1)');
    g.addColorStop(0.28, 'rgba(0, 0, 0, 0.82)');
    g.addColorStop(0.55, 'rgba(0, 0, 0, 0.42)');
    g.addColorStop(0.78, 'rgba(0, 0, 0, 0.12)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let _scorchTex: THREE.CanvasTexture | null = null;

export function getWallScorchTexture(): THREE.CanvasTexture {
  if (!_scorchTex) _scorchTex = makeScorchGradientTexture();
  return _scorchTex;
}

const _zAxis = new THREE.Vector3(0, 0, 1);

export function orientToSurfaceNormal(
  normal: THREE.Vector3,
  outQuat: THREE.Quaternion,
): THREE.Quaternion {
  const n = normal.clone().normalize();
  if (n.lengthSq() < 1e-6) n.set(0, 1, 0);
  return outQuat.setFromUnitVectors(_zAxis, n);
}
