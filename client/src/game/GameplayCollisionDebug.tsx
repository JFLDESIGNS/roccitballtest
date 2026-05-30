import { useRapier } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { ARENA_PADS } from '../shared/Constants';
import { getBillboardMounts } from './arenaPadLayout';
import { billboardHitHalfExtents } from './billboardCollision';
import {
  getFanGlassPanels,
  refreshFanGlassBoxes,
  type FanGlassPanel,
} from './fanGlassHit';
import { gameStore } from './gameStore';
import {
  GRIND_RAIL,
  getGrindRailPaths,
} from './grindRail';
import { RocketCollisionDebug } from './RocketCollisionDebug';

function makeWireBoxMaterial(color: string): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    toneMapped: false,
  });
}

const _unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
const _unitEdges = new THREE.EdgesGeometry(_unitBoxGeo);
const _basis = new THREE.Matrix4();
const _quat = new THREE.Quaternion();

function RapierColliderDebug() {
  const { world } = useRapier();
  const lineRef = useRef<THREE.LineSegments>(null);

  useFrame(() => {
    const lines = lineRef.current;
    if (!lines) return;
    const buffers = world.debugRender();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(buffers.vertices, 3),
    );
    geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(buffers.colors, 4),
    );
    lines.geometry.dispose();
    lines.geometry = geometry;
  });

  return (
    <lineSegments ref={lineRef} frustumCulled={false} renderOrder={260}>
      <lineBasicMaterial vertexColors transparent opacity={0.9} depthWrite={false} />
      <bufferGeometry />
    </lineSegments>
  );
}

function OrientedWireBox({
  position,
  rotation,
  quaternion,
  localOffset = [0, 0, 0],
  halfExtents,
  color,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  quaternion?: THREE.Quaternion;
  localOffset?: [number, number, number];
  halfExtents: [number, number, number];
  color: string;
}) {
  const mat = useMemo(() => makeWireBoxMaterial(color), [color]);

  return (
    <group position={position} rotation={rotation} quaternion={quaternion}>
      <group position={localOffset}>
        <lineSegments
          geometry={_unitEdges}
          material={mat}
          scale={[
            halfExtents[0] * 2,
            halfExtents[1] * 2,
            halfExtents[2] * 2,
          ]}
          frustumCulled={false}
        />
      </group>
    </group>
  );
}

function BillboardHitWire({ mount }: { mount: ReturnType<typeof getBillboardMounts>[0] }) {
  const { hx, hy, lzMin, lzMax } = billboardHitHalfExtents();
  const halfZ = (lzMax - lzMin) * 0.5;
  const zCenter = (lzMin + lzMax) * 0.5;

  return (
    <OrientedWireBox
      position={[mount.x, mount.y, mount.z]}
      rotation={[0, mount.yaw, 0]}
      localOffset={[0, 0, zCenter]}
      halfExtents={[hx, hy, halfZ]}
      color="#ffaa44"
    />
  );
}

function FanGlassHitWire({ panel }: { panel: FanGlassPanel }) {
  const halfD =
    ARENA_PADS.fanFacadeGlassThicknessM * 0.5 + 0.05;

  const { position, quaternion } = useMemo(() => {
    _basis.makeBasis(panel.tangent, panel.bitangent, panel.outwardNormal);
    _quat.setFromRotationMatrix(_basis);
    const center = panel.courtFaceCenter
      .clone()
      .addScaledVector(panel.outwardNormal, -halfD);
    return {
      position: [center.x, center.y, center.z] as [number, number, number],
      quaternion: _quat.clone(),
    };
  }, [panel, halfD]);

  return (
    <OrientedWireBox
      position={position}
      quaternion={quaternion}
      halfExtents={[panel.halfW, panel.halfH, halfD]}
      color="#44ffcc"
    />
  );
}

function GrindRailHitWire() {
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#51f6ff',
        transparent: true,
        opacity: 0.18,
        wireframe: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  const geometries = useMemo(
    () =>
      getGrindRailPaths().map((path) => {
        const curve = new THREE.CatmullRomCurve3(path, false, 'centripetal');
        return new THREE.TubeGeometry(
          curve,
          Math.max(48, path.length * 16),
          GRIND_RAIL.contactHorizontalM,
          12,
          false,
        );
      }),
    [],
  );

  return (
    <>
      {geometries.map((geometry, index) => (
        <mesh
          key={`grind-rail-hitbox-${index}`}
          geometry={geometry}
          material={material}
          frustumCulled={false}
        />
      ))}
    </>
  );
}

/** Logical hit volumes aligned with billboard yaw + fan glass plane (not world AABBs). */
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

  return (
    <group ref={groupRef} name="gameplay-collision-debug">
      <RapierColliderDebug />
      <RocketCollisionDebug />
      <GrindRailHitWire />
      {panels.map((panel) => (
        <FanGlassHitWire key={`glass-query-${panel.bayKey}`} panel={panel} />
      ))}
      {billboards.map((mount, i) => (
        <BillboardHitWire key={`billboard-hit-${i}`} mount={mount} />
      ))}
    </group>
  );
}
