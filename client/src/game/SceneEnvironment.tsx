import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { getArenaEnvMap } from './arenaEnvMap';
import { graphicsStore } from './graphicsStore';
import { shadowMapTypeToThree } from './shadowMapType';

/** Applies fog, exposure, and tone mapping from graphics settings */
export function SceneEnvironment() {
  const gfx = useSyncExternalStore(
    graphicsStore.subscribe,
    graphicsStore.getState,
  );
  const { gl, scene } = useThree();
  const pmremRef = useRef<THREE.PMREMGenerator | null>(null);

  const brightness = gfx.arenaBrightness ?? 1;

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileCubemapShader();
    scene.environment = pmrem.fromCubemap(getArenaEnvMap()).texture;
    pmremRef.current = pmrem;
    return () => {
      scene.environment = null;
      pmrem.dispose();
      pmremRef.current = null;
    };
  }, [gl, scene]);

  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    /** Blue backdrop only — does not drive PBR (see neutral env map + low env intensity) */
    const skyDisplay = new THREE.Color('#4a9ee8').lerp(
      new THREE.Color('#8fd4ff'),
      0.4,
    );
    gl.toneMappingExposure = gfx.exposure * brightness;
    scene.background = skyDisplay;
    /** Dark neutral fog — avoids cyan wash on the court */
    const fogColor = new THREE.Color('#1e2630');
    const fogDensity = gfx.fog
      ? gfx.fogDensity / Math.max(0.85, brightness)
      : gfx.fogDensity;
    if (gfx.fog) {
      scene.fog = new THREE.FogExp2(fogColor.getHex(), fogDensity);
    } else {
      scene.fog = null;
    }
    return () => {
      scene.fog = null;
    };
  }, [gfx.exposure, gfx.fog, gfx.fogDensity, brightness, gl, scene]);

  useEffect(() => {
    gl.shadowMap.enabled = gfx.shadows;
    if (gfx.shadows) {
      gl.shadowMap.type = shadowMapTypeToThree(gfx.shadowMapType);
      gl.shadowMap.needsUpdate = true;
    }
  }, [gfx.shadows, gfx.shadowMapType, gl]);

  useFrame(() => {
    gl.toneMappingExposure = gfx.exposure * brightness;
    scene.environmentIntensity = 0.26;
    if (gfx.fog && scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = gfx.fogDensity / Math.max(0.85, brightness);
    }
  });

  return null;
}
