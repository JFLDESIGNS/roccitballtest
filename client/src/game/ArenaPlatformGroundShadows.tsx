import { useMemo } from 'react';
import { ARENA } from '../shared/Constants';
import { listOctagonPlatformPlacements } from './arenaOctagonPlatforms';
import {
  GROUND_BLOB_SHADOW_LIFT,
  GROUND_BLOB_SHADOW_RENDER_ORDER,
  createBlobShadowPlaneGeometry,
  createGroundBlobShadowMaterial,
  getOctagonPlatformShadowTexture,
} from './arenaGroundBlobShadow';

const FOOTPRINT_MUL = 1.12;

/** Dark octagon contact shadows under every ramp platform. */
export function ArenaPlatformGroundShadows() {
  const geometry = useMemo(() => createBlobShadowPlaneGeometry(), []);

  const material = useMemo(
    () => createGroundBlobShadowMaterial(getOctagonPlatformShadowTexture()),
    [],
  );

  const placements = useMemo(() => listOctagonPlatformPlacements(), []);

  return (
    <group renderOrder={GROUND_BLOB_SHADOW_RENDER_ORDER}>
      {placements.map((p, i) => {
        const footprint = ARENA.octagonSlopeRadius * p.sizeScale * FOOTPRINT_MUL;
        return (
          <mesh
            key={`platform-shadow-${p.x}-${p.z}-${i}`}
            geometry={geometry}
            material={material}
            position={[p.x, ARENA.floorY + GROUND_BLOB_SHADOW_LIFT, p.z]}
            scale={[footprint, 1, footprint]}
            frustumCulled={false}
          />
        );
      })}
    </group>
  );
}
