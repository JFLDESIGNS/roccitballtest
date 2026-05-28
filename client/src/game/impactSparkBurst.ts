import { billboardFaceNormalWorld } from './billboardCollision';

export type ImpactSpark = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
};

const sparks: ImpactSpark[] = [];
const MAX_SPARKS = 160;
const GRAVITY = 18;

function claimSpark(): ImpactSpark {
  for (let i = 0; i < sparks.length; i++) {
    if (sparks[i]!.life <= 0) return sparks[i]!;
  }
  if (sparks.length >= MAX_SPARKS) sparks.shift();
  const slot: ImpactSpark = {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    life: 0,
    maxLife: 0.3,
  };
  sparks.push(slot);
  return slot;
}

/** Bright sparks off a jumbotron screen when shot */
export function burstBillboardFaceSparks(
  mountX: number,
  mountY: number,
  mountZ: number,
  yaw: number,
  widthM: number,
  heightM: number,
): void {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const halfW = widthM * 0.46;
  const halfH = heightM * 0.46;
  const faceZ = 0.22;
  const count = 72;
  const out = { x: 0, y: 0, z: 0 };
  const n = billboardFaceNormalWorld(yaw);

  for (let i = 0; i < count; i++) {
    const lx = (Math.random() - 0.5) * halfW * 2;
    const ly = (Math.random() - 0.5) * halfH * 2;
    const dx = lx * c - faceZ * s;
    const dz = lx * s + faceZ * c;
    const speed = 10 + Math.random() * 16;
    const spread = 0.35 + Math.random() * 0.55;

    const spark = claimSpark();
    spark.x = mountX + dx;
    spark.y = mountY + ly;
    spark.z = mountZ + dz;
    out.x = n.x * speed + (Math.random() - 0.5) * 6 * spread;
    out.y = (Math.random() - 0.15) * 8 + Math.random() * 7;
    out.z = n.z * speed + (Math.random() - 0.5) * 6 * spread;
    spark.vx = out.x;
    spark.vy = out.y;
    spark.vz = out.z;
    spark.maxLife = 0.18 + Math.random() * 0.32;
    spark.life = spark.maxLife;
  }
}

export function burstGrindRailSparks(
  x: number,
  y: number,
  z: number,
  tangentX: number,
  tangentZ: number,
): void {
  const count = 12;
  for (let i = 0; i < count; i++) {
    const spark = claimSpark();
    const side = (Math.random() - 0.5) * 0.22;
    const back = 0.22 + Math.random() * 0.7;
    spark.x = x - tangentX * back - tangentZ * side;
    spark.y = y - 0.18 + Math.random() * 0.16;
    spark.z = z - tangentZ * back + tangentX * side;
    spark.vx = -tangentX * (10 + Math.random() * 12) + (Math.random() - 0.5) * 1.2;
    spark.vy = 1.6 + Math.random() * 2.8;
    spark.vz = -tangentZ * (10 + Math.random() * 12) + (Math.random() - 0.5) * 1.2;
    spark.maxLife = 0.12 + Math.random() * 0.16;
    spark.life = spark.maxLife;
  }
}

export function tickImpactSparks(dt: number): readonly ImpactSpark[] {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const p = sparks[i]!;
    p.life -= dt;
    if (p.life <= 0) {
      sparks.splice(i, 1);
      continue;
    }
    p.vy -= GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vx *= 1 - dt * 0.8;
    p.vz *= 1 - dt * 0.8;
  }
  return sparks;
}
