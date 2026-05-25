import * as THREE from 'three';
import { ARENA_PADS } from '../shared/Constants';
import { getArenaEnvMap } from './arenaEnvMap';
import { applyArenaMetalWearShader } from './arenaMetalWear';
import { ARENA_PILLAR } from './arenaPillarConfig';
import {
  ARENA_CONCRETE_TILE_M,
  cloneArenaConcreteMap,
  onArenaConcreteReady,
} from './arenaConcreteTexture';

const arenaMetalEnv = getArenaEnvMap();

function cylinderConcreteRepeat(
  radiusTop: number,
  radiusBottom: number,
  height: number,
): { u: number; v: number } {
  const r = (radiusTop + radiusBottom) * 0.5;
  const circ = Math.PI * 2 * r;
  return {
    u: circ / ARENA_CONCRETE_TILE_M,
    v: height / ARENA_CONCRETE_TILE_M,
  };
}

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
  return tex;
}

const metalMap = makeRepeatingCanvas(256, 256, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#9aa8b8');
  g.addColorStop(0.35, '#c8d4e0');
  g.addColorStop(0.55, '#7a8796');
  g.addColorStop(1, '#a8b6c6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 3) {
    ctx.fillStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.04})`;
    ctx.fillRect(0, y, w, 1);
  }
});
metalMap.repeat.set(4, 4);

const darkDeckMetalMap = makeRepeatingCanvas(256, 256, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#2a3038');
  g.addColorStop(0.4, '#3d4650');
  g.addColorStop(0.6, '#252b32');
  g.addColorStop(1, '#343c46');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 4) {
    ctx.fillStyle = `rgba(255,255,255,${0.015 + Math.random() * 0.025})`;
    ctx.fillRect(0, y, w, 1);
  }
});
darkDeckMetalMap.repeat.set(3, 3);

function bindConcrete(
  mat: THREE.MeshStandardMaterial,
  repeatX: number,
  repeatY: number,
): void {
  const map = cloneArenaConcreteMap(repeatX, repeatY);
  if (!map) return;
  mat.map = map;
  mat.needsUpdate = true;
}

/** Hex perimeter walls — grey concrete (darker than pillars) */
export const arenaWallMaterial = new THREE.MeshStandardMaterial({
  color: '#4a5159',
  roughness: 0.9,
  metalness: 0.04,
});

/** Corner pillars */
export const arenaPillarMaterial = new THREE.MeshStandardMaterial({
  color: '#5a626c',
  roughness: 0.92,
  metalness: 0.06,
});

/** Pillar bands — glossy dark metal */
export const arenaBlackMetalMaterial = new THREE.MeshStandardMaterial({
  color: '#14161a',
  roughness: 0.32,
  metalness: 0.94,
});

/** Goal backing rings + hole caps — flat matte black */
export const goalBackRingMaterial = new THREE.MeshStandardMaterial({
  color: '#0e0f12',
  roughness: 0.98,
  metalness: 0,
});

/** Legacy concrete floor (map editor fallback) */
export const arenaFloorMaterial = new THREE.MeshStandardMaterial({
  color: '#b8bec6',
  roughness: 0.9,
  metalness: 0.04,
});

export { arenaTurfMaterial } from './arenaTurfMaterial';

/** Hex arena floor — dark brown matte dirt under instanced grass */
export const arenaHexFloorMaterial = new THREE.MeshStandardMaterial({
  color: '#2e2218',
  roughness: 1,
  metalness: 0,
  envMapIntensity: 0,
});

/** Trampoline / pad stone ring bases */
export const arenaPadStoneMaterial = new THREE.MeshStandardMaterial({
  color: '#6a7582',
  roughness: 0.9,
  metalness: 0.05,
});

/** Center octagon + ramp platforms — dark brushed metal */
export const arenaPlatformMaterial = new THREE.MeshStandardMaterial({
  map: darkDeckMetalMap,
  color: '#6a7888',
  metalness: 0.7,
  roughness: 0.4,
  flatShading: true,
  envMap: arenaMetalEnv,
  envMapIntensity: 1.2,
});
applyArenaMetalWearShader(arenaPlatformMaterial, {
  scratchStrength: 0.5,
  wearStrength: 0.35,
});

/** Flat octagon cap on ramp platforms */
export const arenaDeckTopMaterial = new THREE.MeshStandardMaterial({
  map: darkDeckMetalMap,
  color: '#5a6674',
  metalness: 0.76,
  roughness: 0.36,
  flatShading: true,
  envMap: arenaMetalEnv,
  envMapIntensity: 1.3,
});
applyArenaMetalWearShader(arenaDeckTopMaterial, {
  scratchStrength: 0.45,
  wearStrength: 0.3,
});

/** Trampoline / pad pedestals — metal deck ring */
export const arenaPadMetalMaterial = new THREE.MeshStandardMaterial({
  map: metalMap,
  color: '#9aaab8',
  metalness: 0.68,
  roughness: 0.42,
  flatShading: true,
  envMap: arenaMetalEnv,
  envMapIntensity: 0.95,
});
applyArenaMetalWearShader(arenaPadMetalMaterial, {
  scratchStrength: 1.25,
  wearStrength: 0.9,
});

/** Ceiling — dark metal panel */
export const arenaCeilingMaterial = new THREE.MeshStandardMaterial({
  color: '#3d4654',
  metalness: 0.75,
  roughness: 0.45,
  side: THREE.DoubleSide,
});

function applyAllConcreteMaps(): void {
  const pillarRep = cylinderConcreteRepeat(
    ARENA_PILLAR.radiusTop,
    ARENA_PILLAR.radiusBase,
    ARENA_PILLAR.height,
  );
  const padStemR =
    ARENA_PADS.bouncePadRadiusM *
    ARENA_PADS.bouncePadWidthScale *
    ARENA_PADS.bouncePadSizeScale *
    1.15;
  const padStemH =
    ARENA_PADS.padPlatformHeightM +
    ARENA_PADS.trampolineDeckRaiseM;
  const padRep = cylinderConcreteRepeat(padStemR, padStemR * 1.22, padStemH);

  bindConcrete(arenaWallMaterial, 1, 1);
  bindConcrete(arenaPillarMaterial, pillarRep.u, pillarRep.v);
  bindConcrete(arenaPadStoneMaterial, padRep.u, padRep.v);
}

onArenaConcreteReady(applyAllConcreteMaps);
