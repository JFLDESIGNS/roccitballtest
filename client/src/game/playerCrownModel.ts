import * as THREE from 'three';

export const PLAYER_CROWN_MODEL_URL = new URL(
  '../assets/models/Crown/source/Crown.fbx',
  import.meta.url,
).href;

export const CROWN_TEXTURE_URLS = {
  albedo: new URL(
    '../assets/models/Crown/textures/Crown_BaseColor.png',
    import.meta.url,
  ).href,
  metal: new URL(
    '../assets/models/Crown/textures/Crown_Metallic.png',
    import.meta.url,
  ).href,
  normal: new URL(
    '../assets/models/Crown/textures/Crown_Normal.png',
    import.meta.url,
  ).href,
  rough: new URL(
    '../assets/models/Crown/textures/Crown_Roughness.png',
    import.meta.url,
  ).href,
} as const;

export type CrownMaterialMaps = {
  map: THREE.Texture;
  metalnessMap: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  material: THREE.MeshStandardMaterial;
};

function loadTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
): THREE.Texture {
  const tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = colorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function loadCrownMaterialMaps(): CrownMaterialMaps {
  const map = loadTexture(CROWN_TEXTURE_URLS.albedo, THREE.SRGBColorSpace);
  const metalnessMap = loadTexture(
    CROWN_TEXTURE_URLS.metal,
    THREE.NoColorSpace,
  );
  const normalMap = loadTexture(CROWN_TEXTURE_URLS.normal, THREE.NoColorSpace);
  const roughnessMap = loadTexture(
    CROWN_TEXTURE_URLS.rough,
    THREE.NoColorSpace,
  );

  const material = new THREE.MeshStandardMaterial({
    map,
    metalnessMap,
    roughnessMap,
    normalMap,
    metalness: 0.92,
    roughness: 0.82,
    color: 0xffffff,
    emissiveMap: map,
    emissive: 0xffffff,
    emissiveIntensity: 0.08,
  });

  return { map, metalnessMap, normalMap, roughnessMap, material };
}

export function disposeCrownMaterialMaps(maps: CrownMaterialMaps): void {
  maps.map.dispose();
  maps.metalnessMap.dispose();
  maps.normalMap.dispose();
  maps.roughnessMap.dispose();
  maps.material.dispose();
}
