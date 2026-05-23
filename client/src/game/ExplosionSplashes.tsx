import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ROCKET } from '../shared/Constants';
import {
  createSplashPool,
  spawnSplash,
  tickSplashPool,
  type SplashSlot,
} from './explosionSplashPool';

const SHELL_GEO = new THREE.SphereGeometry(1, 16, 12);
const CORE_GEO = new THREE.SphereGeometry(1, 12, 8);

function makeSplashMaterials() {
  const shell = new THREE.MeshStandardMaterial({
    color: '#ff9944',
    emissive: '#ff5500',
    emissiveIntensity: 3,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    toneMapped: false,
  });
  const core = new THREE.MeshStandardMaterial({
    color: '#ffcc66',
    emissive: '#ff8800',
    emissiveIntensity: 4,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    toneMapped: false,
  });
  return { shell, core };
}

function PooledSplash({
  slot,
  shellMat,
  coreMat,
}: {
  slot: SplashSlot;
  shellMat: THREE.MeshStandardMaterial;
  coreMat: THREE.MeshStandardMaterial;
}) {
  const shellRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    if (!slot.active) {
      group.visible = false;
      return;
    }

    group.visible = true;
    const age = performance.now() / 1000 - slot.born;
    const dur = ROCKET.explosionVisualDuration;
    const t = Math.min(1, age / dur);
    const fade = (1 - t) ** 2;
    const expand = slot.radius * (0.08 + t * 0.95);

    group.position.copy(slot.pos);
    if (shellRef.current) shellRef.current.scale.setScalar(expand);
    if (coreRef.current) coreRef.current.scale.setScalar(expand * 0.55);

    shellMat.emissiveIntensity = 3.2 * fade;
    shellMat.opacity = 0.42 * fade;
    coreMat.emissiveIntensity = 5 * fade;
    coreMat.opacity = 0.7 * fade;
    if (lightRef.current) {
      lightRef.current.intensity = 6 * fade;
      lightRef.current.distance = slot.radius * 2.5;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <pointLight ref={lightRef} color="#ff7700" intensity={0} distance={8} />
      <mesh ref={shellRef} geometry={SHELL_GEO} material={shellMat} />
      <mesh ref={coreRef} geometry={CORE_GEO} material={coreMat} />
    </group>
  );
}

export type ExplosionSplashesHandle = {
  spawn: (x: number, y: number, z: number, radius: number) => void;
};

type ExplosionSplashesProps = {
  poolRef: React.MutableRefObject<ExplosionSplashesHandle | null>;
};

export function ExplosionSplashes({ poolRef }: ExplosionSplashesProps) {
  const pool = useMemo(() => createSplashPool(), []);
  const slotMats = useMemo(() => pool.map(() => makeSplashMaterials()), [pool]);

  const poolHandle = useMemo(
    () => ({
      spawn: (x: number, y: number, z: number, radius: number) => {
        spawnSplash(pool, x, y, z, radius);
      },
    }),
    [pool],
  );

  poolRef.current = poolHandle;

  useFrame(() => {
    tickSplashPool(pool, performance.now() / 1000);
  });

  return (
    <group>
      {pool.map((slot, i) => (
        <PooledSplash
          key={i}
          slot={slot}
          shellMat={slotMats[i].shell}
          coreMat={slotMats[i].core}
        />
      ))}
    </group>
  );
}
