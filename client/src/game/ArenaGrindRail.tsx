import { useMemo } from 'react';
import * as THREE from 'three';
import {
  GRIND_RAIL,
  getGrindRailPaths,
} from './grindRail';

const railMaterial = new THREE.MeshStandardMaterial({
  color: '#090b10',
  emissive: '#020304',
  emissiveIntensity: 0.04,
  metalness: 0.56,
  roughness: 0.18,
});

const railCoreMaterial = new THREE.MeshStandardMaterial({
  color: '#171b23',
  emissive: '#07090c',
  emissiveIntensity: 0.05,
  metalness: 0.34,
  roughness: 0.24,
});

function makeTube(points: THREE.Vector3[], radius: number, tubularSegments: number) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return new THREE.TubeGeometry(curve, tubularSegments, radius, 18, false);
}

export function ArenaGrindRail() {
  const paths = useMemo(() => getGrindRailPaths(), []);
  const railGeometries = useMemo(
    () =>
      paths.map((path) =>
        makeTube(path, GRIND_RAIL.radius, Math.max(48, path.length * 16)),
      ),
    [paths],
  );
  const coreGeometries = useMemo(
    () =>
      paths.map((path) =>
        makeTube(path, GRIND_RAIL.radius * 0.3, Math.max(48, path.length * 16)),
      ),
    [paths],
  );
  return (
    <group>
      {railGeometries.map((geometry, index) => (
        <mesh
          key={`arena-grind-rail-shell-${index}`}
          geometry={geometry}
          material={railMaterial}
          castShadow
        />
      ))}
      {coreGeometries.map((geometry, index) => (
        <mesh
          key={`arena-grind-rail-core-${index}`}
          geometry={geometry}
          material={railCoreMaterial}
        />
      ))}
    </group>
  );
}
