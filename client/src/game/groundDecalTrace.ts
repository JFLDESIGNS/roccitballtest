import type { RigidBody } from '@dimforge/rapier3d-compat';
import type { World } from '@dimforge/rapier3d-compat';
import { Ray } from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { ARENA } from '../shared/Constants';
import { getMaxPlatformSurfaceY } from './arenaSpawn';
import { sampleTrampolineFloorY } from './arenaPadLayout';

const _rayOrig = { x: 0, y: 0, z: 0 };
const _rayDir = { x: 0, y: -1, z: 0 };

export type GroundDecalHit = {
  point: THREE.Vector3;
};

/**
 * Floor Y under anchor — jersey decals stay flat on the ground (not tilted / raised).
 */
export function traceGroundDecal(
  world: World,
  anchorX: number,
  anchorY: number,
  anchorZ: number,
  excludeBody: RigidBody | null,
  out: GroundDecalHit,
): boolean {
  _rayOrig.x = anchorX;
  _rayOrig.y = anchorY + 2.5;
  _rayOrig.z = anchorZ;

  const hit = world.castRayAndGetNormal(
    new Ray(_rayOrig, _rayDir),
    anchorY + 30,
    true,
    undefined,
    undefined,
    undefined,
    excludeBody ?? undefined,
  );

  let surfaceY: number = ARENA.floorY;
  if (hit) {
    surfaceY = Math.max(surfaceY, _rayOrig.y - hit.timeOfImpact);
  }
  const padY = sampleTrampolineFloorY(anchorX, anchorZ);
  if (padY !== null) surfaceY = Math.max(surfaceY, padY);
  const platformY = getMaxPlatformSurfaceY(anchorX, anchorZ);
  if (platformY !== null) surfaceY = Math.max(surfaceY, platformY);

  out.point.set(anchorX, surfaceY + 0.14, anchorZ);
  return true;
}
