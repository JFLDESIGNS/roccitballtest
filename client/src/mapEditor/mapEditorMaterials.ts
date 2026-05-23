import * as THREE from 'three';
import {
  cloneArenaConcreteMap,
  getArenaConcreteTexture,
  onArenaConcreteReady,
} from '../game/arenaConcreteTexture';
import type { MapTextureId } from './mapEditorTypes';

function makeRepeatingCanvas(
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) paint(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.repeat.set(2, 2);
  return tex;
}

const metalTex = makeRepeatingCanvas(256, 256, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#9aa8b8');
  g.addColorStop(0.35, '#c8d4e0');
  g.addColorStop(0.55, '#7a8796');
  g.addColorStop(1, '#a8b6c6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
});

const darkMetalTex = makeRepeatingCanvas(256, 256, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#2a3038');
  g.addColorStop(0.4, '#3d4650');
  g.addColorStop(0.6, '#252b32');
  g.addColorStop(1, '#343c46');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
});

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

function cacheKey(textureId: MapTextureId, color: string): string {
  return `${textureId}:${color}`;
}

function buildMaterial(textureId: MapTextureId, color: string): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color });
  if (textureId === 'concrete') {
    const map = cloneArenaConcreteMap(2, 2) ?? getArenaConcreteTexture();
    if (map) {
      mat.map = map;
      mat.color.set('#ffffff');
    }
    mat.roughness = 0.9;
    mat.metalness = 0.05;
  } else if (textureId === 'metal') {
    mat.map = metalTex.clone();
    mat.map.repeat.set(2, 2);
    mat.metalness = 0.72;
    mat.roughness = 0.42;
  } else if (textureId === 'darkMetal') {
    mat.map = darkMetalTex.clone();
    mat.map.repeat.set(2, 2);
    mat.metalness = 0.82;
    mat.roughness = 0.46;
  } else {
    mat.roughness = 0.85;
    mat.metalness = 0.08;
  }
  return mat;
}

export function getMapObjectMaterial(
  textureId: MapTextureId,
  color: string,
): THREE.MeshStandardMaterial {
  const key = cacheKey(textureId, color);
  const hit = materialCache.get(key);
  if (hit) return hit;
  const mat = buildMaterial(textureId, color);
  materialCache.set(key, mat);
  return mat;
}

onArenaConcreteReady(() => {
  materialCache.clear();
});

export function disposeMapEditorMaterials(): void {
  for (const mat of materialCache.values()) mat.dispose();
  materialCache.clear();
}
