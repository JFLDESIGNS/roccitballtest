import * as THREE from 'three';

let arenaEnvMap: THREE.Texture | null = null;

/** Lightweight gradient cubemap for metal reflections (no HDR load) */
export function getArenaEnvMap(): THREE.CubeTexture {
  if (arenaEnvMap) return arenaEnvMap as THREE.CubeTexture;

  const size = 64;
  const faces: HTMLCanvasElement[] = [];
  const skyTop = '#5eb0f0';
  const skyHorizon = '#8fd0f8';
  const ground = '#2a323c';

  for (let f = 0; f < 6; f++) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, size);
      if (f === 2) {
        g.addColorStop(0, skyTop);
        g.addColorStop(1, skyHorizon);
      } else if (f === 3) {
        g.addColorStop(0, ground);
        g.addColorStop(1, '#1a2028');
      } else {
        g.addColorStop(0, skyHorizon);
        g.addColorStop(0.55, '#4a5a6e');
        g.addColorStop(1, ground);
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
    faces.push(canvas);
  }

  const cube = new THREE.CubeTexture(faces);
  cube.colorSpace = THREE.SRGBColorSpace;
  cube.needsUpdate = true;
  arenaEnvMap = cube;
  return cube;
}

export function disposeArenaEnvMap(): void {
  arenaEnvMap?.dispose();
  arenaEnvMap = null;
}
