import * as THREE from 'three';
import { mapRegistryStore } from '../mapEditor/mapEditorStore';
import { DRONE_TEXTURE_URLS } from './droneMaterials';
import { preloadCrownMaterialMaps } from './playerCrownModel';
import { EIGHT_BALL_TEXTURE_URLS } from './eightBallTextures';
import explosionSheetUrl from '../assets/images/explosion.png';
import glassCrackUrl from '../assets/images/glasscrack.png';
import { preloadGameAudioSamples } from './audio';
import { gamePreloadStore } from './gamePreloadStore';
import { initStadiumRectAreaLights } from './stadiumRectAreaLightInit';

function waitFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function loadTextureAsync(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        tex.colorSpace =
          /albedo|BaseColor/i.test(url) || /\.jpe?g$/i.test(url)
            ? THREE.SRGBColorSpace
            : THREE.NoColorSpace;
        resolve(tex);
      },
      undefined,
      reject,
    );
  });
}

function collectEightBallTextureUrls(): string[] {
  const urls = new Set<string>();
  for (const set of Object.values(EIGHT_BALL_TEXTURE_URLS)) {
    urls.add(set.albedo);
    urls.add(set.ao);
    urls.add(set.metal);
    urls.add(set.normal);
    urls.add(set.rough);
  }
  return [...urls];
}

const UI_TEXTURE_URLS = [explosionSheetUrl, glassCrackUrl];

async function preloadTexturesChunked(
  onSlice: (progress: number) => void,
): Promise<void> {
  const urls = [
    ...UI_TEXTURE_URLS,
    ...collectEightBallTextureUrls(),
    ...Object.values(DRONE_TEXTURE_URLS),
  ];
  const batch = 4;
  for (let i = 0; i < urls.length; i += batch) {
    const slice = urls.slice(i, i + batch);
    await Promise.all(slice.map((url) => loadTextureAsync(url).catch(() => null)));
    onSlice((i + slice.length) / urls.length);
    await waitFrame();
  }
  preloadCrownMaterialMaps();
  await waitFrame();
}

function waitForPreloadFlag(
  read: () => boolean,
  timeoutMs = 120_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (read()) {
      resolve();
      return;
    }
    const start = performance.now();
    const id = window.setInterval(() => {
      if (read()) {
        window.clearInterval(id);
        resolve();
        return;
      }
      if (performance.now() - start > timeoutMs) {
        window.clearInterval(id);
        reject(new Error('preload timeout'));
      }
    }, 80);
  });
}

let preloadStarted = false;

/** Chunked preload — maps, audio, textures, models */
export async function runGamePreload(): Promise<void> {
  if (preloadStarted) return;
  preloadStarted = true;

  try {
    gamePreloadStore.setStage('maps', 0.02);
    await waitFrame();
    mapRegistryStore.refresh();
    await waitFrame();

    gamePreloadStore.setStage('audio', 0.08);
    await preloadGameAudioSamples((done, total) => {
      const t = total > 0 ? done / total : 1;
      gamePreloadStore.setStage('audio', 0.08 + t * 0.22);
    });

    gamePreloadStore.setStage('textures', 0.32);
    initStadiumRectAreaLights();
    await preloadTexturesChunked((t) => {
      gamePreloadStore.setStage('textures', 0.32 + t * 0.18);
    });

    gamePreloadStore.setStage('models', 0.52);
    await waitForPreloadFlag(() => gamePreloadStore.getState().modelsReady);

    gamePreloadStore.markReady();
  } catch {
    gamePreloadStore.markReady();
  }
}
