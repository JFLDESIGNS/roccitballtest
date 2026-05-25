import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { useSyncExternalStore } from 'react';
import * as THREE from 'three';
import {
  buildFogVoxelGrid,
  getFogVoxelGrid,
  stepFogVoxelFade,
  subscribeFogVoxels,
} from './fogVoxelGrid';
import { getFogRadialTexture } from './fogVoxelMaterial';
import { fogVoxelDebugStore } from './fogVoxelDebugStore';
import { isFogVoxelEnabled } from './fogVoxelConfig';

function ensureFogGrid() {
  if (!isFogVoxelEnabled()) return null;
  return getFogVoxelGrid() ?? buildFogVoxelGrid();
}

/** Peak alpha per puff at full life (vertex color × material opacity) */
const FOG_SPRITE_ALPHA = 0.12;

/**
 * Stadium fog — camera-facing point sprites with white radial gradient per cell.
 * Rockets carve holes (fade, respawn ~2s). T = wireframe cube debug.
 */
export function ArenaInteractableFog() {
  const pointsRef = useRef<THREE.Points>(null);
  const wireRef = useRef<THREE.InstancedMesh>(null);
  const colorAttrRef = useRef<THREE.BufferAttribute | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const grid = useSyncExternalStore(subscribeFogVoxels, ensureFogGrid);
  const debug = useSyncExternalStore(
    fogVoxelDebugStore.subscribe,
    fogVoxelDebugStore.getState,
  );

  const { pointsGeo, pointsMat } = useMemo(() => {
    const g = grid;
    if (!g || g.count === 0) {
      return { pointsGeo: null as THREE.BufferGeometry | null, pointsMat: null as THREE.PointsMaterial | null };
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(g.centers.slice(0), 3),
    );
    const colors = new Float32Array(g.count * 3);
    for (let i = 0; i < g.count; i++) {
      const a = (g.life[i] ?? 1) * FOG_SPRITE_ALPHA;
      colors[i * 3] = a;
      colors[i * 3 + 1] = a;
      colors[i * 3 + 2] = a;
    }
    const colorAttr = new THREE.BufferAttribute(colors, 3);
    geo.setAttribute('color', colorAttr);
    colorAttrRef.current = colorAttr;

    const mat = new THREE.PointsMaterial({
      map: getFogRadialTexture(),
      size: g.cellSize * 3.4,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.5,
      alphaTest: 0.02,
      depthWrite: false,
      depthTest: true,
      vertexColors: true,
      fog: false,
      toneMapped: false,
      blending: THREE.NormalBlending,
    });

    return { pointsGeo: geo, pointsMat: mat };
  }, [grid]);

  useEffect(() => {
    return () => {
      pointsGeo?.dispose();
      pointsMat?.dispose();
      colorAttrRef.current = null;
    };
  }, [pointsGeo, pointsMat]);

  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const wireMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#44eeff',
        wireframe: true,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        depthTest: true,
        fog: false,
        toneMapped: false,
      }),
    [],
  );

  const applyWireMatrices = () => {
    const g = grid;
    const mesh = wireRef.current;
    if (!mesh || !g || g.count === 0) return;
    for (let i = 0; i < g.count; i++) {
      dummy.position.set(
        g.centers[i * 3],
        g.centers[i * 3 + 1],
        g.centers[i * 3 + 2],
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(g.cellSize * 0.98);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.count = g.count;
    mesh.instanceMatrix.needsUpdate = true;
  };

  useEffect(() => {
    applyWireMatrices();
  }, [grid, dummy, debug.wireframe]);

  useFrame((_, dt) => {
    if (!isFogVoxelEnabled()) return;
    const g = getFogVoxelGrid();
    const colors = colorAttrRef.current;
    if (!g || !colors || g.count === 0) return;

    stepFogVoxelFade(dt);

    const arr = colors.array as Float32Array;
    const n = Math.min(g.count, arr.length / 3);
    for (let i = 0; i < n; i++) {
      const a = (g.life[i] ?? 0) * FOG_SPRITE_ALPHA;
      arr[i * 3] = a;
      arr[i * 3 + 1] = a;
      arr[i * 3 + 2] = a;
    }
    colors.needsUpdate = true;

    if (debug.wireframe) {
      applyWireMatrices();
    }
  });

  if (
    !isFogVoxelEnabled() ||
    !grid ||
    grid.count === 0 ||
    !debug.arrayVisible ||
    !pointsGeo ||
    !pointsMat
  ) {
    return null;
  }

  return (
    <>
      <points
        key={`fog-points-${grid.count}`}
        ref={pointsRef}
        geometry={pointsGeo}
        material={pointsMat}
        frustumCulled={false}
        renderOrder={12}
      />
      {debug.wireframe ? (
        <instancedMesh
          key={`fog-wire-${grid.count}`}
          ref={wireRef}
          args={[boxGeo, wireMaterial, grid.count]}
          frustumCulled={false}
          renderOrder={14}
        />
      ) : null}
    </>
  );
}
