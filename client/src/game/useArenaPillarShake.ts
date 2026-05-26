import { useFrame } from '@react-three/fiber';
import type { RefObject } from 'react';
import type * as THREE from 'three';
import { getArenaPillarShake } from './visualShake';

/** Apply pillar wobble after Rapier sync (visual mesh must not be a RigidBody child). */
export function useArenaPillarShake(
  ref: RefObject<THREE.Object3D | null>,
  pillarX: number,
  pillarZ: number,
  /** Local Y anchor (e.g. pillar half-height above floor group) — must be preserved each frame */
  baseY = 0,
) {
  useFrame(() => {
    const visual = ref.current;
    if (!visual) return;
    const { tiltX, tiltZ, offsetX, offsetZ } = getArenaPillarShake(
      pillarX,
      pillarZ,
    );
    visual.rotation.set(tiltX, 0, tiltZ);
    visual.position.set(offsetX, baseY, offsetZ);
  }, 2);
}
