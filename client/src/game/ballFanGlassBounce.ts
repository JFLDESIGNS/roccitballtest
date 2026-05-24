import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { BALL, SUPERBALL } from '../shared/Constants';
import { getFanGlassPanels } from './fanGlassHit';
import { tuningStore } from './tuningStore';

const _p = new THREE.Vector3();
const _v = new THREE.Vector3();

/** Stable specular bounce off fan-glass — thin Rapier colliders skew superball ricochets. */
export function sanitizeFanGlassBallBounce(body: RapierRigidBody): void {
  if (tuningStore.getState().ballType !== 'superball') return;

  const panels = getFanGlassPanels();
  if (panels.length === 0) return;

  const t = body.translation();
  _p.set(t.x, t.y, t.z);
  const lv = body.linvel();
  _v.set(lv.x, lv.y, lv.z);
  const speed = _v.length();
  if (speed < 6) return;

  const radius = BALL.radius;
  const rest = SUPERBALL.fanGlassRestitution;

  for (const panel of panels) {
    const nx = panel.outwardNormal.x;
    const ny = panel.outwardNormal.y;
    const nz = panel.outwardNormal.z;
    const cx = panel.courtFaceCenter.x;
    const cy = panel.courtFaceCenter.y;
    const cz = panel.courtFaceCenter.z;

    const dist =
      (_p.x - cx) * nx + (_p.y - cy) * ny + (_p.z - cz) * nz;
    if (dist < -radius * 0.35 || dist > radius * 1.35) continue;

    const vn = _v.x * nx + _v.y * ny + _v.z * nz;
    if (vn > -2.5) continue;

    const rx = _v.x - 2 * vn * nx;
    const ry = _v.y - 2 * vn * ny;
    const rz = _v.z - 2 * vn * nz;

    if (dist < radius * 0.55) {
      body.setTranslation(
        {
          x: t.x + nx * (radius * 0.55 - dist + 0.04),
          y: t.y + ny * (radius * 0.55 - dist + 0.04),
          z: t.z + nz * (radius * 0.55 - dist + 0.04),
        },
        true,
      );
    }

    body.setLinvel(
      {
        x: rx * rest,
        y: ry * rest,
        z: rz * rest,
      },
      true,
    );
    return;
  }
}
