import * as THREE from 'three';

export const FAN_GLASS_BREAK_PARTICLE_CAP = 200;
/** Shard size — bumped for visibility */
export const FAN_GLASS_BREAK_SIZE_MIN = 0.14;
export const FAN_GLASS_BREAK_SIZE_MAX = 0.22;
/** Sit almost flush on the court-facing glass plane */
export const FAN_GLASS_BREAK_SURFACE_LIFT_M = 0.01;
/** Peak opacity head-on (+20% vs prior ~0.33) */
export const FAN_GLASS_BREAK_BASE_OPACITY = 0.4;
/** Grazing-view floor (+20% vs prior ~0.1) */
export const FAN_GLASS_BREAK_GRAZING_OPACITY = 0.14;

export type FanGlassBreakParticle = {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  normal: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  spin: number;
  spinVel: number;
};

const particles: FanGlassBreakParticle[] = [];
let writeIdx = 0;

const _normal = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _bitangent = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _offset = new THREE.Vector3();

function surfaceBasis(
  normal: THREE.Vector3,
  tangent: THREE.Vector3,
  bitangent: THREE.Vector3,
): void {
  if (Math.abs(normal.y) > 0.85) {
    tangent.set(1, 0, 0);
  } else {
    tangent.crossVectors(_up, normal);
    if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0);
    tangent.normalize();
  }
  bitangent.crossVectors(normal, tangent).normalize();
}

function claimParticle(): FanGlassBreakParticle {
  if (particles.length < FAN_GLASS_BREAK_PARTICLE_CAP) {
    const p: FanGlassBreakParticle = {
      active: true,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      life: 0,
      maxLife: 0,
      size: 0,
      spin: 0,
      spinVel: 0,
    };
    particles.push(p);
    return p;
  }
  const p = particles[writeIdx]!;
  writeIdx = (writeIdx + 1) % particles.length;
  return p;
}

/** Light-blue glass shards on impact — tight to the glass surface */
export function spawnFanGlassBreakBurst(
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
): void {
  _normal.set(nx, ny, nz).normalize();
  surfaceBasis(_normal, _tangent, _bitangent);

  const count = 8 + Math.floor(Math.random() * 6);
  for (let i = 0; i < count; i++) {
    const p = claimParticle();
    const angle = Math.random() * Math.PI * 2;
    const rad = 0.06 + Math.random() * 0.32;
    _offset
      .copy(_tangent)
      .multiplyScalar(Math.cos(angle) * rad)
      .addScaledVector(_bitangent, Math.sin(angle) * rad);

    p.active = true;
    p.pos.set(x, y, z).addScaledVector(_normal, FAN_GLASS_BREAK_SURFACE_LIFT_M).add(_offset);
    p.normal.copy(_normal);
    p.maxLife = 0.55 + Math.random() * 0.65;
    p.life = p.maxLife;
    p.size =
      FAN_GLASS_BREAK_SIZE_MIN +
      Math.random() * (FAN_GLASS_BREAK_SIZE_MAX - FAN_GLASS_BREAK_SIZE_MIN);
    p.spin = Math.random() * Math.PI * 2;
    p.spinVel = (Math.random() - 0.5) * 5.5;

    const tangentDrift = 0.12 + Math.random() * 0.22;
    p.vel
      .copy(_tangent)
      .multiplyScalar((Math.random() - 0.5) * tangentDrift)
      .addScaledVector(_bitangent, (Math.random() - 0.5) * tangentDrift)
      .addScaledVector(_normal, 0.01 + Math.random() * 0.02);
  }
}

export function tickFanGlassBreakParticles(dt: number): readonly FanGlassBreakParticle[] {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!;
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.active = false;
      continue;
    }
    p.pos.addScaledVector(p.vel, dt);
    p.vel.multiplyScalar(1 - dt * 2.8);
    p.spin += p.spinVel * dt;
  }
  return particles;
}

export function fanGlassBreakViewOpacity(headOn: number): number {
  const t = THREE.MathUtils.clamp(headOn, 0, 1);
  const grazingRatio = FAN_GLASS_BREAK_GRAZING_OPACITY / FAN_GLASS_BREAK_BASE_OPACITY;
  const viewMul = THREE.MathUtils.lerp(grazingRatio, 1, t ** 1.05);
  return FAN_GLASS_BREAK_BASE_OPACITY * viewMul;
}
