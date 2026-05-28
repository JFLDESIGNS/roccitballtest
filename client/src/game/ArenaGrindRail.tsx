import { useMemo, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import {
  GRIND_RAIL,
  getGrindRailPaths,
  grindRailGlowStore,
} from './grindRail';

const railMaterial = new THREE.MeshStandardMaterial({
  color: '#bb1a27',
  emissive: '#250406',
  emissiveIntensity: 0.18,
  metalness: 0.46,
  roughness: 0.22,
});

const railCoreMaterial = new THREE.MeshStandardMaterial({
  color: '#ffd9de',
  emissive: '#3a070c',
  emissiveIntensity: 0.14,
  metalness: 0.24,
  roughness: 0.18,
});

const glowMaterial = new THREE.MeshStandardMaterial({
  color: '#ffe6ea',
  emissive: '#ff5066',
  emissiveIntensity: 2.1,
  metalness: 0.08,
  roughness: 0.18,
  transparent: true,
  opacity: 0.95,
});

function makeTube(points: THREE.Vector3[], radius: number, tubularSegments: number) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return new THREE.TubeGeometry(curve, tubularSegments, radius, 18, false);
}

export function ArenaGrindRail() {
  const glow = useSyncExternalStore(
    grindRailGlowStore.subscribe,
    grindRailGlowStore.getState,
  );
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
  const glowGeo = useMemo(
    () =>
      new THREE.CylinderGeometry(
        GRIND_RAIL.radius * 1.22,
        GRIND_RAIL.radius * 1.22,
        2.2,
        18,
        1,
        true,
      ),
    [],
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
      {glow.active && (
        <group
          position={[glow.x, glow.y, glow.z]}
          rotation={[0, glow.yaw, Math.PI / 2]}
        >
          <mesh geometry={glowGeo} material={glowMaterial} />
        </group>
      )}
    </group>
  );
}
