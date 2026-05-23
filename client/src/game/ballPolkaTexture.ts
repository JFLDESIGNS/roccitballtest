import * as THREE from 'three';

/** Large high-contrast polka dots so ball spin reads clearly */
export function createBallPolkaTexture(size = 1024): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    fallback.colorSpace = THREE.SRGBColorSpace;
    return fallback;
  }

  ctx.fillStyle = '#ffe833';
  ctx.fillRect(0, 0, size, size);

  const cols = 4;
  const rows = 4;
  const cell = size / cols;
  const dotR = cell * 0.42;
  const dotColors = ['#1a2a6e', '#e6194b', '#ffffff', '#0d9488'];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const stagger = row % 2 === 1 ? cell * 0.5 : 0;
      const cx = col * cell + cell * 0.5 + stagger;
      const cy = row * cell + cell * 0.5;
      const x = ((cx % size) + size) % size;
      const y = ((cy % size) + size) % size;

      ctx.fillStyle = dotColors[(row * cols + col) % dotColors.length];
      ctx.beginPath();
      ctx.arc(x, y, dotR, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = Math.max(2, size * 0.004);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 16;
  texture.needsUpdate = true;
  return texture;
}
