import * as THREE from 'three';
import { RENDER } from '../shared/Constants';
import { rocketTrailCamFade } from './trailCameraFade';

export const ROCKET_TRAIL_TUBE_SEGMENTS = 6;
/** Visible grey tube — ~half prior ribbon width */
export const ROCKET_TRAIL_TUBE_RADIUS = RENDER.rocketTrailRadius * 0.38;

const _dir = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _fallback = new THREE.Vector3(1, 0, 0);
const _right = new THREE.Vector3();
const _binormal = new THREE.Vector3();
const _trailColor = new THREE.Color();

export function createRocketTrailMaterial(
  explosive: boolean,
): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: explosive ? '#3a3129' : '#2d2b28',
    vertexColors: true,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

export function makeRocketTrailTubeGeometry(
  maxPoints: number,
  segments: number,
): THREE.BufferGeometry {
  const maxVerts = maxPoints * segments;
  const positions = new Float32Array(maxVerts * 3);
  const colors = new Float32Array(maxVerts * 3);
  const indices: number[] = [];
  for (let i = 0; i < maxPoints - 1; i++) {
    const ringA = i * segments;
    const ringB = (i + 1) * segments;
    for (let s = 0; s < segments; s++) {
      const sn = (s + 1) % segments;
      indices.push(ringA + s, ringB + s, ringA + sn, ringA + sn, ringB + s, ringB + sn);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  return geo;
}

export function updateRocketTrailTube(
  mesh: THREE.Mesh,
  material: THREE.MeshBasicMaterial,
  history: THREE.Vector3[],
  explosive: boolean,
  camPos: THREE.Vector3,
  opacityMul: number,
  tubeRadius = ROCKET_TRAIL_TUBE_RADIUS,
  tubeSegments = ROCKET_TRAIL_TUBE_SEGMENTS,
): void {
  const n = history.length;
  if (n < 2) {
    mesh.visible = false;
    return;
  }

  mesh.visible = true;
  material.opacity = 0.78 * opacityMul;
  material.color.set(explosive ? '#3a3129' : '#2d2b28');
  _trailColor.copy(material.color);

  const geo = mesh.geometry;
  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;

  for (let i = 0; i < n; i++) {
    if (i < n - 1) {
      _dir.subVectors(history[i + 1]!, history[i]!);
    } else {
      _dir.subVectors(history[i]!, history[i - 1]!);
    }
    if (_dir.lengthSq() < 1e-8) _dir.set(0, 0, 1);
    _dir.normalize();

    _right.crossVectors(_dir, _worldUp);
    if (_right.lengthSq() < 1e-8) _right.crossVectors(_dir, _fallback);
    _right.normalize();
    _binormal.crossVectors(_right, _dir).normalize();

    const p = history[i]!;
    const along = n <= 1 ? 1 : i / (n - 1);
    const fade =
      (0.4 + 0.6 * along) * rocketTrailCamFade(p, camPos) * opacityMul;
    const r = tubeRadius * (0.5 + fade * 0.48);

    for (let s = 0; s < tubeSegments; s++) {
      const ang = (s / tubeSegments) * Math.PI * 2;
      const cx = Math.cos(ang) * r;
      const cz = Math.sin(ang) * r;
      const vi = i * tubeSegments + s;
      posAttr.setXYZ(
        vi,
        p.x + _right.x * cx + _binormal.x * cz,
        p.y + _right.y * cx + _binormal.y * cz,
        p.z + _right.z * cx + _binormal.z * cz,
      );
      colAttr.setXYZ(
        vi,
        _trailColor.r * fade,
        _trailColor.g * fade,
        _trailColor.b * fade,
      );
    }
  }

  posAttr.needsUpdate = true;
  colAttr.needsUpdate = true;
  geo.setDrawRange(0, Math.max(0, (n - 1) * tubeSegments * 6));
}
