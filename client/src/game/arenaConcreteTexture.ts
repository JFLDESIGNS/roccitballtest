import * as THREE from 'three';
import { ARENA } from '../shared/Constants';
import concreteUrl from '../assets/images/textures/concrete.png';

/** World meters per one texture repeat — larger = fewer, bigger tiles */
export const ARENA_CONCRETE_TILE_M = 8.5;

let baseConcrete: THREE.Texture | null = null;
let baseConcreteRoughness: THREE.Texture | null = null;
const loadListeners = new Set<() => void>();

/** Boost so roughness map shows clear shiny vs matte patches */
const ROUGHNESS_MAP_CONTRAST = 2.2;

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

/**
 * Box faces tiled in world meters (no stretch on long wall faces).
 * Local box axes: X = width, Y = height, Z = depth.
 */
export function applyBoxMeterUVs(
  geometry: THREE.BufferGeometry,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  tileM = ARENA_CONCRETE_TILE_M,
): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  const norm = geometry.getAttribute('normal') as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  const inv = 1 / tileM;
  const hx = sizeX * 0.5;
  const hy = sizeY * 0.5;
  const hz = sizeZ * 0.5;

  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const ax = Math.abs(norm.getX(i));
    const ay = Math.abs(norm.getY(i));

    let u: number;
    let v: number;
    if (ax >= ay && ax >= 0.5) {
      u = (pz + hz) * inv;
      v = (py + hy) * inv;
    } else if (ay >= 0.5) {
      u = (px + hx) * inv;
      v = (pz + hz) * inv;
    } else {
      u = (px + hx) * inv;
      v = (py + hy) * inv;
    }
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.attributes.uv.needsUpdate = true;
}

export function createMeterTiledBoxGeometry(
  width: number,
  height: number,
  depth: number,
  tileM = ARENA_CONCRETE_TILE_M,
): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(width, height, depth);
  applyBoxMeterUVs(geo, width, height, depth, tileM);
  return geo;
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

export function cloneArenaConcreteRoughnessMap(
  repeatX: number,
  repeatY: number,
): THREE.Texture | null {
  if (!baseConcreteRoughness) return null;
  const map = baseConcreteRoughness.clone();
  map.repeat.set(repeatX, repeatY);
  map.needsUpdate = true;
  return map;
}

function buildRoughnessMapFromAlbedo(
  img: CanvasImageSource & { width: number; height: number },
): THREE.CanvasTexture {
  const w = img.width;
  const h = img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d canvas unavailable');
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const mid = 0.5;
  for (let i = 0; i < data.data.length; i += 4) {
    const lum =
      (data.data[i] * 0.299 +
        data.data[i + 1] * 0.587 +
        data.data[i + 2] * 0.114) /
      255;
    // Dark grout / pores → rougher; lighter flats → smoother (more specular catch).
    let rough = 1 - lum;
    rough = (rough - mid) * ROUGHNESS_MAP_CONTRAST + mid;
    rough = Math.max(0.1, Math.min(0.98, rough * 0.9 + 0.06));
    const v = Math.round(rough * 255);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 8;
  return tex;
}

new THREE.TextureLoader().load(
  concreteUrl,
  (tex) => {
    configureBase(tex);
    baseConcrete = tex;
    const img = tex.image;
    if (img && typeof img === 'object' && 'width' in img && 'height' in img) {
      baseConcreteRoughness = buildRoughnessMapFromAlbedo(
        img as CanvasImageSource & { width: number; height: number },
      );
      baseConcreteRoughness.repeat.copy(tex.repeat);
    }
    notifyLoaded();
  },
  undefined,
  (err) => {
    console.warn('[arena] concrete texture failed to load', err);
  },
);
