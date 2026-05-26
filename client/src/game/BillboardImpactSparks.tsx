import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { tickImpactSparks } from './impactSparkBurst';

const MAX = 160;

/**
 * World-space impact sparks (billboards, etc.) — bright additive points, not smoke puffs.
 */
export function ImpactSparks() {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => new Float32Array(MAX * 3), []);
  const colors = useMemo(() => new Float32Array(MAX * 3), []);

  const hot = useMemo(() => new THREE.Color('#fff8e0'), []);
  const core = useMemo(() => new THREE.Color('#ffcc55'), []);
  const cool = useMemo(() => new THREE.Color('#9ee8ff'), []);
  const scratch = useMemo(() => new THREE.Color(), []);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.32,
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
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
    const pts = pointsRef.current;
    if (!pts) return;

    const active = tickImpactSparks(dt);
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geometry.getAttribute('color') as THREE.BufferAttribute;

    let n = 0;
    for (let i = 0; i < active.length && n < MAX; i++) {
      const p = active[i]!;
      const t = p.life / p.maxLife;
      const base = n * 3;
      positions[base] = p.x;
      positions[base + 1] = p.y;
      positions[base + 2] = p.z;

      scratch.copy(hot).lerp(t > 0.45 ? cool : core, 1 - t);
      colors[base] = scratch.r;
      colors[base + 1] = scratch.g;
      colors[base + 2] = scratch.b;
      n++;
    }

    geometry.setDrawRange(0, n);
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    pts.visible = n > 0;
  });

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={2400}
    />
  );
}
