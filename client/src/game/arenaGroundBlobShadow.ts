import * as THREE from 'three';
import { octagonVertices } from './arenaOctagon';

/** Sits above hex floor to avoid z-fighting */
export const GROUND_BLOB_SHADOW_LIFT = 0.06;
export const GROUND_BLOB_SHADOW_RENDER_ORDER = 8;

let octagonTex: THREE.CanvasTexture | null = null;
let goalEllipseTex: THREE.CanvasTexture | null = null;

/** Alpha-only decal — transparent outside the gradient, dark center only */
export function createGroundBlobShadowMaterial(
  map: THREE.CanvasTexture,
): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

function addShadowGradientStopsStrong(g: CanvasGradient): void {
  // Stronger, more visible platform contact shadow.
  g.addColorStop(0, 'rgba(0, 0, 0, 0.98)');
  g.addColorStop(0.24, 'rgba(0, 0, 0, 0.72)');
  g.addColorStop(0.5, 'rgba(0, 0, 0, 0.38)');
  g.addColorStop(0.72, 'rgba(0, 0, 0, 0.14)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
}

function addShadowGradientStopsSoft(g: CanvasGradient): void {
  // Softer goal blob; still fades to fully transparent at edges.
  g.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
  g.addColorStop(0.3, 'rgba(0, 0, 0, 0.6)');
  g.addColorStop(0.56, 'rgba(0, 0, 0, 0.3)');
  g.addColorStop(0.78, 'rgba(0, 0, 0, 0.1)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
}

/** Square XZ plane — shape comes from the baked alpha texture */
export function createBlobShadowPlaneGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** Octagon contact shadow for ramp decks (matches platform footprint) */
export function getOctagonPlatformShadowTexture(): THREE.CanvasTexture {
  if (octagonTex) return octagonTex;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.5;
    const cornerR = r * 0.96;
    ctx.beginPath();
    const verts = octagonVertices(1);
    for (let i = 0; i < 8; i++) {
      const px = cx + verts[i].x * cornerR;
      const py = cy + verts[i].y * cornerR;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cornerR);
    addShadowGradientStopsStrong(g);
    ctx.fillStyle = g;
    ctx.fill();
  }
  octagonTex = new THREE.CanvasTexture(canvas);
  octagonTex.colorSpace = THREE.SRGBColorSpace;
  octagonTex.generateMipmaps = false;
  octagonTex.minFilter = THREE.LinearFilter;
  octagonTex.magFilter = THREE.LinearFilter;
  return octagonTex;
}

/** Elliptical radial shadow for a full goal stack on an end wall */
export function getGoalFloorShadowTexture(): THREE.CanvasTexture {
  if (goalEllipseTex) return goalEllipseTex;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.48;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1.55, 1);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    addShadowGradientStopsSoft(g);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }
  goalEllipseTex = new THREE.CanvasTexture(canvas);
  goalEllipseTex.colorSpace = THREE.SRGBColorSpace;
  goalEllipseTex.generateMipmaps = false;
  goalEllipseTex.minFilter = THREE.LinearFilter;
  goalEllipseTex.magFilter = THREE.LinearFilter;
  return goalEllipseTex;
}

/** @deprecated use createBlobShadowPlaneGeometry */
export function createOctagonFloorShadowGeometry(): THREE.BufferGeometry {
  return createBlobShadowPlaneGeometry();
}

/** @deprecated import getOctagonPlatformShadowTexture from arenaGroundBlobShadow */
export function getArenaPlatformGroundShadowTexture(): THREE.CanvasTexture {
  return getOctagonPlatformShadowTexture();
}
