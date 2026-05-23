import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { ARENA } from '../shared/Constants';
import { graphicsStore } from './graphicsStore';
import type { ActiveRocket } from './rocketSystem';

const POOL = 160;
const CULL_RADIUS = 2.4;

type ArenaAtmosphereProps = {
  rocketsRef: React.RefObject<ActiveRocket[]>;
};

function distPointToSegment(
  px: number,
  py: number,
  pz: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;
  const abLenSq = abx * abx + aby * aby + abz * abz;
  const t =
    abLenSq > 1e-6
      ? Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / abLenSq))
      : 0;
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  const cz = az + abz * t;
  return Math.hypot(px - cx, py - cy, pz - cz);
}

/** Soft floating dust — culled when rockets pass through */
export function ArenaAtmosphere({ rocketsRef }: ArenaAtmosphereProps) {
  const gfx = useSyncExternalStore(
    graphicsStore.subscribe,
    graphicsStore.getState,
  );

  const pointsRef = useRef<THREE.Points>(null);
  const count = gfx.atmosphere ? Math.min(gfx.particleCount, POOL) : 0;

  const { geometry, base, seeds, alive } = useMemo(() => {
    const positions = new Float32Array(POOL * 3);
    const basePos = new Float32Array(POOL * 3);
    const seed = new Float32Array(POOL * 3);
    const aliveMask = new Uint8Array(POOL);
    aliveMask.fill(1);
    const r = ARENA.hexRadius * 0.88;
    for (let i = 0; i < POOL; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * r;
      const x = Math.cos(a) * dist;
      const y = 6 + Math.random() * 32;
      const z = Math.sin(a) * dist;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      basePos[i * 3] = x;
      basePos[i * 3 + 1] = y;
      basePos[i * 3 + 2] = z;
      seed[i * 3] = Math.random() * Math.PI * 2;
      seed[i * 3 + 1] = 0.4 + Math.random() * 0.85;
      seed[i * 3 + 2] = 0.55 + Math.random() * 1.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { geometry: geo, base: basePos, seeds: seed, alive: aliveMask };
  }, []);

  useFrame(({ clock }) => {
    if (!gfx.atmosphere || count <= 0 || !pointsRef.current) return;

    const rockets = rocketsRef.current;
    for (const r of rockets) {
      const px = r.position.x;
      const py = r.position.y;
      const pz = r.position.z;
      const sx = r.segmentStart.x;
      const sy = r.segmentStart.y;
      const sz = r.segmentStart.z;
      for (let i = 0; i < count; i++) {
        if (!alive[i]) continue;
        const i3 = i * 3;
        const bx = base[i3];
        const by = base[i3 + 1];
        const bz = base[i3 + 2];
        const d = distPointToSegment(
          bx,
          by,
          bz,
          sx,
          sy,
          sz,
          px,
          py,
          pz,
        );
        if (d < CULL_RADIUS) {
          alive[i] = 0;
        }
      }
    }

    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      if (!alive[i]) {
        pos.setXYZ(i, 0, -500, 0);
        continue;
      }
      const bx = seeds[i * 3];
      const spd = seeds[i * 3 + 1];
      const amp = seeds[i * 3 + 2];
      pos.setX(i, base[i3] + Math.sin(t * 0.22 + bx) * 0.55);
      pos.setY(
        i,
        base[i3 + 1] +
          Math.sin(t * spd + bx) * amp +
          Math.sin(t * 0.18 + i * 0.09) * 0.85,
      );
      pos.setZ(i, base[i3 + 2] + Math.cos(t * 0.19 + bx) * 0.55);
    }
    pos.needsUpdate = true;
  });

  if (!gfx.atmosphere || count <= 0) return null;

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        color="#9ed8ff"
        size={gfx.particleSize}
        transparent
        opacity={gfx.particleOpacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
        toneMapped={false}
      />
    </points>
  );
}
