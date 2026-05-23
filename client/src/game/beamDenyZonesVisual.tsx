import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { ROCKET } from '../shared/Constants';
import { getActiveBeamDenyZones, tickBeamDenyZones } from './beamDenyZones';

const RING_GEO = new THREE.RingGeometry(0.92, 1, 24);
const MAX_RINGS = 12;

type ZoneSlot = {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
};

function makeSlot(): ZoneSlot {
  const mat = new THREE.MeshBasicMaterial({
    color: '#ff4466',
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(RING_GEO, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.visible = false;
  return { mesh, mat };
}

/** Pooled deny rings — no React state updates per frame */
export function BeamDenyZonesVisual() {
  const slots = useMemo(() => Array.from({ length: MAX_RINGS }, makeSlot), []);

  useFrame(() => {
    tickBeamDenyZones();
    const zones = getActiveBeamDenyZones();
    const now = performance.now() / 1000;

    for (let i = 0; i < MAX_RINGS; i++) {
      const { mesh, mat } = slots[i];
      const zone = zones[i];
      if (!zone) {
        mesh.visible = false;
        continue;
      }
      const left = zone.until - now;
      if (left <= 0) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      mesh.position.set(zone.x, 0.06, zone.z);
      const t = 1 - left / ROCKET.beamDenyDurationSec;
      mat.opacity = (1 - t) * 0.5 + 0.1;
      const pulse = 1 + Math.sin(now * 12) * 0.035;
      mesh.scale.set(zone.radius * pulse, zone.radius * pulse, 1);
    }
  });

  return (
    <group>
      {slots.map((s, i) => (
        <primitive key={i} object={s.mesh} />
      ))}
    </group>
  );
}
