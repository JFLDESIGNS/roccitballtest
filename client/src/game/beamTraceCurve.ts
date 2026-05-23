import * as THREE from 'three';

const CURVE_SEGMENTS = 28;
const _curvePoints: THREE.Vector3[] = [];

function curvePoint(i: number): THREE.Vector3 {
  if (!_curvePoints[i]) _curvePoints[i] = new THREE.Vector3();
  return _curvePoints[i];
}

/** Tight laser-like path with light squiggle */
export function buildLaserBeamCurve(
  from: THREE.Vector3,
  to: THREE.Vector3,
  time: number,
  phase: number,
  wiggleScale = 0.38,
): THREE.CatmullRomCurve3 {
  for (let i = 0; i <= CURVE_SEGMENTS; i++) {
    const u = i / CURVE_SEGMENTS;
    const p = curvePoint(i).lerpVectors(from, to, u);
    if (i > 0 && i < CURVE_SEGMENTS) {
      const envelope = Math.sin(Math.PI * u) ** 1.25;
      const sway =
        Math.sin(time * 30 + phase + u * 24) * envelope * 0.72 * wiggleScale;
      const swayZ =
        Math.cos(time * 26 + phase * 1.15 + u * 20) * envelope * 0.58 * wiggleScale;
      const swayY =
        Math.sin(time * 34 + phase * 2 + u * 16) * envelope * 0.35 * wiggleScale;
      p.x += sway;
      p.y += swayY;
      p.z += swayZ;
    }
  }
  const slice = _curvePoints.slice(0, CURVE_SEGMENTS + 1);
  return new THREE.CatmullRomCurve3(slice);
}

/** Wide wiggly path (legacy / optional) */
export function buildWigglyBeamCurve(
  from: THREE.Vector3,
  to: THREE.Vector3,
  time: number,
  phase: number,
  wiggleScale = 1,
): THREE.CatmullRomCurve3 {
  const segments = 18;
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const p = curvePoint(i).lerpVectors(from, to, u);
    if (i > 0 && i < segments) {
      const envelope = Math.sin(Math.PI * u);
      const sway =
        (Math.sin(time * 22 + phase + u * 16) * envelope * 3.2 +
          Math.sin(time * 33 + phase * 1.4 + u * 10) * envelope * 1.6) *
        wiggleScale;
      const swayZ =
        Math.cos(time * 19 + phase * 0.9 + u * 12) * envelope * 2.6 * wiggleScale;
      const swayY =
        Math.sin(time * 27 + phase * 2.1 + u * 8) * envelope * 1.35 * wiggleScale;
      p.x += sway;
      p.y += swayY;
      p.z += swayZ;
    }
  }
  const slice = _curvePoints.slice(0, segments + 1);
  return new THREE.CatmullRomCurve3(slice);
}
