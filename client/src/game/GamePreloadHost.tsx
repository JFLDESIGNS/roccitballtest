import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { Suspense, useEffect } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { EIGHT_BALL_MODEL_URL, EIGHT_BALL_TEXTURE_BASE } from './eightBallModel';
import { gamePreloadStore } from './gamePreloadStore';
import { runGamePreload } from './gamePreload';
import { PLAYER_CROWN_MODEL_URL } from './playerCrownModel';
import { PLAYER_MODEL_URL, PLAYER_TEXTURE_BASE } from './playerModel';
import explosionSheetUrl from '../assets/images/explosion.png';
import glassCrackUrl from '../assets/images/glasscrack.png';

function PreloadModelProbe() {
  useLoader(FBXLoader, PLAYER_MODEL_URL, (loader) => {
    loader.setResourcePath(PLAYER_TEXTURE_BASE);
  });
  useLoader(FBXLoader, PLAYER_CROWN_MODEL_URL);
  useLoader(FBXLoader, EIGHT_BALL_MODEL_URL, (loader) => {
    loader.setResourcePath(EIGHT_BALL_TEXTURE_BASE);
  });
  useLoader(THREE.TextureLoader, explosionSheetUrl);
  useLoader(THREE.TextureLoader, glassCrackUrl);

  useEffect(() => {
    gamePreloadStore.setModelsReady();
  }, []);

  return null;
}

function InvalidateOnce() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  }, [invalidate]);
  return null;
}

/** Hidden GL context — primes R3F loader cache for match assets */
export function GamePreloadHost() {
  useEffect(() => {
    void runGamePreload();
  }, []);

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        left: 0,
        top: 0,
        zIndex: -1,
      }}
    >
      <Canvas
        frameloop="demand"
        dpr={1}
        camera={{ position: [0, 0, 5], fov: 50, near: 0.1, far: 20 }}
        gl={{ antialias: false, alpha: false, powerPreference: 'low-power' }}
      >
        <InvalidateOnce />
        <Suspense fallback={null}>
          <PreloadModelProbe />
        </Suspense>
      </Canvas>
    </div>
  );
}
