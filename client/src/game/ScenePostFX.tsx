import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  LensFlare,
  N8AO,
} from '@react-three/postprocessing';
import { useMemo } from 'react';
import { useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { graphicsStore } from './graphicsStore';
import { LensDistortion } from './sceneLensDistortion';
import { tuningStore } from './tuningStore';

/** Fixed sky anchor when lens flare is enabled (no orbiting sun). */
const LENS_FLARE_SKY = new THREE.Vector3(44, 88, 34);

export function ScenePostFX() {
  const gfx = useSyncExternalStore(
    graphicsStore.subscribe,
    graphicsStore.getState,
  );
  const menuOpen = useSyncExternalStore(
    tuningStore.subscribe,
    () => tuningStore.getState().showMenu,
  );

  const chromaticOffset = useMemo(() => {
    const s = gfx.chromaticAberrationIntensity * 0.006;
    return new THREE.Vector2(s, s * 0.55);
  }, [gfx.chromaticAberrationIntensity]);

  const fisheyeDistortion = useMemo(() => {
    const d = Math.min(0.18, gfx.fisheyeIntensity * 0.22);
    return new THREE.Vector2(d, d);
  }, [gfx.fisheyeIntensity]);

  const showChromatic =
    gfx.chromaticAberration && gfx.chromaticAberrationIntensity > 0.001;
  const showFisheye = gfx.fisheye && gfx.fisheyeIntensity > 0.001;
  const showLensFlare = gfx.lensFlare;

  if (
    menuOpen ||
    (!gfx.bloom && !gfx.ao && !showChromatic && !showFisheye && !showLensFlare)
  ) {
    return null;
  }

  const effects = [];
  if (gfx.ao) {
    effects.push(
      <N8AO
        key="n8ao"
        halfRes
        quality="performance"
        aoRadius={10}
        intensity={gfx.aoIntensity * 0.82}
        aoSamples={8}
        denoiseSamples={3}
        denoiseRadius={8}
        distanceFalloff={0.8}
      />,
    );
  }
  if (showChromatic) {
    effects.push(
      <ChromaticAberration
        key="chromatic"
        offset={chromaticOffset}
        radialModulation
        modulationOffset={0.22}
      />,
    );
  }
  if (showFisheye) {
    effects.push(
      <LensDistortion key="fisheye" distortion={fisheyeDistortion} />,
    );
  }
  if (gfx.bloom) {
    effects.push(
      <Bloom
        key="bloom"
        intensity={gfx.bloomIntensity}
        luminanceThreshold={0.42}
        luminanceSmoothing={0.75}
        mipmapBlur
      />,
    );
  }
  if (showLensFlare) {
    effects.push(
      <LensFlare
        key="lensflare"
        enabled
        lensPosition={LENS_FLARE_SKY}
        opacity={0.9}
        glareSize={0.16}
        flareSize={0.011}
        haloScale={0.42}
        secondaryGhosts
        starBurst
      />,
    );
  }

  return (
    <EffectComposer multisampling={0}>{effects}</EffectComposer>
  );
}
