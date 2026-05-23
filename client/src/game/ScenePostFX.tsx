import { Bloom, EffectComposer, N8AO } from '@react-three/postprocessing';
import { useSyncExternalStore } from 'react';
import { graphicsStore } from './graphicsStore';

export function ScenePostFX() {
  const gfx = useSyncExternalStore(
    graphicsStore.subscribe,
    graphicsStore.getState,
  );

  if (!gfx.bloom && !gfx.ao) return null;

  const effects = [];
  if (gfx.ao) {
    effects.push(
      <N8AO
        key="n8ao"
        halfRes
        quality="performance"
        aoRadius={14}
        intensity={gfx.aoIntensity}
        aoSamples={8}
        denoiseSamples={3}
        denoiseRadius={10}
        distanceFalloff={0.85}
      />,
    );
  }
  if (gfx.bloom) {
    effects.push(
      <Bloom
        key="bloom"
        intensity={gfx.bloomIntensity}
        luminanceThreshold={0.28}
        luminanceSmoothing={0.82}
        mipmapBlur
      />,
    );
  }

  return (
    <EffectComposer multisampling={0}>{effects}</EffectComposer>
  );
}
