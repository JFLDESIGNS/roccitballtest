import * as THREE from 'three';

const LOGO_URL = new URL(
  '../assets/images/logo/RoccitLogo.png',
  import.meta.url,
).href;

let texturePromise: Promise<THREE.Texture> | null = null;
let cachedTexture: THREE.Texture | null = null;

export function getRocccitLogoUrl(): string {
  return LOGO_URL;
}

/** Shared stadium / UI logo texture */
export function loadRocccitLogoTexture(): Promise<THREE.Texture> {
  if (cachedTexture) return Promise.resolve(cachedTexture);
  if (!texturePromise) {
    texturePromise = new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        LOGO_URL,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 8;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.generateMipmaps = true;
          cachedTexture = tex;
          resolve(tex);
        },
        undefined,
        reject,
      );
    });
  }
  return texturePromise;
}
