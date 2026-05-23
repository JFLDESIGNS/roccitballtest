import * as THREE from 'three';
import { ARENA } from '../shared/Constants';
import concreteUrl from '../../user/images/textures/concrete.png';

/** World meters per texture repeat on flat arena surfaces */
export const ARENA_CONCRETE_TILE_M = 4;

let baseConcrete: THREE.Texture | null = null;
const loadListeners = new Set<() => void>();

/** Shared repeating concrete albedo (loads once). */
export function getArenaConcreteTexture(): THREE.Texture | null {
  return baseConcrete;
}

export function onArenaConcreteReady(fn: () => void): () => void {
  if (baseConcrete) {
    fn();
    return () => {};
  }
  loadListeners.add(fn);
  return () => loadListeners.delete(fn);
}

function notifyLoaded() {
  loadListeners.forEach((fn) => fn());
  loadListeners.clear();
}

function configureBase(tex: THREE.Texture) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.repeat.set(4, 4);
}

/** Planar UVs from local X/Y (shape XZ after floor rotation) for world-space tiling */
export function applyPlanarTileUVs(
  geometry: THREE.BufferGeometry,
  tileM = ARENA_CONCRETE_TILE_M,
): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  const inv = 1 / tileM;
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) * inv;
    uv[i * 2 + 1] = pos.getY(i) * inv;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.attributes.uv.needsUpdate = true;
}

/** World-space XZ tiling for ramps / platforms (meters per repeat in UV). */
export function applyWorldXZTileUVs(
  geometry: THREE.BufferGeometry,
  tileM = ARENA_CONCRETE_TILE_M,
  offsetX = 0,
  offsetZ = 0,
): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  const inv = 1 / tileM;
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) + offsetX) * inv;
    uv[i * 2 + 1] = (pos.getZ(i) + offsetZ) * inv;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.attributes.uv.needsUpdate = true;
}

export function arenaFloorConcreteRepeat(): { x: number; y: number } {
  const span = ARENA.hexRadius * 2;
  return { x: span / ARENA_CONCRETE_TILE_M, y: span / ARENA_CONCRETE_TILE_M };
}

/** Independent repeat per surface (clone of base map). */
export function cloneArenaConcreteMap(
  repeatX: number,
  repeatY: number,
): THREE.Texture | null {
  if (!baseConcrete) return null;
  const map = baseConcrete.clone();
  map.repeat.set(repeatX, repeatY);
  map.needsUpdate = true;
  return map;
}

new THREE.TextureLoader().load(
  concreteUrl,
  (tex) => {
    configureBase(tex);
    baseConcrete = tex;
    notifyLoaded();
  },
  undefined,
  (err) => {
    console.warn('[arena] concrete texture failed to load', err);
  },
);
