import { useMemo } from 'react';
import * as THREE from 'three';
import { ARENA, ARENA_PADS } from '../shared/Constants';
import { getBillboardMounts, getBounceTrampolinePads } from './arenaPadLayout';
import { billboardHitHalfExtents } from './billboardCollision';
import { getBallDropRocketHitAabb } from './ballDropRocketCollision';
import { buildOctagonPlatformBuffers } from './arenaOctagon';
import { hexVertices } from './arenaHex';
import { getArenaCornerPillarLayouts, ARENA_PILLAR } from './arenaPillars';
import {
  getFanGlassPanels,
  type FanGlassPanel,
} from './fanGlassHit';
import { listArenaPlatforms } from './arenaSpawn';

export const ROCKET_HIT_WIRE_COLOR = '#bb55ff';

/** Matches detectExplosiveSurfaceHit / trySurfaceBounce arena margin */
const ROCKET_PLAY_R = ARENA.hexRadius - 0.6;
const ROCKET_FLOOR_HIT_Y = 0.35;
const ROCKET_CEILING_HIT_Y = ARENA.wallHeight - 0.35;
const ROCKET_PILLAR_PAD = 0.45;

function makeWireMaterial(color: string): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    toneMapped: false,
  });
}

function WireLineSegments({
  geometry,
  color = ROCKET_HIT_WIRE_COLOR,
}: {
  geometry: THREE.BufferGeometry;
  color?: string;
}) {
  const mat = useMemo(() => makeWireMaterial(color), [color]);
  return (
    <lineSegments geometry={geometry} material={mat} frustumCulled={false} />
  );
}

const _basis = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _unitEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));

function WireOrientedBox({
  position,
  rotation,
  quaternion,
  localOffset = [0, 0, 0],
  halfExtents,
  color = ROCKET_HIT_WIRE_COLOR,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  quaternion?: THREE.Quaternion;
  localOffset?: [number, number, number];
  halfExtents: [number, number, number];
  color?: string;
}) {
  const mat = useMemo(() => makeWireMaterial(color), [color]);
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

function BillboardRocketWire({
  mount,
}: {
  mount: ReturnType<typeof getBillboardMounts>[0];
}) {
  const { hx, hy, lzMin, lzMax } = billboardHitHalfExtents();
  const halfZ = (lzMax - lzMin) * 0.5;
  const zCenter = (lzMin + lzMax) * 0.5;
  return (
    <WireOrientedBox
      position={[mount.x, mount.y, mount.z]}
      rotation={[0, mount.yaw, 0]}
      localOffset={[0, 0, zCenter]}
      halfExtents={[hx, hy, halfZ]}
    />
  );
}

function FanGlassRocketWire({ panel }: { panel: FanGlassPanel }) {
  const halfD = ARENA_PADS.fanFacadeGlassThicknessM * 0.5 + 0.05;
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
    <WireOrientedBox
      position={position}
      quaternion={quaternion}
      halfExtents={[panel.halfW, panel.halfH, halfD]}
    />
  );
}

function WireOrientedBoxSimple({
  position,
  halfExtents,
  color = ROCKET_HIT_WIRE_COLOR,
}: {
  position: [number, number, number];
  halfExtents: [number, number, number];
  color?: string;
}) {
  const geo = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    [],
  );
  const mat = useMemo(() => makeWireMaterial(color), [color]);
  return (
    <lineSegments
      geometry={geo}
      material={mat}
      position={position}
      scale={[
        halfExtents[0] * 2,
        halfExtents[1] * 2,
        halfExtents[2] * 2,
      ]}
      frustumCulled={false}
    />
  );
}

function HexRingWire({
  radius,
  y,
  color = ROCKET_HIT_WIRE_COLOR,
}: {
  radius: number;
  y: number;
  color?: string;
}) {
  const geometry = useMemo(() => {
    const verts = hexVertices(radius);
    const pts = verts.map((v) => new THREE.Vector3(v.x, y, v.y));
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [radius, y]);
  const mat = useMemo(() => makeWireMaterial(color), [color]);
  return (
    <lineLoop geometry={geometry} material={mat} frustumCulled={false} />
  );
}

function HexBoundaryWire({
  radius,
  yMin,
  yMax,
}: {
  radius: number;
  yMin: number;
  yMax: number;
}) {
  const geometry = useMemo(() => {
    const verts = hexVertices(radius);
    const pts: THREE.Vector3[] = [];
    for (const v of verts) {
      pts.push(new THREE.Vector3(v.x, yMin, v.y));
      pts.push(new THREE.Vector3(v.x, yMax, v.y));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [radius, yMin, yMax]);
  return <WireLineSegments geometry={geometry} />;
}

/** Full platform mesh — same topR/slopeR as OctagonPlatform + listArenaPlatforms. */
function PlatformRocketWire({
  x,
  z,
  topR,
  slopeR,
}: {
  x: number;
  z: number;
  topR: number;
  slopeR: number;
}) {
  const geometry = useMemo(() => {
    const { geometry: meshGeo } = buildOctagonPlatformBuffers(
      topR,
      slopeR,
      ARENA.platformTopHeight,
      ARENA.floorY,
    );
    const edges = new THREE.EdgesGeometry(meshGeo);
    meshGeo.dispose();
    return edges;
  }, [topR, slopeR]);

  return (
    <group position={[x, 0, z]}>
      <WireLineSegments geometry={geometry} />
    </group>
  );
}

function PillarRocketWire({ x, z }: { x: number; z: number }) {
  const r = ARENA_PILLAR.colliderRadius + ROCKET_PILLAR_PAD;
  const halfH = ARENA_PILLAR.height * 0.5;
  const geometry = useMemo(
    () => new THREE.EdgesGeometry(new THREE.CylinderGeometry(r, r, halfH * 2, 14)),
    [r, halfH],
  );
  return (
    <group position={[x, ARENA_PILLAR.floorY + halfH, z]}>
      <WireLineSegments geometry={geometry} />
    </group>
  );
}

function TrampolineRocketWire({
  x,
  z,
  radius,
  platformTopY,
}: {
  x: number;
  z: number;
  radius: number;
  platformTopY: number;
}) {
  const deckH = ARENA_PADS.bouncePadHeightM;
  const floorY = ARENA.floorY;
  const stemH = platformTopY - floorY;
  const stemTopR = radius * 1.15;
  const stemColliderR = stemTopR * 1.05;
  const stemCenterY = floorY + stemH * 0.5;
  const deckCenterY = platformTopY + deckH * 0.5;

  const stemGeo = useMemo(
    () =>
      new THREE.EdgesGeometry(
        new THREE.CylinderGeometry(stemColliderR, stemColliderR, stemH, 12),
      ),
    [stemColliderR, stemH],
  );
  const deckGeo = useMemo(
    () =>
      new THREE.EdgesGeometry(
        new THREE.CylinderGeometry(radius, radius, deckH, 12),
      ),
    [radius, deckH],
  );

  return (
    <group position={[x, 0, z]}>
      <group position={[0, stemCenterY, 0]}>
        <WireLineSegments geometry={stemGeo} />
      </group>
      <group position={[0, deckCenterY, 0]}>
        <WireLineSegments geometry={deckGeo} />
      </group>
    </group>
  );
}

/** Purple wireframes — logical surfaces rockets detonate / bounce on (G key). */
export function RocketCollisionDebug() {
  const platforms = useMemo(() => listArenaPlatforms(), []);
  const pillars = useMemo(() => getArenaCornerPillarLayouts(), []);
  const trampolines = useMemo(() => getBounceTrampolinePads(), []);
  const ballDrop = useMemo(() => getBallDropRocketHitAabb(), []);
  const billboards = useMemo(() => getBillboardMounts(), []);
  const fanPanels = getFanGlassPanels();

  return (
    <group name="rocket-collision-debug">
      <HexRingWire radius={ROCKET_PLAY_R} y={ROCKET_FLOOR_HIT_Y} />
      <HexRingWire radius={ROCKET_PLAY_R} y={ROCKET_CEILING_HIT_Y} />
      <HexBoundaryWire
        radius={ROCKET_PLAY_R}
        yMin={ROCKET_FLOOR_HIT_Y}
        yMax={ROCKET_CEILING_HIT_Y}
      />

      <WireOrientedBoxSimple
        position={ballDrop.center}
        halfExtents={ballDrop.halfExtents}
      />

      {platforms.map((p, i) => (
        <PlatformRocketWire
          key={`rocket-platform-${i}`}
          x={p.x}
          z={p.z}
          topR={p.topR}
          slopeR={p.slopeR}
        />
      ))}

      {pillars.map((p, i) => (
        <PillarRocketWire key={`rocket-pillar-${i}`} x={p.x} z={p.z} />
      ))}

      {trampolines.map((pad, i) => (
        <TrampolineRocketWire
          key={`rocket-tramp-${i}`}
          x={pad.x}
          z={pad.z}
          radius={pad.radius}
          platformTopY={pad.platformTopY}
        />
      ))}

      {billboards.map((mount, i) => (
        <BillboardRocketWire key={`rocket-billboard-${i}`} mount={mount} />
      ))}

      {fanPanels.map((panel) => (
        <FanGlassRocketWire key={`rocket-glass-${panel.bayKey}`} panel={panel} />
      ))}
    </group>
  );
}
