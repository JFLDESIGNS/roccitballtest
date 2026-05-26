import { useMemo } from 'react';
import * as THREE from 'three';
import { ARENA } from '../shared/Constants';
import { createOctagonShape } from './arenaOctagon';
import { getArenaPlatformGroundShadowTexture } from './arenaPlatformGroundShadow';
import { hexCornerPositions, isMidMapWallCorner } from './arenaHex';

const SHADOW_LIFT = 0.035;

type PlatformShadowPlacement = {
  x: number;
  z: number;
  scale: number;
};

function listPlatformShadowPlacements(): PlatformShadowPlacement[] {
  const corners = hexCornerPositions(ARENA.hexRadius);
  return [
    { x: 0, z: 0, scale: 1 },
    ...corners.map((c) => ({
      x: c.x,
      z: c.z,
      scale: isMidMapWallCorner(c.x) ? ARENA.midWallOctagonSizeScale : 1,
    })),
  ];
}

/** Baked octagon contact shadows where ramp panels meet the floor (N8AO is weak on flat ground). */
export function ArenaPlatformGroundShadows() {
  const geometry = useMemo(() => {
    const geo = new THREE.ShapeGeometry(createOctagonShape(1));
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  const material = useMemo(() => {
    const map = getArenaPlatformGroundShadowTexture();
    return new THREE.MeshBasicMaterial({
      map,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      toneMapped: true,
    });
  }, []);

  const placements = useMemo(() => listPlatformShadowPlacements(), []);

  return (
    <group>
      {placements.map((p, i) => {
        const footprint = ARENA.octagonSlopeRadius * p.scale;
        return (
          <mesh
            key={`platform-shadow-${i}`}
            geometry={geometry}
            material={material}
            position={[p.x, ARENA.floorY + SHADOW_LIFT, p.z]}
            scale={[footprint, 1, footprint]}
            renderOrder={3}
            frustumCulled={false}
          />
        );
      })}
    </group>
  );
}
