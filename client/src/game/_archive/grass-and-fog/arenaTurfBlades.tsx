import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import * as THREE from 'three';
import { ARENA } from '../shared/Constants';
import { hexVertices, isPointInHex } from './arenaHex';
import { isPointInOctagon, octagonArea } from './arenaOctagon';
import { listArenaPlatforms, platformSurfaceYAt } from './arenaSpawn';
import { isArenaGrassBuildEnabled } from './arenaGrassConfig';
import { setArenaTurfShaderGrassScale } from './arenaTurfMaterial';
import { gamePreloadStore } from './gamePreloadStore';
import { gameStore, type GamePhase } from './gameStore';
import { turfGrassColor } from './turfGrassColor';
import { tuningStore } from './tuningStore';

/** ~20× base density + 30% (pre half-height change) */
const BASE_SPACING_20X = (0.35 / Math.sqrt(20)) / Math.sqrt(1.3);
/** ~2× more clumps vs that baseline */
const DENSITY_BOOST = Math.sqrt(2);
const MAX_BLADE_INSTANCES = 360000;
const MAX_INSTANCES_PER_MESH = 48000;
const GRID_ROWS_PER_FRAME = 10;
/** Push partial turf to React while async grid fills */
const BLADE_BASE_COLOR = turfGrassColor('#161c08');
const BLADE_TIP_COLOR = turfGrassColor('#4a5620');

let preheatedBlades: BladeInstance[] | null = null;
let preheatedScale: number | null = null;
let preheatedLayoutVersion = 0;
let preheatGen = 0;

/** Bump when grass layout / preheat cache shape changes */
const TURF_LAYOUT_VERSION = 8;
/** Square grid over-count vs flat-top hex (~82% of bbox cells land inside). */
const HEX_GRID_FILL = 0.82;
const SPACING_CAP_MARGIN = 1.04;

/** Flat-top hex area (Vector2.y = world Z) */
const FLAT_TOP_HEX_AREA = (3 * Math.sqrt(3)) / 2;

const ARENA_TURF_BLADES = {
  hexInset: 0,
  widthMin: 0.11,
  widthMax: 0.2,
  heightMin: 0.3,
  heightMax: 0.52,
  yBase: ARENA.floorY + 0.12,
  yJitter: 0.03,
  leanMax: 0.28,
} as const;

type BladeInstance = {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  yaw: number;
  leanX: number;
  leanZ: number;
};

/** Widen spacing when density would exceed MAX_BLADE_INSTANCES (avoids Z-strip fill) */
function estimateTurfSpacing(grassScale: number): number {
  const scale = Math.max(0.25, Math.min(3, grassScale));
  const desired = BASE_SPACING_20X / (scale * DENSITY_BOOST);
  const hexArea = FLAT_TOP_HEX_AREA * ARENA.hexRadius ** 2;
  let deckArea = 0;
  for (const p of listArenaPlatforms()) {
    deckArea += octagonArea(p.slopeR);
  }
  const plantable = Math.max(hexArea - deckArea * 0.88, hexArea * 0.22);
  const spacingForCap = Math.sqrt(
    plantable / (MAX_BLADE_INSTANCES * HEX_GRID_FILL),
  );
  return Math.max(desired, spacingForCap * SPACING_CAP_MARGIN);
}

/** Match octagon deck/ramp mesh — soft fade at floor contact instead of a circular cliff */
function shouldSkipGrassNearPlatform(x: number, z: number): boolean {
  const floorLiftMax = 0.14;
  const fadeLiftSpan = ARENA.platformTopHeight * 0.5;

  for (const p of listArenaPlatforms()) {
    const lx = x - p.x;
    const lz = z - p.z;
    if (!isPointInOctagon(lx, lz, p.slopeR)) continue;

    const surfaceY = platformSurfaceYAt(x, z, p);
    if (surfaceY === null) continue;

    const lift = surfaceY - ARENA.floorY;
    if (lift <= floorLiftMax) continue;
    if (lift >= floorLiftMax + fadeLiftSpan) return true;

    const t = (lift - floorLiftMax) / fadeLiftSpan;
    if (Math.random() < t * t) return true;
  }
  return false;
}

function capBladeCount(blades: BladeInstance[], max: number): BladeInstance[] {
  if (blades.length <= max) return blades;
  const out = blades.slice(0, max);
  for (let i = max; i < blades.length; i++) {
    const j = Math.floor(Math.random() * (i + 1));
    if (j < max) out[j] = blades[i]!;
  }
  return out;
}

function grassActiveForPhase(phase: GamePhase): boolean {
  return (
    phase === 'intro' ||
    phase === 'loading' ||
    phase === 'countdown' ||
    phase === 'playing'
  );
}

/** Non-blocking grid fill — optional progress snapshots for live display */
function buildTurfBladeInstancesAsync(
  grassScale: number,
  onDone: (blades: BladeInstance[]) => void,
  cancel: () => boolean,
): void {
  const scale = Math.max(0.25, Math.min(3, grassScale));
  const spacing = estimateTurfSpacing(grassScale);
  const { leanMax } = ARENA_TURF_BLADES;
  const radius = ARENA.hexRadius - ARENA_TURF_BLADES.hexInset;
  const verts = hexVertices(ARENA.hexRadius);
  const blades: BladeInstance[] = [];
  const t = ARENA_TURF_BLADES;
  const widthScale = Math.sqrt(scale);
  const heightScale = scale;

  let gz = -radius;

  const step = () => {
    if (cancel()) return;
    let rows = 0;
    while (rows < GRID_ROWS_PER_FRAME && gz <= radius) {
      for (let gx = -radius; gx <= radius; gx += spacing) {
        const x = gx + (Math.random() - 0.5) * spacing * 0.72;
        const z = gz + (Math.random() - 0.5) * spacing * 0.72;
        if (!isPointInHex(x, z, verts)) continue;
        if (shouldSkipGrassNearPlatform(x, z)) continue;

        blades.push({
          x,
          y: t.yBase + Math.random() * t.yJitter,
          z,
          width:
            THREE.MathUtils.lerp(t.widthMin, t.widthMax, Math.random()) *
            widthScale,
          height:
            THREE.MathUtils.lerp(t.heightMin, t.heightMax, Math.random()) *
            heightScale,
          yaw: Math.random() * Math.PI * 2,
          leanX: (Math.random() * 2 - 1) * leanMax,
          leanZ: (Math.random() * 2 - 1) * leanMax,
        });
      }
      gz += spacing;
      rows += 1;
    }

    if (gz > radius) {
      onDone(capBladeCount(blades, MAX_BLADE_INSTANCES));
      return;
    }
    requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}

/** Menu / preload — chunked build */
export function startTurfPreheat(grassScale: number): void {
  if (!isArenaGrassBuildEnabled() || !tuningStore.getState().turfGrassEnabled) {
    gamePreloadStore.setGrassReady();
    return;
  }
  const scale = Math.max(0.25, Math.min(3, grassScale));
  if (
    preheatedBlades &&
    preheatedScale === scale &&
    preheatedLayoutVersion === TURF_LAYOUT_VERSION
  ) {
    gamePreloadStore.setGrassReady();
    return;
  }
  const gen = ++preheatGen;
  preheatedBlades = null;
  preheatedScale = null;

  buildTurfBladeInstancesAsync(
    scale,
    (built) => {
      if (gen !== preheatGen) return;
      preheatedBlades = built;
      preheatedScale = scale;
      preheatedLayoutVersion = TURF_LAYOUT_VERSION;
      gamePreloadStore.setGrassReady();
    },
    () => gen !== preheatGen,
  );
}

function getPreheatedTurfBlades(grassScale: number): BladeInstance[] | null {
  const scale = Math.max(0.25, Math.min(3, grassScale));
  if (
    preheatedScale === scale &&
    preheatedLayoutVersion === TURF_LAYOUT_VERSION &&
    preheatedBlades &&
    preheatedBlades.length > 0
  ) {
    return preheatedBlades;
  }
  return null;
}

const BLADE_GEO = (() => {
  const g = new THREE.PlaneGeometry(1, 1, 1, 1);
  g.translate(0, 0.5, 0);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = THREE.MathUtils.clamp(y, 0, 1);
    const c = BLADE_BASE_COLOR.clone().lerp(BLADE_TIP_COLOR, t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
})();

const BLADE_MAT = new THREE.MeshBasicMaterial({
  vertexColors: true,
  side: THREE.DoubleSide,
  depthWrite: true,
  depthTest: true,
  toneMapped: false,
});

function applyBladeMatrix(dummy: THREE.Object3D, b: BladeInstance) {
  dummy.position.set(b.x, b.y, b.z);
  dummy.rotation.set(b.leanX, b.yaw, b.leanZ);
  dummy.scale.set(b.width, b.height, 1);
  dummy.updateMatrix();
}

function TurfBladeChunk({
  blades,
  chunkKey,
}: {
  blades: BladeInstance[];
  chunkKey: string;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const maxCount = blades.length;

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || maxCount === 0) return;
    mesh.count = maxCount;
    for (let i = 0; i < maxCount; i++) {
      applyBladeMatrix(dummy, blades[i]!);
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [blades, dummy, maxCount]);

  if (maxCount === 0) return null;

  return (
    <instancedMesh
      key={chunkKey}
      ref={meshRef}
      args={[BLADE_GEO, BLADE_MAT, maxCount]}
      frustumCulled={false}
      renderOrder={8}
    />
  );
}

export function ArenaTurfBlades() {
  const phase = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().phase,
  );
  const grassScale = useSyncExternalStore(
    tuningStore.subscribe,
    () => tuningStore.getState().turfGrassScale,
  );
  const turfGrassEnabled = useSyncExternalStore(
    tuningStore.subscribe,
    () => tuningStore.getState().turfGrassEnabled,
  );
  const grassReady = useSyncExternalStore(
    gamePreloadStore.subscribe,
    () => gamePreloadStore.getState().grassReady,
  );
  const [blades, setBlades] = useState<BladeInstance[]>([]);
  const buildGen = useRef(0);

  const grassEnabled =
    isArenaGrassBuildEnabled() &&
    grassActiveForPhase(phase) &&
    turfGrassEnabled;

  useLayoutEffect(() => {
    setArenaTurfShaderGrassScale(grassScale);
  }, [grassScale]);

  useEffect(() => {
    if (!turfGrassEnabled) {
      setBlades([]);
      return;
    }
    startTurfPreheat(grassScale);
  }, [grassScale, turfGrassEnabled]);

  useEffect(() => {
    if (!grassEnabled) {
      if (!turfGrassEnabled) setBlades([]);
      return;
    }

    const applyCached = () => {
      const warmed = getPreheatedTurfBlades(grassScale);
      if (warmed && warmed.length > 0) {
        setBlades(warmed);
        return true;
      }
      return false;
    };

    if (applyCached()) return;

    const gen = ++buildGen.current;

    buildTurfBladeInstancesAsync(
      grassScale,
      (built) => {
        if (buildGen.current !== gen) return;
        if (built.length > 0) setBlades(built);
      },
      () => buildGen.current !== gen,
    );

    return () => {
      buildGen.current += 1;
    };
  }, [grassEnabled, grassScale, grassReady, turfGrassEnabled]);

  const chunks = useMemo(() => {
    const out: BladeInstance[][] = [];
    for (let i = 0; i < blades.length; i += MAX_INSTANCES_PER_MESH) {
      out.push(blades.slice(i, i + MAX_INSTANCES_PER_MESH));
    }
    return out;
  }, [blades]);

  if (!grassEnabled) return null;

  if (chunks.length === 0) return null;

  const scaleKey = grassScale.toFixed(2);

  return (
    <group>
      {chunks.map((chunk, i) => (
        <TurfBladeChunk
          key={`turf-${scaleKey}-${i}-${chunk.length}`}
          chunkKey={`turf-${scaleKey}-${i}`}
          blades={chunk}
        />
      ))}
    </group>
  );
}
