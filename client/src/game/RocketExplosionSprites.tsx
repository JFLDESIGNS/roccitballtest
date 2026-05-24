import { useFrame, useLoader } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import explosionSheetUrl from '../assets/images/explosion.png';
import { ROCKET } from '../shared/Constants';
import {
  applyExplosionSpriteSheetFrame,
  createExplosionSpritePool,
  explosionSpriteFrameIndex,
  spawnExplosionSprite,
  tickExplosionSpritePool,
  type ExplosionSpriteSlot,
} from './explosionSpritePool';
import { trailCameraFade } from './trailCameraFade';

export type RocketExplosionSpritesHandle = {
  spawn: (x: number, y: number, z: number, radius: number) => void;
};

type RocketExplosionSpritesProps = {
  poolRef: React.MutableRefObject<RocketExplosionSpritesHandle | null>;
};

const _camPos = new THREE.Vector3();
const _toCam = new THREE.Vector3();
const _drawPos = new THREE.Vector3();

/** Billboard sprite sheet — faces camera, drawn without depth clipping. */
export function RocketExplosionSprites({ poolRef }: RocketExplosionSpritesProps) {
  const pool = useMemo(() => createExplosionSpritePool(), []);
  const groupRef = useRef<THREE.Group>(null);
  const spritesRef = useRef<THREE.Sprite[]>([]);

  const baseTexture = useLoader(THREE.TextureLoader, explosionSheetUrl);
  baseTexture.colorSpace = THREE.SRGBColorSpace;
  baseTexture.magFilter = THREE.NearestFilter;
  baseTexture.minFilter = THREE.LinearFilter;
  baseTexture.wrapS = THREE.ClampToEdgeWrapping;
  baseTexture.wrapT = THREE.ClampToEdgeWrapping;

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const sprites: THREE.Sprite[] = [];
    for (let i = 0; i < pool.length; i++) {
      const map = baseTexture.clone();
      applyExplosionSpriteSheetFrame(
        map,
        0,
        ROCKET.explosionSpriteCols,
        ROCKET.explosionSpriteRows,
      );
      map.needsUpdate = true;

      const mat = new THREE.SpriteMaterial({
        map,
        color: new THREE.Color(2.6, 2.15, 1.45),
        transparent: true,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
        opacity: ROCKET.explosionSpriteBrightness,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.frustumCulled = false;
      sprite.renderOrder = 140;
      group.add(sprite);
      sprites.push(sprite);
    }
    spritesRef.current = sprites;

    return () => {
      for (const sprite of sprites) {
        const mat = sprite.material as THREE.SpriteMaterial;
        mat.map?.dispose();
        mat.dispose();
        group.remove(sprite);
      }
      spritesRef.current = [];
    };
  }, [baseTexture, pool.length]);

  const poolHandle = useMemo((): RocketExplosionSpritesHandle => ({
    spawn: (x: number, y: number, z: number, radius: number) => {
      spawnExplosionSprite(pool, x, y, z, radius);
    },
  }), [pool]);

  poolRef.current = poolHandle;

  useFrame(({ camera }) => {
    const now = performance.now() / 1000;
    tickExplosionSpritePool(pool, now);
    const sprites = spritesRef.current;
    const cols = ROCKET.explosionSpriteCols;
    const rows = ROCKET.explosionSpriteRows;

    camera.getWorldPosition(_camPos);

    for (let i = 0; i < pool.length; i++) {
      const slot = pool[i] as ExplosionSpriteSlot;
      const sprite = sprites[i];
      if (!sprite) continue;

      if (!slot.active) {
        sprite.visible = false;
        continue;
      }

      const elapsed = now - slot.born;
      const frame = explosionSpriteFrameIndex(elapsed);
      const mat = sprite.material as THREE.SpriteMaterial;
      const map = mat.map;
      if (map) {
        applyExplosionSpriteSheetFrame(map, frame, cols, rows);
        map.needsUpdate = true;
      }

      const size = slot.radius * ROCKET.explosionSpriteSize;
      _toCam.subVectors(_camPos, slot.pos);
      const camDist = _toCam.length();
      if (camDist > 1e-4) {
        _toCam.multiplyScalar(1 / camDist);
      } else {
        _toCam.set(0, 0, 1);
      }

      _drawPos
        .copy(slot.pos)
        .addScaledVector(_toCam, size * ROCKET.explosionSpriteCameraPull);
      sprite.position.copy(_drawPos);
      sprite.scale.set(size, size, 1);
      sprite.visible = true;

      const nearFade = trailCameraFade(slot.pos, _camPos);
      mat.opacity =
        ROCKET.explosionSpriteBrightness * (0.72 + nearFade * 0.28);
    }
  });

  return <group ref={groupRef} />;
}
