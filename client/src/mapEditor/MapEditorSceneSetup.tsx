import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { getArenaEnvMap } from '../game/arenaEnvMap';
import { graphicsStore } from '../game/graphicsStore';

/** Tone mapping, env, and fill light — map editor has no SceneEnvironment / post-FX. */
export function MapEditorSceneSetup() {
  const gfx = useSyncExternalStore(
    graphicsStore.subscribe,
    graphicsStore.getState,
  );
  const { gl, scene } = useThree();
  const brightness = gfx.arenaBrightness ?? 1;

  useEffect(() => {
    const bg = new THREE.Color('#3a4a62');
    gl.setClearColor(bg, 1);
    scene.background = bg;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = Math.max(0.9, gfx.exposure * brightness);

    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileCubemapShader();
    scene.environment = pmrem.fromCubemap(getArenaEnvMap()).texture;
    scene.environmentIntensity = 0.26;

    scene.fog = new THREE.Fog('#3a4a62', 90, 240);

    gl.domElement.addEventListener(
      'webglcontextlost',
      (e) => {
        e.preventDefault();
        console.warn(
          '[MapEditor] WebGL context lost — hard refresh the page (Ctrl+Shift+R).',
        );
      },
      false,
    );

    return () => {
      scene.environment = null;
      scene.fog = null;
      pmrem.dispose();
    };
  }, [gl, scene, gfx.exposure, brightness]);

  useFrame(() => {
    gl.toneMappingExposure = Math.max(0.9, gfx.exposure * brightness);
  });

  return (
    <>
      <hemisphereLight
        args={['#c8daf0', '#4a5568', 0.65 * brightness]}
        position={[0, 48, 0]}
      />
      <ambientLight intensity={0.42 * brightness} color="#eef2fa" />
      <directionalLight
        position={[36, 58, 22]}
        intensity={1.35 * brightness}
        color="#fff4e6"
      />
    </>
  );
}
