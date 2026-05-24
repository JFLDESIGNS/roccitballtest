import * as THREE from 'three';
import type { BallTypeId } from '../shared/Constants';

/** Seamless sci-fi panel + hex grid for the match ball */
export function createBallPolkaTexture(
  size = 512,
  variant: BallTypeId = 'original',
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    fallback.colorSpace = THREE.SRGBColorSpace;
    return fallback;
  }

  const cx = size * 0.5;
  const cy = size * 0.5;
  const superball = variant === 'superball';

  const base = ctx.createRadialGradient(cx, cy, size * 0.05, cx, cy, size * 0.72);
  if (superball) {
    base.addColorStop(0, '#c4903a');
    base.addColorStop(0.45, '#6a4518');
    base.addColorStop(1, '#241408');
  } else {
    base.addColorStop(0, '#5a7a9a');
    base.addColorStop(0.45, '#2e3d52');
    base.addColorStop(1, '#141b24');
  }
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2;
    const a1 = ((i + 1) / 6) * Math.PI * 2;
    const r0 = size * 0.18;
    const r1 = size * 0.48;
    const g = ctx.createLinearGradient(
      cx + Math.cos(a0) * r0,
      cy + Math.sin(a0) * r0,
      cx + Math.cos(a1) * r1,
      cy + Math.sin(a1) * r1,
    );
    g.addColorStop(0, superball ? 'rgba(255, 180, 60, 0)' : 'rgba(80, 200, 255, 0)');
    g.addColorStop(0.5, superball ? 'rgba(255, 210, 90, 0.38)' : 'rgba(120, 230, 255, 0.35)');
    g.addColorStop(1, superball ? 'rgba(180, 90, 20, 0)' : 'rgba(40, 120, 200, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, size * 0.5, a0, a1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const hexR = size / 14;
  const hexH = hexR * Math.sqrt(3);
  ctx.strokeStyle = superball
    ? 'rgba(255, 190, 80, 0.34)'
    : 'rgba(90, 220, 255, 0.28)';
  ctx.lineWidth = Math.max(1, size * 0.0025);
  for (let row = -1; row < size / hexH + 2; row++) {
    for (let col = -1; col < size / (hexR * 1.5) + 2; col++) {
      const ox = col * hexR * 3 + (row % 2) * hexR * 1.5;
      const oy = row * hexH;
      drawHex(ctx, ox, oy, hexR * 0.92);
    }
  }

  ctx.strokeStyle = superball
    ? 'rgba(255, 220, 120, 0.58)'
    : 'rgba(160, 240, 255, 0.55)';
  ctx.lineWidth = Math.max(1.5, size * 0.004);
  const traces: [number, number, number, number][] = [
    [0.08, 0.42, 0.92, 0.38],
    [0.12, 0.68, 0.88, 0.22],
    [0.22, 0.12, 0.78, 0.55],
    [0.05, 0.55, 0.45, 0.82],
    [0.55, 0.08, 0.95, 0.48],
  ];
  for (const [x0, y0, x1, y1] of traces) {
    ctx.beginPath();
    ctx.moveTo(x0 * size, y0 * size);
    ctx.lineTo(x1 * size, y1 * size);
    ctx.stroke();
  }

  ctx.fillStyle = superball
    ? 'rgba(255, 200, 80, 0.88)'
    : 'rgba(120, 235, 255, 0.85)';
  const nodes = 18;
  for (let i = 0; i < nodes; i++) {
    const nx = ((i * 97) % 1000) / 1000;
    const ny = ((i * 57 + 13) % 1000) / 1000;
    const r = size * (0.008 + (i % 3) * 0.003);
    ctx.beginPath();
    ctx.arc(nx * size, ny * size, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = superball
    ? 'rgba(255, 230, 150, 0.42)'
    : 'rgba(200, 245, 255, 0.35)';
  ctx.lineWidth = size * 0.006;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.36, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = superball
    ? 'rgba(220, 140, 40, 0.28)'
    : 'rgba(60, 180, 240, 0.2)';
  ctx.lineWidth = size * 0.003;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.44, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 16;
  texture.needsUpdate = true;
  return texture;
}

function drawHex(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
}
