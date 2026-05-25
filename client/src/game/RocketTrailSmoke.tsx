import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  MAX_ROCKET_TRAIL_PUFFS,
  tickRocketTrailSmokePuffs,
} from './rocketTrailSmokePuffs';

const dummy = new THREE.Object3D();

/** Lightweight grey exhaust — uniform material, no per-instance color or rotation */
export function RocketTrailSmoke() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#8a9098',
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        depthTest: true,
        toneMapped: true,
      }),
    [],
  );
  const geo = useMemo(() => new THREE.SphereGeometry(1, 4, 3), []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
  }, []);

  useFrame((_, dt) => {
    const inst = meshRef.current;
    if (!inst) return;
    const active = tickRocketTrailSmokePuffs(dt);
    let n = 0;

    for (let i = 0; i < active.length && n < MAX_ROCKET_TRAIL_PUFFS; i++) {
      const p = active[i]!;
      if (!p.active) continue;

      const lifeT = p.life / p.maxLife;
      if (lifeT < 0.06) continue;

      const fade = lifeT * lifeT;
      const s = p.size * (0.35 + fade * 0.55);
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      inst.setMatrixAt(n, dummy.matrix);
      n++;
    }

    if (inst.count !== n) {
      inst.count = n;
      inst.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, MAX_ROCKET_TRAIL_PUFFS]}
      frustumCulled
      renderOrder={9}
    />
  );
}
