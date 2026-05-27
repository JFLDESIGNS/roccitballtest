import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { arenaRoofStore } from './arenaRoofStore';
import { arenaRoofLayout } from './ArenaRetractableRoof';
import { graphicsStore } from './graphicsStore';

/** Solid cap above the roof — blocks outdoor sky / key light leak while closed; gone when roof opens */
const BLOCKER_HEIGHT_M = 28;

export function ArenaRoofLightBlocker() {
  const badPuter = useSyncExternalStore(
    graphicsStore.subscribe,
    () => graphicsStore.getState().badPuter,
  );
  const groupRef = useRef<THREE.Group>(null);
  const visibleRef = useRef<boolean | null>(null);
  const layout = useMemo(() => arenaRoofLayout(), []);

  const { geometry, material } = useMemo(() => {
    const geo = new THREE.BoxGeometry(
      layout.spanX * 1.05,
      BLOCKER_HEIGHT_M,
      layout.spanZ * 1.05,
    );
    const mat = new THREE.MeshStandardMaterial({
      color: '#12161c',
      roughness: 0.98,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    return { geometry: geo, material: mat };
  }, [layout.spanX, layout.spanZ]);

  const y =
    layout.centerY + layout.thickness / 2 + BLOCKER_HEIGHT_M / 2;

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const show = !badPuter && arenaRoofStore.getState().open < 0.06;
    if (visibleRef.current === show) return;
    visibleRef.current = show;
    group.visible = show;
    material.visible = show;
  });

  return (
    <group ref={groupRef} position={[0, y, 0]} frustumCulled={false}>
      {/*
        Invisible light-occluder only — never cast/receive shadows (huge box + R toggle
        was rebuilding shadow maps and hitching).
      */}
      <mesh geometry={geometry} material={material} castShadow={false} receiveShadow={false} />
    </group>
  );
};
