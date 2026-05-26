import * as THREE from 'three';
import { octagonVertices } from './arenaOctagon';

/** Sits above hex floor to avoid z-fighting */
export const GROUND_BLOB_SHADOW_LIFT = 0.06;
export const GROUND_BLOB_SHADOW_RENDER_ORDER = 8;

let octagonTex: THREE.CanvasTexture | null = null;
let goalEllipseTex: THREE.CanvasTexture | null = null;
/** Bump when goal blob bake changes so dev HMR picks up new alpha */
const GOAL_BLOB_TEX_VERSION = 3;
let goalBlobTexBuiltVersion = 0;

/** Alpha-only decal — transparent outside the gradient, dark center only */
export function createGroundBlobShadowMaterial(
  map: THREE.CanvasTexture,
): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    opacity: 1,
    alphaTest: 0.02,
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
  // Fade to zero well inside the painted radius so UV edges stay invisible.
  g.addColorStop(0, 'rgba(0, 0, 0, 0.88)');
  g.addColorStop(0.32, 'rgba(0, 0, 0, 0.52)');
  g.addColorStop(0.58, 'rgba(0, 0, 0, 0.2)');
  g.addColorStop(0.78, 'rgba(0, 0, 0, 0.04)');
  g.addColorStop(0.92, 'rgba(0, 0, 0, 0)');
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
  if (goalEllipseTex && goalBlobTexBuiltVersion === GOAL_BLOB_TEX_VERSION) {
    return goalEllipseTex;
  }
  goalEllipseTex?.dispose();
  goalEllipseTex = null;

  const size = 512;
  const margin = 20;
  const scaleX = 1.55;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2;
    const cy = size / 2;
    // Keep the scaled ellipse inside the canvas — old r=0.48*256*1.55 clipped the sides.
    const r = (size / 2 - margin) / scaleX;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scaleX, 1);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    addShadowGradientStopsSoft(g);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();

    // Guarantee a fully transparent border (no square fringe from filtering).
    ctx.clearRect(0, 0, margin, size);
    ctx.clearRect(size - margin, 0, margin, size);
    ctx.clearRect(0, 0, size, margin);
    ctx.clearRect(0, size - margin, size, margin);
  }

  goalEllipseTex = new THREE.CanvasTexture(canvas);
  goalEllipseTex.colorSpace = THREE.SRGBColorSpace;
  goalEllipseTex.generateMipmaps = false;
  goalEllipseTex.minFilter = THREE.LinearFilter;
  goalEllipseTex.magFilter = THREE.LinearFilter;
  goalEllipseTex.wrapS = THREE.ClampToEdgeWrapping;
  goalEllipseTex.wrapT = THREE.ClampToEdgeWrapping;
  goalEllipseTex.needsUpdate = true;
  goalBlobTexBuiltVersion = GOAL_BLOB_TEX_VERSION;
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
