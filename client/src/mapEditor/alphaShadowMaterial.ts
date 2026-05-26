import * as THREE from 'three';
import alphaShadowUrl from '../assets/images/alphashadow.jpg';
import {
  GROUND_BLOB_SHADOW_LIFT,
  GROUND_BLOB_SHADOW_RENDER_ORDER,
} from '../game/arenaGroundBlobShadow';

let alphaShadowTex: THREE.Texture | null = null;

export function getAlphaShadowTexture(): THREE.Texture {
  if (alphaShadowTex) return alphaShadowTex;
  const loader = new THREE.TextureLoader();
  const tex = loader.load(alphaShadowUrl);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  alphaShadowTex = tex;
  return tex;
}

/** Black fill with white-on-black image driving opacity via alphaMap. */
export function createAlphaShadowMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: 0x000000,
    alphaMap: getAlphaShadowTexture(),
    transparent: true,
    opacity: 1,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

export const ALPHA_SHADOW_RENDER_ORDER = GROUND_BLOB_SHADOW_RENDER_ORDER + 1;

/** Default Y lift when spawning on the floor (m). */
export const ALPHA_SHADOW_DEFAULT_LIFT = GROUND_BLOB_SHADOW_LIFT;
