import { useFrame, useLoader } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import glassCrackUrl from '../assets/images/glasscrack.png';
import {
  FAN_GLASS_CRACK_BASE_OPACITY,
  FAN_GLASS_CRACK_SURFACE_LIFT_M,
  fanGlassCrackLifeOpacity,
  getFanGlassCrackPool,
  tickFanGlassCrackLifetime,
  type FanGlassCrackSlot,
} from './fanGlassCrackPool';
import {
  createFanGlassCrackMaterial,
  type FanGlassCrackShaderMaterial,
} from './fanGlassCrackShader';
import { FAN_BOOTH_RENDER_ORDER } from './renderOrderConstants';
import { orientToSurfaceNormal } from './wallImpactFxPool';

const CRACK_GEO = new THREE.PlaneGeometry(1, 1);
const BACK_LIFT_M = 0.011;
const FRONT_LIFT_M = 0.003;

const _quat = new THREE.Quaternion();
const _spin = new THREE.Quaternion();
const _finalQuat = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _view = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _camPos = new THREE.Vector3();
const _worldNormal = new THREE.Vector3();
const _shimmer = new THREE.Vector2();
const _smoothShimmer = new THREE.Vector2();

type CrackMeshes = {
  back: THREE.Mesh;
  front: THREE.Mesh;
  mat: FanGlassCrackShaderMaterial;
};

/** Crack decals with rainbow shimmer, dual-layer thickness, 2s hold + 1s fade */
export function FanGlassCrackFx() {
  const pool = useMemo(() => getFanGlassCrackPool(), []);
  const groupRef = useRef<THREE.Group>(null);
  const crackMeshesRef = useRef<CrackMeshes[]>([]);

  const crackTex = useLoader(THREE.TextureLoader, glassCrackUrl);
  crackTex.colorSpace = THREE.SRGBColorSpace;
  crackTex.wrapS = THREE.ClampToEdgeWrapping;
  crackTex.wrapT = THREE.ClampToEdgeWrapping;

  const backMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: crackTex,
        alphaMap: crackTex,
        alphaTest: 0.12,
        color: 0x6a7a8a,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        depthTest: true,
        toneMapped: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      }),
    [crackTex],
  );

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const entries: CrackMeshes[] = [];
    for (let i = 0; i < pool.length; i++) {
      const mat = createFanGlassCrackMaterial(crackTex);
      mat.depthWrite = false;
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -2;
      mat.polygonOffsetUnits = -2;
      const back = new THREE.Mesh(CRACK_GEO, backMat);
      const front = new THREE.Mesh(CRACK_GEO, mat);
      for (const mesh of [back, front]) {
        mesh.visible = false;
        mesh.frustumCulled = false;
        mesh.renderOrder = FAN_BOOTH_RENDER_ORDER + 2;
        group.add(mesh);
      }
      front.renderOrder = FAN_BOOTH_RENDER_ORDER + 3;
      entries.push({ back, front, mat });
    }
    crackMeshesRef.current = entries;

    return () => {
      for (const { back, front, mat } of entries) {
        group.remove(back);
        group.remove(front);
        mat.dispose();
      }
      crackMeshesRef.current = [];
      backMat.dispose();
    };
  }, [pool.length, crackTex, backMat]);

  useFrame(({ camera, clock }) => {
    const now = performance.now();
    tickFanGlassCrackLifetime(now);
    const entries = crackMeshesRef.current;
    const t = clock.elapsedTime;

    camera.getWorldPosition(_camPos);
    const targetShimmerX = THREE.MathUtils.clamp(_camPos.x * 0.018, -0.45, 0.45);
    const targetShimmerY = THREE.MathUtils.clamp(_camPos.y * 0.012, -0.35, 0.35);
    _smoothShimmer.x = THREE.MathUtils.lerp(
      _smoothShimmer.x,
      targetShimmerX + Math.sin(t * 0.42) * 0.08,
      0.14,
    );
    _smoothShimmer.y = THREE.MathUtils.lerp(
      _smoothShimmer.y,
      targetShimmerY + Math.sin(t * 0.35 + 1.1) * 0.06,
      0.14,
    );
    _shimmer.copy(_smoothShimmer);

    for (let i = 0; i < pool.length; i++) {
      const slot = pool[i] as FanGlassCrackSlot;
      const entry = entries[i];
      if (!entry) continue;
      const { back, front, mat } = entry;
      if (!back || !front) continue;

      if (!slot.active) {
        back.visible = false;
        front.visible = false;
        continue;
      }

      const life = fanGlassCrackLifeOpacity(slot.bornAtMs, now);
      if (life <= 0) {
        slot.active = false;
        back.visible = false;
        front.visible = false;
        continue;
      }

      _normal.copy(slot.normal);
      orientToSurfaceNormal(_normal, _quat);
      _spin.setFromAxisAngle(_zAxis, slot.rotRad);
      _finalQuat.copy(_quat).multiply(_spin);

      const lift = FAN_GLASS_CRACK_SURFACE_LIFT_M + slot.layerLift;
      _pos.copy(slot.pos);
      _worldNormal.copy(_normal);

      _view.subVectors(_camPos, _pos).normalize();
      const headOn = Math.max(0, _view.dot(_normal));
      const viewMul = headOn ** 1.1;
      const alpha = FAN_GLASS_CRACK_BASE_OPACITY * viewMul * life;
      const visible = alpha > 0.008;

      _pos.addScaledVector(_normal, lift);

      back.quaternion.copy(_finalQuat);
      front.quaternion.copy(_finalQuat);
      back.scale.set(slot.size * 1.04, slot.size * 1.04, 1);
      front.scale.set(slot.size, slot.size, 1);

      back.position.copy(_pos).addScaledVector(_normal, -BACK_LIFT_M);
      front.position.copy(_pos).addScaledVector(_normal, FRONT_LIFT_M);

      back.visible = visible;
      front.visible = visible;
      backMat.opacity = 0.18 * life * viewMul;

      const u = mat.uniforms;
      u.uOpacity.value = alpha;
      u.uTime.value = t;
      u.uCamPos.value.copy(_camPos);
      u.uWorldPos.value.copy(front.position);
      u.uNormal.value.copy(_worldNormal);
      u.uShimmer.value.copy(_shimmer);
    }
  });

  return <group ref={groupRef} />;
}
