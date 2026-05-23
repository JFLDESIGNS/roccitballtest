import * as THREE from 'three';
import { ARENA_PADS } from '../shared/Constants';
import { ARENA_PILLAR } from './arenaPillars';
import {
  ARENA_CONCRETE_TILE_M,
  arenaFloorConcreteRepeat,
  cloneArenaConcreteMap,
  onArenaConcreteReady,
} from './arenaConcreteTexture';

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

/** Hex perimeter walls */
export const arenaWallMaterial = new THREE.MeshStandardMaterial({
  color: '#666c74',
  roughness: 0.9,
  metalness: 0.04,
});

/** Corner pillars */
export const arenaPillarMaterial = new THREE.MeshStandardMaterial({
  color: '#5a626c',
  roughness: 0.92,
  metalness: 0.06,
});

/** Pillar bands, goal back-rings, caps */
export const arenaBlackMetalMaterial = new THREE.MeshStandardMaterial({
  color: '#14161a',
  roughness: 0.32,
  metalness: 0.94,
});

/** Main arena floor */
export const arenaFloorMaterial = new THREE.MeshStandardMaterial({
  color: '#b8bec6',
  roughness: 0.9,
  metalness: 0.04,
});

/** Hex floor tile overlays — same concrete, world-tiled */
export const arenaFloorTileMaterial = new THREE.MeshStandardMaterial({
  color: '#aeb6c0',
  roughness: 0.92,
  metalness: 0.03,
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
  color: '#4a535e',
  metalness: 0.78,
  roughness: 0.48,
  flatShading: true,
});

/** Flat octagon cap on ramp platforms */
export const arenaDeckTopMaterial = new THREE.MeshStandardMaterial({
  map: darkDeckMetalMap,
  color: '#3a424c',
  metalness: 0.8,
  roughness: 0.44,
  flatShading: true,
});

/** Trampoline / pad pedestals — metal deck ring */
export const arenaPadMetalMaterial = new THREE.MeshStandardMaterial({
  map: metalMap,
  color: '#9aaab8',
  metalness: 0.68,
  roughness: 0.42,
  flatShading: true,
});

/** Ceiling — dark metal panel */
export const arenaCeilingMaterial = new THREE.MeshStandardMaterial({
  color: '#3d4654',
  metalness: 0.75,
  roughness: 0.45,
  side: THREE.DoubleSide,
});

function applyAllConcreteMaps(): void {
  const floorRep = arenaFloorConcreteRepeat();
  const tileRep = (RENDER_HEX_TILE_RADIUS * 2) / ARENA_CONCRETE_TILE_M;
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

  bindConcrete(arenaWallMaterial, 5, 2.5);
  bindConcrete(arenaPillarMaterial, pillarRep.u, pillarRep.v);
  bindConcrete(arenaFloorMaterial, floorRep.x, floorRep.y);
  bindConcrete(arenaFloorTileMaterial, tileRep, tileRep);
  bindConcrete(arenaPadStoneMaterial, padRep.u, padRep.v);
}

/** Matches HexFloorTiles circle radius in Arena.tsx */
const RENDER_HEX_TILE_RADIUS = 2.1;

onArenaConcreteReady(applyAllConcreteMaps);
