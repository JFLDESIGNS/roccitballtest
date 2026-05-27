import * as THREE from 'three';
import { ARENA_PADS } from '../shared/Constants';
import { JUMP_PAD_EMISSIVE_IDLE } from './jumpPadGlow';
import { getArenaEnvMap } from './arenaEnvMap';
import { applyArenaMetalWearShader } from './arenaMetalWear';
import { ARENA_PILLAR } from './arenaPillarConfig';
import {
  ARENA_CONCRETE_TILE_M,
  cloneArenaConcreteMap,
  cloneArenaConcreteRoughnessMap,
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

/** Base scalar — variation comes from roughnessMap (concrete albedo-derived). */
const ARENA_CONCRETE_ROUGHNESS = 1;
const ARENA_CONCRETE_METALNESS = 0.1;
const ARENA_CONCRETE_ENV_INTENSITY = 0.48;
/** Shared wall + floor concrete (same maps and color) */
const ARENA_WALL_FLOOR_CONCRETE_COLOR = '#2a3038';

function createArenaConcreteSurfaceMaterial(
  color: string,
  flatShading = false,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: ARENA_CONCRETE_ROUGHNESS,
    metalness: ARENA_CONCRETE_METALNESS,
    flatShading,
    emissive: '#000000',
    emissiveIntensity: 0,
    envMap: arenaMetalEnv,
    envMapIntensity: ARENA_CONCRETE_ENV_INTENSITY,
    fog: false,
  });
}

function bindWallFloorConcrete(
  mat: THREE.MeshStandardMaterial,
  repeatX: number,
  repeatY: number,
): void {
  const map = cloneArenaConcreteMap(repeatX, repeatY);
  if (!map) return;
  mat.map = map;
  const roughMap = cloneArenaConcreteRoughnessMap(repeatX, repeatY);
  if (roughMap) {
    mat.roughnessMap = roughMap;
    mat.roughness = ARENA_CONCRETE_ROUGHNESS;
  } else {
    mat.roughnessMap = null;
    mat.roughness = 0.62;
  }
  mat.envMap = arenaMetalEnv;
  mat.envMapIntensity = ARENA_CONCRETE_ENV_INTENSITY;
  mat.metalness = ARENA_CONCRETE_METALNESS;
  mat.emissive.set('#000000');
  mat.emissiveIntensity = 0;
  mat.needsUpdate = true;
}

/** Pillars / pads — albedo only (no roughness map). */
function bindConcrete(
  mat: THREE.MeshStandardMaterial,
  repeatX: number,
  repeatY: number,
): void {
  const map = cloneArenaConcreteMap(repeatX, repeatY);
  if (!map) return;
  mat.map = map;
  mat.roughnessMap = null;
  mat.envMap = arenaMetalEnv;
  mat.envMapIntensity = ARENA_CONCRETE_ENV_INTENSITY;
  mat.roughness = 0.56;
  mat.metalness = ARENA_CONCRETE_METALNESS;
  mat.emissive.set('#000000');
  mat.emissiveIntensity = 0;
  mat.needsUpdate = true;
}

/** Hex perimeter walls — grey concrete (darker than pillars) */
export const arenaWallMaterial = createArenaConcreteSurfaceMaterial(
  ARENA_WALL_FLOOR_CONCRETE_COLOR,
);

/** Corner pillars */
export const arenaPillarMaterial = createArenaConcreteSurfaceMaterial('#5a626c');

/** Pillar bands — glossy dark metal */
export const arenaBlackMetalMaterial = new THREE.MeshStandardMaterial({
  color: '#14161a',
  roughness: 0.32,
  metalness: 0.94,
});

/** Goal backing rings + hole caps — deep matte black, no sky IBL/fog fill */
export const goalBackRingMaterial = new THREE.MeshStandardMaterial({
  color: '#050608',
  roughness: 1,
  metalness: 0,
  emissive: '#000000',
  emissiveIntensity: 0,
  envMap: null,
  envMapIntensity: 0,
  fog: false,
});

/** Legacy concrete floor (map editor fallback) */
export const arenaFloorMaterial = new THREE.MeshStandardMaterial({
  color: ARENA_WALL_FLOOR_CONCRETE_COLOR,
  roughness: ARENA_CONCRETE_ROUGHNESS,
  metalness: ARENA_CONCRETE_METALNESS,
  envMap: arenaMetalEnv,
  envMapIntensity: ARENA_CONCRETE_ENV_INTENSITY,
  fog: false,
});

/** Hex arena floor — same concrete as walls; DoubleSide in case winding varies */
export const arenaHexFloorMaterial = (() => {
  const mat = createArenaConcreteSurfaceMaterial(ARENA_WALL_FLOOR_CONCRETE_COLOR);
  mat.side = THREE.DoubleSide;
  return mat;
})();

/** Trampoline / pad stone ring bases */
export const arenaPadStoneMaterial =
  createArenaConcreteSurfaceMaterial('#5a626c');

/** Octagon ramp — dark shiny metal, flat facets */
export const arenaPlatformMaterial = new THREE.MeshStandardMaterial({
  map: darkDeckMetalMap,
  color: '#3a424c',
  metalness: 0.88,
  roughness: 0.28,
  flatShading: true,
  envMap: arenaMetalEnv,
  envMapIntensity: 0.28,
  fog: false,
});
applyArenaMetalWearShader(arenaPlatformMaterial, {
  scratchStrength: 0.42,
  wearStrength: 0.26,
});

/** Octagon deck cap — slightly brighter dark metal */
export const arenaPlatformTopMaterial = new THREE.MeshStandardMaterial({
  map: darkDeckMetalMap,
  color: '#454f5a',
  metalness: 0.9,
  roughness: 0.24,
  flatShading: true,
  envMap: arenaMetalEnv,
  envMapIntensity: 0.32,
  fog: false,
});
applyArenaMetalWearShader(arenaPlatformTopMaterial, {
  scratchStrength: 0.48,
  wearStrength: 0.3,
});

/** Jump / bounce pad top deck — smooth shaded cyan glow; pulse on launch via jumpPadGlow */
export const arenaJumpPadTopMaterial = new THREE.MeshStandardMaterial({
  color: '#e4ecff',
  emissive: '#d8e8ff',
  emissiveIntensity: JUMP_PAD_EMISSIVE_IDLE,
  metalness: 0.06,
  roughness: 0.32,
  flatShading: false,
  toneMapped: false,
  fog: false,
});

/** @deprecated use arenaJumpPadTopMaterial */
export const arenaTrampolineDeckMaterial = arenaJumpPadTopMaterial;

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

  bindWallFloorConcrete(arenaWallMaterial, 1, 1);
  /** Floor UVs are already meter-tiled in createArenaHexFloorGeometry — repeat must stay 1× */
  bindWallFloorConcrete(arenaHexFloorMaterial, 1, 1);
  bindConcrete(arenaPillarMaterial, pillarRep.u, pillarRep.v);
  bindConcrete(arenaPadStoneMaterial, padRep.u, padRep.v);
}

onArenaConcreteReady(applyAllConcreteMaps);
