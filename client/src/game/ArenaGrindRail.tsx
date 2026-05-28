import { useMemo } from 'react';
import * as THREE from 'three';
import { GRIND_RAIL, getGrindRailSegments } from './grindRail';

const railMaterial = new THREE.MeshStandardMaterial({
  color: '#ff2738',
  emissive: '#ff172d',
  emissiveIntensity: 2.2,
  metalness: 0.35,
  roughness: 0.18,
});

const railCoreMaterial = new THREE.MeshStandardMaterial({
  color: '#fff1f2',
  emissive: '#ff4452',
  emissiveIntensity: 1.6,
  metalness: 0.2,
  roughness: 0.12,
});

export function ArenaGrindRail() {
  const segments = useMemo(() => getGrindRailSegments(), []);
  const railGeo = useMemo(
    () => new THREE.CylinderGeometry(GRIND_RAIL.radius, GRIND_RAIL.radius, 1, 18),
    [],
  );
  const coreGeo = useMemo(
    () =>
      new THREE.CylinderGeometry(
        GRIND_RAIL.radius * 0.28,
        GRIND_RAIL.radius * 0.28,
        1.01,
        12,
      ),
    [],
  );

  return (
    <group>
      {segments.map((segment, index) => (
        <group
          key={`arena-grind-rail-${index}`}
          position={[segment.midX, GRIND_RAIL.y, segment.midZ]}
          rotation={[0, segment.yaw, 0]}
        >
          <mesh
            geometry={railGeo}
            material={railMaterial}
            scale={[1, segment.length, 1]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          />
          <mesh
            geometry={coreGeo}
            material={railCoreMaterial}
            scale={[1, segment.length, 1]}
            rotation={[0, 0, Math.PI / 2]}
          />
        </group>
      ))}
    </group>
  );
}
