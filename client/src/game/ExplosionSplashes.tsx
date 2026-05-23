import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ROCKET } from '../shared/Constants';
import {
  applySplashFollow,
  createSplashPool,
  spawnSplash,
  tickSplashPool,
  type FxFollowAnchor,
  type SplashSlot,
} from './explosionSplashPool';

const SHELL_GEO = new THREE.SphereGeometry(1, 10, 8);
const CORE_GEO = new THREE.SphereGeometry(1, 8, 6);

export type ExplosionSplashesHandle = {
  spawn: (
    x: number,
    y: number,
    z: number,
    radius: number,
    follow?: FxFollowAnchor | null,
  ) => void;
};

type ExplosionSplashesProps = {
  poolRef: React.MutableRefObject<ExplosionSplashesHandle | null>;
};

/** One useFrame drives the whole pool — no per-splash lights or child hooks. */
export function ExplosionSplashes({ poolRef }: ExplosionSplashesProps) {
  const pool = useMemo(() => createSplashPool(), []);
  const groupRef = useRef<THREE.Group>(null);
  const shellsRef = useRef<THREE.Mesh[]>([]);
  const coresRef = useRef<THREE.Mesh[]>([]);

  const shellMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ff9944',
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  const coreMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffcc66',
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const shells: THREE.Mesh[] = [];
    const cores: THREE.Mesh[] = [];
    for (let i = 0; i < pool.length; i++) {
      const shell = new THREE.Mesh(SHELL_GEO, shellMat);
      const core = new THREE.Mesh(CORE_GEO, coreMat);
      shell.visible = false;
      core.visible = false;
      shell.frustumCulled = false;
      core.frustumCulled = false;
      group.add(shell);
      group.add(core);
      shells.push(shell);
      cores.push(core);
    }
    shellsRef.current = shells;
    coresRef.current = cores;
  }, [pool, shellMat, coreMat]);

  const poolHandle = useMemo((): ExplosionSplashesHandle => ({
    spawn: (
      x: number,
      y: number,
      z: number,
      radius: number,
      follow: FxFollowAnchor | null = null,
    ) => {
      spawnSplash(pool, x, y, z, radius, follow);
    },
  }), [pool]);

  poolRef.current = poolHandle;

  useFrame(() => {
    const now = performance.now() / 1000;
    applySplashFollow(pool);
    tickSplashPool(pool, now);
    const dur = ROCKET.explosionVisualDuration;
    const shells = shellsRef.current;
    const cores = coresRef.current;

    for (let i = 0; i < pool.length; i++) {
      const slot = pool[i] as SplashSlot;
      const shell = shells[i];
      const core = cores[i];
      if (!shell || !core) continue;

      if (!slot.active) {
        shell.visible = false;
        core.visible = false;
        continue;
      }

      const t = Math.min(1, (now - slot.born) / dur);
      const fade = (1 - t) ** 2;
      const expand = slot.radius * (0.08 + t * 0.95);

      shell.visible = true;
      core.visible = true;
      shell.position.copy(slot.pos);
      core.position.copy(slot.pos);
      shell.scale.setScalar(expand);
      core.scale.setScalar(expand * 0.55);
      shellMat.opacity = 0.4 * fade;
      coreMat.opacity = 0.62 * fade;
    }
  });

  return <group ref={groupRef} />;
};
