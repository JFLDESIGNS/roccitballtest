import { useFBO } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { createHeatLensMaterial, type HeatLensUniforms } from './heatWaveLensMaterial';
import {
  createHeatWavePool,
  HEAT_WAVE_LAYER,
  heatWaveProgress,
  spawnHeatWave,
  tickHeatWavePool,
  type HeatWaveSlot,
} from './rocketHeatWavePool';

export type RocketHeatWaveFxHandle = {
  spawn: (x: number, y: number, z: number) => void;
};

type RocketHeatWaveFxProps = {
  poolRef: React.MutableRefObject<RocketHeatWaveFxHandle | null>;
};

const OUTER_INNER_RATIO = 0.68;
const OUTER_GEO = new THREE.SphereGeometry(1, 14, 12);
const INNER_GEO = new THREE.SphereGeometry(1, 12, 10);
const _ndc = new THREE.Vector3();
const _fboSize = new THREE.Vector2(1, 1);

type HeatWaveBurstProps = {
  slot: HeatWaveSlot;
  sceneTexRef: React.RefObject<THREE.Texture | null>;
  resolutionRef: React.RefObject<THREE.Vector2>;
};

function projectScreenCenter(
  pos: THREE.Vector3,
  camera: THREE.Camera,
  out: THREE.Vector2,
): void {
  _ndc.copy(pos).project(camera);
  out.set((_ndc.x + 1) * 0.5, (_ndc.y + 1) * 0.5);
}

function HeatWaveBurst({ slot, sceneTexRef, resolutionRef }: HeatWaveBurstProps) {
  const outerLens = useMemo(() => {
    const mat = createHeatLensMaterial(true);
    const mesh = new THREE.Mesh(OUTER_GEO, mat);
    mesh.layers.set(HEAT_WAVE_LAYER);
    mesh.frustumCulled = false;
    mesh.renderOrder = 118;
    return { mesh, uniforms: mat.uniforms as HeatLensUniforms };
  }, []);

  const innerLens = useMemo(() => {
    const mat = createHeatLensMaterial(false);
    const mesh = new THREE.Mesh(INNER_GEO, mat);
    mesh.layers.set(HEAT_WAVE_LAYER);
    mesh.frustumCulled = false;
    mesh.renderOrder = 119;
    return { mesh, uniforms: mat.uniforms as HeatLensUniforms };
  }, []);

  useEffect(
    () => () => {
      (outerLens.mesh.material as THREE.Material).dispose();
      (innerLens.mesh.material as THREE.Material).dispose();
    },
    [outerLens, innerLens],
  );

  useFrame(({ camera }) => {
    const now = performance.now() / 1000;
    const { scale, fade, wobble } = heatWaveProgress(now - slot.born);
    const s = scale * wobble;
    const innerS = s * OUTER_INNER_RATIO;

    const tex = sceneTexRef.current;
    const res = resolutionRef.current;
    for (const { mesh, uniforms } of [outerLens, innerLens]) {
      mesh.position.copy(slot.pos);
      uniforms.tScene.value = tex;
      if (res) uniforms.resolution.value.copy(res);
    }

    outerLens.mesh.scale.setScalar(s);
    innerLens.mesh.scale.setScalar(innerS);
    outerLens.uniforms.opacity.value = 0.9 * fade;
    innerLens.uniforms.opacity.value = 0.72 * fade;
    outerLens.uniforms.bulge.value = 0.58 * fade;
    innerLens.uniforms.bulge.value = 0.44 * fade;

    projectScreenCenter(slot.pos, camera, outerLens.uniforms.screenCenter.value);
    projectScreenCenter(slot.pos, camera, innerLens.uniforms.screenCenter.value);
  });

  return (
    <group>
      <primitive object={outerLens.mesh} />
      <primitive object={innerLens.mesh} />
    </group>
  );
}

/** Twin lens spheres + half-res background grab when active */
export function RocketHeatWaveFx({ poolRef }: RocketHeatWaveFxProps) {
  const pool = useMemo(() => createHeatWavePool(), []);
  const [rev, setRev] = useState(0);
  const fbo = useFBO(1, 1, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const { gl, scene, camera } = useThree();
  const resolution = useRef(new THREE.Vector2(1, 1));
  const sceneTexRef = useRef<THREE.Texture | null>(null);

  useEffect(() => {
    camera.layers.enable(HEAT_WAVE_LAYER);
  }, [camera]);

  const poolHandle = useMemo(
    (): RocketHeatWaveFxHandle => ({
      spawn: (x, y, z) => {
        spawnHeatWave(pool, x, y, z);
        setRev((r) => r + 1);
      },
    }),
    [pool],
  );
  poolRef.current = poolHandle;

  useFrame(() => {
    const now = performance.now() / 1000;
    const before = pool.filter((s) => s.active).length;
    tickHeatWavePool(pool, now);
    const after = pool.filter((s) => s.active).length;
    if (before !== after) setRev((r) => r + 1);
  });

  useFrame((state) => {
    const active = pool.some((s) => s.active);
    if (!active) {
      sceneTexRef.current = null;
      return;
    }

    const fullW = Math.max(1, Math.floor(state.size.width));
    const fullH = Math.max(1, Math.floor(state.size.height));
    const halfW = Math.max(256, Math.floor(fullW * 0.5));
    const halfH = Math.max(256, Math.floor(fullH * 0.5));
    _fboSize.set(halfW, halfH);
    fbo.setSize(halfW, halfH);
    resolution.current.set(halfW, halfH);

    const prevTarget = gl.getRenderTarget();
    const hadHeatLayer = camera.layers.isEnabled(HEAT_WAVE_LAYER);
    camera.layers.disable(HEAT_WAVE_LAYER);

    gl.setRenderTarget(fbo);
    gl.clear();
    gl.render(scene, camera);

    gl.setRenderTarget(prevTarget);
    if (hadHeatLayer) camera.layers.enable(HEAT_WAVE_LAYER);

    sceneTexRef.current = fbo.texture;
  }, -1);

  return (
    <group key={rev}>
      {pool.map((slot, i) =>
        slot.active ? (
          <HeatWaveBurst
            key={`${i}-${slot.born}`}
            slot={slot}
            sceneTexRef={sceneTexRef}
            resolutionRef={resolution}
          />
        ) : null,
      )}
    </group>
  );
}
