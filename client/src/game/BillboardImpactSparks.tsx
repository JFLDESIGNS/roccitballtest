import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { tickImpactSparks } from './impactSparkBurst';

const MAX = 160;

/**
 * World-space impact sparks (billboards, etc.) — bright additive points, not smoke puffs.
 */
export function ImpactSparks() {
  const pointsRef = useRef<THREE.Points>(null);
  const posAttrRef = useRef<THREE.BufferAttribute | null>(null);
  const positions = useMemo(() => new Float32Array(MAX * 3), []);
  const colors = useMemo(() => new Float32Array(MAX * 3), []);

  const hot = useMemo(() => new THREE.Color('#fff8e0'), []);
  const core = useMemo(() => new THREE.Color('#ffcc55'), []);
  const cool = useMemo(() => new THREE.Color('#9ee8ff'), []);
  const scratch = useMemo(() => new THREE.Color(), []);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.14,
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
      }),
    [],
  );

  useLayoutEffect(() => {
    const pts = pointsRef.current;
    if (!pts) return;
    pts.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pts.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }, [positions, colors]);

  useFrame((_, dt) => {
    const active = tickImpactSparks(dt);
    const pts = pointsRef.current;
    const posAttr = posAttrRef.current;
    const colAttr = pts?.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
    if (!pts || !posAttr || !colAttr) return;

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

    pts.geometry.setDrawRange(0, n);
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    pts.visible = n > 0;
  });

  return (
    <points ref={pointsRef} frustumCulled={false} renderOrder={16}>
      <bufferGeometry>
        <bufferAttribute
          ref={(a) => {
            posAttrRef.current = a;
          }}
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <primitive object={material} attach="material" />
    </points>
  );
}
