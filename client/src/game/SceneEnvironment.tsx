import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { graphicsStore } from './graphicsStore';

/** Applies fog, exposure, and tone mapping from graphics settings */
export function SceneEnvironment() {
  const gfx = useSyncExternalStore(
    graphicsStore.subscribe,
    graphicsStore.getState,
  );
  const { gl, scene } = useThree();

  const brightness = gfx.arenaBrightness ?? 1.35;

  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    const sky = new THREE.Color('#4a5f78').lerp(
      new THREE.Color('#8aa4c8'),
      Math.min(1, (brightness - 0.4) / 1.6),
    );
    gl.toneMappingExposure = gfx.exposure * brightness;
    scene.background = sky;
    const fogDensity = gfx.fog
      ? gfx.fogDensity / Math.max(0.65, brightness * 0.85)
      : gfx.fogDensity;
    if (gfx.fog) {
      scene.fog = new THREE.FogExp2(sky.getHex(), fogDensity);
    } else {
      scene.fog = null;
    }
    return () => {
      scene.fog = null;
    };
  }, [gfx.exposure, gfx.fog, gfx.fogDensity, brightness, gl, scene]);

  useFrame(() => {
    gl.toneMappingExposure = gfx.exposure * brightness;
    if (gfx.fog && scene.fog instanceof THREE.FogExp2) {
      scene.fog.density =
        gfx.fogDensity / Math.max(0.65, brightness * 0.85);
    }
  });

  return null;
}
