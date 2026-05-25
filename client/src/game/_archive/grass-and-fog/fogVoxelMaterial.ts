import * as THREE from 'three';

let radialMap: THREE.Texture | null = null;
const FOG_RADIAL_VERSION = 4;
let radialVersion = -1;

/** Soft white puff — always faces camera when used on PointsMaterial */
export function getFogRadialTexture(): THREE.Texture {
  if (radialMap && radialVersion === FOG_RADIAL_VERSION) return radialMap;
  radialMap?.dispose();
  radialMap = null;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    g.addColorStop(0, 'rgba(255,255,255,0.45)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.16)');
    g.addColorStop(0.74, 'rgba(255,255,255,0.05)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  radialMap = new THREE.CanvasTexture(canvas);
  radialMap.colorSpace = THREE.SRGBColorSpace;
  radialMap.wrapS = radialMap.wrapT = THREE.ClampToEdgeWrapping;
  radialVersion = FOG_RADIAL_VERSION;
  return radialMap;
}

/** @deprecated Points use getFogRadialTexture + PointsMaterial */
export function createFogVoxelMaterial(): THREE.PointsMaterial {
  return new THREE.PointsMaterial({
    map: getFogRadialTexture(),
    size: 12,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
}
