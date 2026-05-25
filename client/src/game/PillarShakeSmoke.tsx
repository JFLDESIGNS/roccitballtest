import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { tickPillarSmokePuffs } from './pillarSmokePuffs';

const MAX_INSTANCES = 160;
/** Dark grey — ~70% brightness */
const SMOKE_COLOR = 0x4a4e54;
/** ~30% more transparent than prior 0.21 */
const SMOKE_OPACITY = 0.147;

/** Grow-in envelope — 2× faster timing */
function growEnvelope(age: number): number {
  const t = Math.min(age / 0.19, 1);
  const ease = 1 - (1 - t) ** 3;
  return 0.55 + ease * 0.45;
}

/** Sphere → streak squash — longer blend so puffs stay round longer */
const SQUASH_BLEND_AGE = 0.5;

function squashForAge(age: number): number {
  const t = Math.min(age / SQUASH_BLEND_AGE, 1);
  const eased = t * t * (3 - 2 * t);
  return THREE.MathUtils.lerp(0.94, 0.28, eased);
}

export function PillarShakeSmoke() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: SMOKE_COLOR,
        transparent: true,
        opacity: SMOKE_OPACITY,
        depthWrite: false,
        depthTest: true,
        toneMapped: false,
        blending: THREE.NormalBlending,
      }),
    [],
  );
  const geo = useMemo(() => new THREE.SphereGeometry(1, 12, 10), []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
  }, []);

  useFrame((_, dt) => {
    const inst = meshRef.current;
    if (!inst) return;
    const active = tickPillarSmokePuffs(dt);
    let n = 0;

    for (let i = 0; i < active.length && n < MAX_INSTANCES; i++) {
      const p = active[i]!;
      const lifeT = Math.max(0, p.life / p.maxLife);
      const age = 1 - lifeT;
      const grow = growEnvelope(age);
      const fade = Math.pow(lifeT, 1.55);
      const sx = p.maxSize * grow * (0.35 + fade * 0.65);
      const sy = sx * squashForAge(age);

      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(sx, sy, sx);
      dummy.updateMatrix();
      inst.setMatrixAt(n, dummy.matrix);
      n++;
    }

    inst.count = n;
    inst.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, MAX_INSTANCES]}
      frustumCulled={false}
      renderOrder={14}
    />
  );
}
