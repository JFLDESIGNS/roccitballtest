import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { COMBAT_VFX_RENDER_ORDER } from './renderOrderConstants';
import { trailCameraFade } from './trailCameraFade';
import {
  MAX_ROCKET_TRAIL_PUFFS,
  getRocketTrailSmokePuff,
  tickRocketTrailSmokePuffs,
} from './rocketTrailSmokePuffs';

const dummy = new THREE.Object3D();
const _puffPos = new THREE.Vector3();
const _camPos = new THREE.Vector3();

/** Lightweight grey exhaust — uniform material, no per-instance color or rotation */
export function RocketTrailSmoke() {
  const { camera } = useThree();
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#2f2c28',
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        depthTest: true,
        toneMapped: true,
      }),
    [],
  );
  const geo = useMemo(() => new THREE.SphereGeometry(1, 6, 5), []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
  }, []);

  useFrame((_, dt) => {
    const inst = meshRef.current;
    if (!inst) return;
    camera.getWorldPosition(_camPos);
    const indices = tickRocketTrailSmokePuffs(dt);
    let n = 0;

    for (let i = 0; i < indices.length && n < MAX_ROCKET_TRAIL_PUFFS; i++) {
      const p = getRocketTrailSmokePuff(indices[i]!);
      if (!p?.active) continue;

      const lifeT = p.life / p.maxLife;
      if (lifeT < 0.08) continue;

      _puffPos.set(p.x, p.y, p.z);
      const fade = lifeT * lifeT * lifeT * trailCameraFade(_puffPos, _camPos);
      const s = p.size * p.sizeMul * (0.4 + fade * 0.55);
      dummy.position.copy(_puffPos);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(s, s * 0.88, s);
      dummy.updateMatrix();
      inst.setMatrixAt(n, dummy.matrix);
      n++;
    }

    inst.count = n;
    if (n > 0) inst.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, MAX_ROCKET_TRAIL_PUFFS]}
      frustumCulled={false}
      renderOrder={COMBAT_VFX_RENDER_ORDER + 2}
    />
  );
}
