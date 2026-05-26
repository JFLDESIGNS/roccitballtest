import { useMemo, useSyncExternalStore } from 'react';
import { ARENA } from '../shared/Constants';
import { mapRegistryStore } from '../mapEditor/mapEditorStore';
import { listArenaPlatforms } from './arenaSpawn';
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

  const activeMapId = useSyncExternalStore(
    mapRegistryStore.subscribe,
    () => mapRegistryStore.getActiveMapId(),
  );
  const placements = useMemo(
    () => listArenaPlatforms(),
    [activeMapId],
  );

  return (
    <group renderOrder={GROUND_BLOB_SHADOW_RENDER_ORDER}>
      {placements.map((p, i) => {
        const footprint = p.slopeR * FOOTPRINT_MUL;
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
