import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ROCKET } from '../shared/Constants';
import {
  createWallScorchPool,
  getWallScorchTexture,
  orientToSurfaceNormal,
  spawnWallScorch,
  tickWallScorchPool,
  type WallScorchKind,
  type WallScorchSlot,
} from './wallImpactFxPool';

export type RocketWallImpactFxHandle = {
  spawn: (
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    kind: WallScorchKind,
  ) => void;
};

type RocketWallImpactFxProps = {
  poolRef: React.MutableRefObject<RocketWallImpactFxHandle | null>;
};

const SCORCH_GEO = new THREE.CircleGeometry(1, 40);
const EMBER_GEO = new THREE.SphereGeometry(1, 6, 6);

type SlotVisual = {
  scorch: THREE.Mesh;
  scorchMat: THREE.MeshBasicMaterial;
  embers: THREE.Mesh[];
  emberMats: THREE.MeshBasicMaterial[];
};

const _quat = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _worldEmber = new THREE.Vector3();

/** Delayed black scorch decal + embers after rocket wall/floor impacts. */
export function RocketWallImpactFx({ poolRef }: RocketWallImpactFxProps) {
  const pool = useMemo(() => createWallScorchPool(), []);
  const groupRef = useRef<THREE.Group>(null);
  const visualsRef = useRef<SlotVisual[]>([]);
  const scorchTex = useMemo(() => getWallScorchTexture(), []);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const visuals: SlotVisual[] = [];
    for (let i = 0; i < pool.length; i++) {
      const scorchMat = new THREE.MeshBasicMaterial({
        map: scorchTex,
        color: 0x000000,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      });
      const scorch = new THREE.Mesh(SCORCH_GEO, scorchMat);
      scorch.visible = false;
      scorch.frustumCulled = false;
      scorch.renderOrder = 44;

      const embers: THREE.Mesh[] = [];
      const emberMats: THREE.MeshBasicMaterial[] = [];
      for (let e = 0; e < ROCKET.wallScorchEmberCount; e++) {
        const emberMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(2.2, 0.75, 0.15),
          transparent: true,
          opacity: 0,
          depthWrite: false,
          toneMapped: false,
          blending: THREE.AdditiveBlending,
        });
        const ember = new THREE.Mesh(EMBER_GEO, emberMat);
        ember.visible = false;
        ember.frustumCulled = false;
        ember.renderOrder = 46;
        group.add(ember);
        embers.push(ember);
        emberMats.push(emberMat);
      }

      group.add(scorch);
      visuals.push({ scorch, scorchMat, embers, emberMats });
    }
    visualsRef.current = visuals;

    return () => {
      for (const v of visuals) {
        v.scorchMat.dispose();
        group.remove(v.scorch);
        for (let i = 0; i < v.embers.length; i++) {
          v.emberMats[i]?.dispose();
          group.remove(v.embers[i]!);
        }
      }
      visualsRef.current = [];
    };
  }, [pool.length, scorchTex]);

  const poolHandle = useMemo((): RocketWallImpactFxHandle => ({
    spawn: (x, y, z, nx, ny, nz, kind) => {
      spawnWallScorch(pool, x, y, z, nx, ny, nz, kind);
    },
  }), [pool]);

  poolRef.current = poolHandle;

  useFrame(({ clock }) => {
    const now = performance.now() / 1000;
    tickWallScorchPool(pool, now);
    const visuals = visualsRef.current;
    const holdDur = ROCKET.wallScorchHoldSec;
    const fadeDur = ROCKET.wallScorchFadeSec;
    const radius = ROCKET.wallScorchRadiusM;
    const t = clock.elapsedTime;

    for (let i = 0; i < pool.length; i++) {
      const slot = pool[i] as WallScorchSlot;
      const visual = visuals[i];
      if (!visual) continue;

      if (!slot.active) {
        visual.scorch.visible = false;
        for (const ember of visual.embers) ember.visible = false;
        continue;
      }

      _normal.copy(slot.normal);
      orientToSurfaceNormal(_normal, _quat);
      const surfaceLift = slot.kind === 'wall' ? 0.14 : 0.1;
      _pos.copy(slot.pos).addScaledVector(_normal, surfaceLift);

      const scorchReady = now >= slot.scorchSpawnAt;
      if (scorchReady) {
        const scorchAge = now - slot.scorchSpawnAt;
        let fade = 1;
        if (scorchAge > holdDur) {
          const fadeAge = scorchAge - holdDur;
          const life = 1 - THREE.MathUtils.clamp(fadeAge / fadeDur, 0, 1);
          fade = life * life;
        }
        visual.scorch.position.copy(_pos);
        visual.scorch.quaternion.copy(_quat);
        visual.scorch.scale.setScalar(radius);
        visual.scorchMat.opacity = fade * 0.95;
        visual.scorch.visible = fade > 0.02;
      } else {
        visual.scorch.visible = false;
      }

      const embersReady = now >= slot.emberSpawnAt;
      for (let e = 0; e < visual.embers.length; e++) {
        const ember = visual.embers[e]!;
        const emberMat = visual.emberMats[e]!;
        const data = slot.embers[e];
        if (!embersReady || !data) {
          ember.visible = false;
          continue;
        }

        const emberAge = Math.max(0, now - slot.emberSpawnAt - e * 0.04);
        const emberLife =
          1 - THREE.MathUtils.clamp(emberAge / (fadeDur * 0.72), 0, 1);
        if (emberLife <= 0.02) {
          ember.visible = false;
          continue;
        }

        _worldEmber
          .copy(slot.pos)
          .addScaledVector(_normal, surfaceLift + 0.03)
          .add(data.offset)
          .addScaledVector(data.vel, emberAge * 0.35);
        ember.position.copy(_worldEmber);
        const pulse = 0.75 + Math.sin(t * 16 + data.phase) * 0.25;
        const s = (0.07 + emberLife * 0.11) * pulse;
        ember.scale.setScalar(s);
        emberMat.opacity = emberLife * emberLife * 0.9;
        ember.visible = true;
      }
    }
  });

  return <group ref={groupRef} />;
}
