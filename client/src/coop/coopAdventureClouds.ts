import * as THREE from 'three';
import type { CoopAdventurePlatform } from './coopAdventureLevels';

export type CoopAdventureCloudSpec = {
  position: [number, number, number];
  scale: [number, number, number];
};

const COURSE_CLOUDS: CoopAdventureCloudSpec[] = [
  { position: [-38, 20, 12], scale: [12, 5, 8] },
  { position: [-50, 27, -28], scale: [18, 6, 10] },
  { position: [42, 23, -8], scale: [14, 5, 9] },
  { position: [55, 32, -54], scale: [20, 7, 11] },
  { position: [-36, 42, -76], scale: [16, 6, 10] },
  { position: [34, 48, -92], scale: [15, 5, 9] },
  { position: [0, 52, -116], scale: [22, 7, 12] },
  { position: [-62, 16, 58], scale: [17, 6, 10] },
  { position: [64, 18, 52], scale: [18, 6, 10] },
];

let activeClouds: CoopAdventureCloudSpec[] = [];

export function buildCoopAdventureClouds(
  platforms: CoopAdventurePlatform[],
): CoopAdventureCloudSpec[] {
  const clouds: CoopAdventureCloudSpec[] = [...COURSE_CLOUDS];
  for (let i = 0; i < platforms.length - 1; i += 1) {
    const a = platforms[i]!;
    const b = platforms[i + 1]!;
    const midX = (a.position.x + b.position.x) * 0.5;
    const midY = Math.max(a.position.y, b.position.y) + 4.2 + (i % 2) * 1.3;
    const midZ = (a.position.z + b.position.z) * 0.5;
    const dx = b.position.x - a.position.x;
    const dz = b.position.z - a.position.z;
    const distance = Math.hypot(dx, dz);
    const sideX = distance > 0.01 ? -dz / distance : 1;
    const sideZ = distance > 0.01 ? dx / distance : 0;
    const side = i % 2 === 0 ? 1 : -1;
    clouds.push({
      position: [
        midX + sideX * side * Math.min(10, distance * 0.16),
        midY,
        midZ + sideZ * side * Math.min(10, distance * 0.16),
      ],
      scale: [
        THREE.MathUtils.clamp(distance * 0.12, 9, 18),
        3.6,
        THREE.MathUtils.clamp(distance * 0.08, 6, 12),
      ],
    });
  }
  return clouds;
}

export function setCoopAdventureClouds(clouds: CoopAdventureCloudSpec[]): void {
  activeClouds = clouds;
}

export function clearCoopAdventureClouds(): void {
  activeClouds = [];
}

export function sampleCoopAdventureCloudBounce(
  x: number,
  y: number,
  z: number,
  verticalVelocity: number,
  ignoreClouds: boolean,
): { y: number; bounceVy: number; liftOnly?: boolean } | null {
  if (ignoreClouds) return null;
  for (const cloud of activeClouds) {
    const [cx, cy, cz] = cloud.position;
    const [sx, sy, sz] = cloud.scale;
    const rx = sx * 0.92;
    const ry = sy * 0.5;
    const rz = sz * 0.82;
    const nx = (x - cx) / Math.max(0.001, rx);
    const ny = (y - cy) / Math.max(0.001, ry);
    const nz = (z - cz) / Math.max(0.001, rz);
    if (nx * nx + ny * ny + nz * nz > 1) continue;
    if (y < cy - ry * 0.7 || y > cy + ry * 1.25) continue;
    if (verticalVelocity > 7 && y < cy + ry * 0.15) {
      return {
        y,
        bounceVy: Math.max(verticalVelocity, 22),
        liftOnly: true,
      };
    }
    if (verticalVelocity > 7) continue;
    return {
      y: cy + ry * 0.92,
      bounceVy: Math.max(52, Math.abs(verticalVelocity) * 2.15 + 35),
    };
  }
  return null;
}
