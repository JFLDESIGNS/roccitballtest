import * as THREE from 'three';

let shadowTex: THREE.CanvasTexture | null = null;

/** Soft octagon contact shadow for raised deck ramps on the arena floor */
export function getArenaPlatformGroundShadowTexture(): THREE.CanvasTexture {
  if (shadowTex) return shadowTex;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.48;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i - Math.PI / 8;
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.clip();
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.05);
    g.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
    g.addColorStop(0.42, 'rgba(0, 0, 0, 0.48)');
    g.addColorStop(0.68, 'rgba(0, 0, 0, 0.22)');
    g.addColorStop(0.88, 'rgba(0, 0, 0, 0.06)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  shadowTex = new THREE.CanvasTexture(canvas);
  shadowTex.colorSpace = THREE.SRGBColorSpace;
  return shadowTex;
}
