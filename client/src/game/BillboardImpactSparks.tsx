import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { tickImpactSparks } from './impactSparkBurst';

const MAX = 160;
const SEGMENT_VERTS = 2;
const STREAK_LENGTH_M = 0.42;

/**
 * World-space impact sparks as velocity streaks instead of round points.
 */
export function ImpactSparks() {
  const linesRef = useRef<THREE.LineSegments>(null);
  const positions = useMemo(
    () => new Float32Array(MAX * SEGMENT_VERTS * 3),
    [],
  );
  const colors = useMemo(
    () => new Float32Array(MAX * SEGMENT_VERTS * 3),
    [],
  );

  const hot = useMemo(() => new THREE.Color('#fff8e0'), []);
  const core = useMemo(() => new THREE.Color('#ffcc55'), []);
  const cool = useMemo(() => new THREE.Color('#9ee8ff'), []);
  const scratch = useMemo(() => new THREE.Color(), []);

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        depthTest: true,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
      }),
    [],
  );

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setDrawRange(0, 0);
    return geo;
  }, [positions, colors]);

  useFrame((_, dt) => {
    const lines = linesRef.current;
    if (!lines) return;

    const active = tickImpactSparks(dt);
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geometry.getAttribute('color') as THREE.BufferAttribute;

    let n = 0;
    for (let i = 0; i < active.length && n < MAX; i += 1) {
      const p = active[i]!;
      const t = p.life / p.maxLife;
      const speed = Math.hypot(p.vx, p.vy, p.vz);
      const dirX = speed > 0.0001 ? p.vx / speed : 0;
      const dirY = speed > 0.0001 ? p.vy / speed : 1;
      const dirZ = speed > 0.0001 ? p.vz / speed : 0;
      const streakLen = STREAK_LENGTH_M * (0.6 + Math.min(1.4, speed / 12));

      const base = n * SEGMENT_VERTS * 3;
      positions[base] = p.x;
      positions[base + 1] = p.y;
      positions[base + 2] = p.z;
      positions[base + 3] = p.x - dirX * streakLen;
      positions[base + 4] = p.y - dirY * streakLen;
      positions[base + 5] = p.z - dirZ * streakLen;

      scratch.copy(hot).lerp(t > 0.45 ? cool : core, 1 - t);
      colors[base] = scratch.r;
      colors[base + 1] = scratch.g;
      colors[base + 2] = scratch.b;
      colors[base + 3] = scratch.r * 0.35;
      colors[base + 4] = scratch.g * 0.35;
      colors[base + 5] = scratch.b * 0.35;
      n += 1;
    }

    geometry.setDrawRange(0, n * SEGMENT_VERTS);
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    lines.visible = n > 0;
  });

  return (
    <lineSegments
      ref={linesRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={2400}
    />
  );
}
