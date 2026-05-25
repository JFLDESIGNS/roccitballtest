import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { ARENA_PADS } from '../shared/Constants';
import { getBillboardMounts } from './arenaPadLayout';
import { getFanGlassPanels, refreshFanGlassBoxes } from './fanGlassHit';
import { gameStore } from './gameStore';

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();

function makeWireBoxMaterial(color: string): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    toneMapped: false,
  });
}

function WireBox({
  box,
  color,
}: {
  box: THREE.Box3;
  color: string;
}) {
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const mat = useMemo(() => makeWireBoxMaterial(color), [color]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);

  if (box.isEmpty()) return null;
  box.getSize(_size);
  box.getCenter(_center);

  return (
    <group
      position={[_center.x, _center.y, _center.z]}
      scale={[_size.x, _size.y, _size.z]}
    >
      <lineSegments geometry={edges} material={mat} frustumCulled={false} />
    </group>
  );
}

/** Logical + physics-adjacent hit volumes (Rapier wireframes use Physics debug prop). */
export function GameplayCollisionDebug() {
  const visible = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().showColliderDebug,
  );
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!visible) return;
    refreshFanGlassBoxes();
  });

  if (!visible) return null;

  const panels = getFanGlassPanels();
  const billboards = getBillboardMounts();
  const w = ARENA_PADS.billboardWidthM * 0.55;
  const h = ARENA_PADS.billboardHeightM * 0.55;
  const depth = 2.4;

  return (
    <group ref={groupRef} name="gameplay-collision-debug">
      {panels.map((panel) => (
        <WireBox key={`glass-query-${panel.bayKey}`} box={panel.box} color="#44ffcc" />
      ))}
      {billboards.map((mount, i) => {
        const cos = Math.cos(mount.yaw);
        const sin = Math.sin(mount.yaw);
        _box.makeEmpty();
        const corners: [number, number, number][] = [
          [-w, -h, -depth],
          [w, -h, -depth],
          [w, h, -depth],
          [-w, h, -depth],
          [-w, -h, depth],
          [w, -h, depth],
          [w, h, depth],
          [-w, h, depth],
        ];
        for (const [lx, ly, lz] of corners) {
          const wx = mount.x + lx * cos - lz * sin;
          const wy = mount.y + ly;
          const wz = mount.z + lx * sin + lz * cos;
          _box.expandByPoint(_center.set(wx, wy, wz));
        }
        return (
          <WireBox key={`billboard-hit-${i}`} box={_box.clone()} color="#ffaa44" />
        );
      })}
    </group>
  );
}
