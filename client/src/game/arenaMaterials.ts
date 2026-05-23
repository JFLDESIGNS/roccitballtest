import * as THREE from 'three';

/** Brushed metal arena walls */
export const arenaWallMaterial = new THREE.MeshStandardMaterial({
  color: '#9aa8bc',
  emissive: '#1a2230',
  emissiveIntensity: 0.08,
  metalness: 0.88,
  roughness: 0.32,
});

/** Polished concrete main floor */
export const arenaFloorMaterial = new THREE.MeshStandardMaterial({
  color: '#7d858f',
  roughness: 0.92,
  metalness: 0.04,
});

/** Hex tile concrete (slightly cooler tone) */
export const arenaFloorTileMaterial = new THREE.MeshStandardMaterial({
  color: '#6f7884',
  roughness: 0.94,
  metalness: 0.03,
  vertexColors: true,
});

/** Octagon cap — worn concrete */
export const arenaPlatformMaterial = new THREE.MeshStandardMaterial({
  color: '#727c88',
  emissive: '#2a3340',
  emissiveIntensity: 0.12,
  metalness: 0.06,
  roughness: 0.9,
  flatShading: true,
});

/** Ceiling — dark metal panel */
export const arenaCeilingMaterial = new THREE.MeshStandardMaterial({
  color: '#3d4654',
  metalness: 0.75,
  roughness: 0.45,
  side: THREE.DoubleSide,
});
