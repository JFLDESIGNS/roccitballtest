import { useFrame, useLoader } from '@react-three/fiber';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type RefObject,
} from 'react';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { MOVEMENT } from '../shared/Constants';
import { CHARACTER_MESH_RENDER_ORDER } from './JerseyDecal';
import { gameStore } from './gameStore';
import {
  disposeCrownMaterialMaps,
  loadCrownMaterialMaps,
  PLAYER_CROWN_MODEL_URL,
} from './playerCrownModel';

const FT = 0.3048;
const INCH = FT / 12;
const capHalfH = MOVEMENT.capsuleHeight / 2 - MOVEMENT.capsuleRadius;
const capCenterY = capHalfH + MOVEMENT.capsuleRadius;
const CAPSULE_FOOT_LOCAL_Y = -capCenterY;
const CAP_TOP_Y = CAPSULE_FOOT_LOCAL_Y + MOVEMENT.capsuleHeight;

const CROWN_SCALE_MULT = 2.85 * 0.6;
const CROWN_LOWER_FT = 1.65;
const CROWN_RAISE_IN = 4;
const CROWN_FORWARD_Z = 0.06;
const CROWN_POP_HEIGHT = 0.39;
/** Normal jump pop — quick bounce */
const CROWN_POP_DURATION_SEC = 0.6;
/** E throw + triple jump — pop + one forward somersault */
const CROWN_FLIP_POP_DURATION_SEC = 0.725;
/** Peak height above head during forward flip — pops up then somersaults in place */
const CROWN_FLIP_POP_PEAK = 0.92;
const CROWN_REST_Y = CAP_TOP_Y - CROWN_LOWER_FT * FT + CROWN_RAISE_IN * INCH;

const CROWN_YAW = Math.PI;
const CROWN_PITCH = 0;

/** Start floating crown when falling faster than this (m/s) */
const FALL_DETACH_VY = -1.6;
/** Extra lift above head when fully floated */
const FALL_FLOAT_ABOVE_M = 0.26;
/** Seconds to ease up to full float height (quick overall, slow start) */
const FALL_FLOAT_RISE_SEC = 0.34;
const REATTACH_LERP = 14;

function floatRiseEase(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return u * u * u;
}

const _restLocal = new THREE.Vector3(0, CROWN_REST_Y, CROWN_FORWARD_Z);
const _headWorld = new THREE.Vector3();

function disposeMaterial(m: THREE.Material | THREE.Material[]): void {
  const list = Array.isArray(m) ? m : [m];
  for (const mat of list) mat.dispose();
}

function prepareCrownModel(
  root: THREE.Group,
  crownMat: THREE.MeshStandardMaterial,
): THREE.Group {
  const scene = root.clone(true);
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.renderOrder = CHARACTER_MESH_RENDER_ORDER + 2;
    if (mesh.material) disposeMaterial(mesh.material);
    mesh.material = crownMat;
  });

  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const targetW = 0.52 * CROWN_SCALE_MULT;
  const scale = targetW / Math.max(size.x, size.z, size.y, 0.001);
  scene.scale.setScalar(scale);
  scene.rotation.set(0, 0, 0);

  box.setFromObject(scene);
  box.getCenter(center);
  scene.position.set(-center.x, -box.min.y, -center.z);

  return scene;
}

function cartoonPopOffset(u: number): number {
  if (u <= 0 || u >= 1) return 0;

  if (u < 0.1) {
    const t = u / 0.1;
    return -0.08 * CROWN_POP_HEIGHT * Math.sin(t * Math.PI);
  }
  if (u < 0.3) {
    const t = (u - 0.1) / 0.2;
    const eased = 1 - (1 - t) ** 4;
    return CROWN_POP_HEIGHT * eased;
  }

  const t = (u - 0.3) / 0.7;
  const fall = 1 - t ** 0.95;
  const bounce = 1 + 0.14 * Math.sin(t * Math.PI * 3.8) * (1 - t) ** 1.35;
  return CROWN_POP_HEIGHT * fall * bounce;
}

/** Pop arc synced to forward flip — rises fast, floats mid-flip, settles on head at end */
function forwardFlipCrownPopOffset(progress: number): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 0;

  if (progress < 0.18) {
    const t = progress / 0.18;
    const eased = 1 - (1 - t) ** 3.2;
    return CROWN_FLIP_POP_PEAK * eased;
  }
  if (progress < 0.68) {
    const t = (progress - 0.18) / 0.5;
    const hover = 1 + 0.06 * Math.sin(t * Math.PI * 2.2);
    return CROWN_FLIP_POP_PEAK * hover;
  }

  const t = (progress - 0.68) / 0.32;
  const settle = 1 - t ** 1.85;
  return CROWN_FLIP_POP_PEAK * settle;
}

/** One backward somersault (2π) — opposite the body forward flip, slow ease, lands upright */
function crownSomersaultPitch(u: number): number {
  if (u <= 0 || u >= 1) return 0;

  const flipStart = 0.08;
  const flipEnd = 0.92;
  if (u < flipStart || u > flipEnd) return 0;

  const t = (u - flipStart) / (flipEnd - flipStart);
  const eased = t * t * (3 - 2 * t);
  return eased * Math.PI * 2;
}

type PlayerJumpHatProps = {
  bodyRef: RefObject<RapierRigidBody | null>;
  visualRef: RefObject<THREE.Group | null>;
  tiltRef: RefObject<THREE.Group | null>;
  bobRef: RefObject<THREE.Group | null>;
  groundedRef: RefObject<boolean>;
};

/** Gold crown on local player — pops on jump; floats above head while falling */
export function PlayerJumpHat({
  bodyRef,
  visualRef,
  tiltRef,
  bobRef,
  groundedRef,
}: PlayerJumpHatProps) {
  const anchorRef = useRef<THREE.Group>(null);
  const tiltSyncRef = useRef<THREE.Group>(null);
  const popWrapRef = useRef<THREE.Group>(null);
  const popStartMs = useRef(0);
  const lastPopSeq = useRef(0);
  const detached = useRef(false);
  const floatRiseK = useRef(0);
  const reattachK = useRef(1);
  const floatHoldLocal = useRef(new THREE.Vector3());
  const wantFullFlip = useRef(false);

  const popSeq = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().playerHatPopSeq,
  );

  const fbx = useLoader(FBXLoader, PLAYER_CROWN_MODEL_URL);
  const crownMaps = useMemo(() => loadCrownMaterialMaps(), []);
  const crownScene = useMemo(
    () => prepareCrownModel(fbx, crownMaps.material),
    [fbx, crownMaps.material],
  );

  useEffect(() => () => disposeCrownMaterialMaps(crownMaps), [crownMaps]);

  useLayoutEffect(() => {
    if (popSeq === lastPopSeq.current) return;
    lastPopSeq.current = popSeq;
    popStartMs.current = performance.now();
    wantFullFlip.current = gameStore.getState().playerHatPopFullFlip;
    detached.current = false;
    reattachK.current = 1;
    floatRiseK.current = 0;
  }, [popSeq]);

  useFrame((_, dt) => {
    const anchor = anchorRef.current;
    const wrap = popWrapRef.current;
    const visual = visualRef.current;
    const body = bodyRef.current;
    if (!anchor || !visual) return;

    const vy = body ? body.linvel().y : 0;
    const isGrounded = groundedRef.current;
    const shouldDetach = !isGrounded && vy < FALL_DETACH_VY;

    const elapsed = (performance.now() - popStartMs.current) / 1000;
    const bobY = bobRef.current?.position.y ?? 0;
    const tilt = tiltRef.current;
    const tiltSync = tiltSyncRef.current;
    if (tilt && tiltSync) {
      tiltSync.rotation.order = tilt.rotation.order;
      tiltSync.rotation.x = tilt.rotation.x;
      tiltSync.rotation.y = tilt.rotation.y;
      tiltSync.rotation.z = tilt.rotation.z;
      tiltSync.quaternion.copy(tilt.quaternion);
    }

    const fullFlipDuration = wantFullFlip.current
      ? CROWN_FLIP_POP_DURATION_SEC
      : CROWN_POP_DURATION_SEC;
    const isFullFlipPop =
      wantFullFlip.current &&
      !detached.current &&
      elapsed < fullFlipDuration;

    if (shouldDetach) {
      if (!detached.current) floatRiseK.current = 0;
      detached.current = true;
      reattachK.current = 0;
    } else if (detached.current && isGrounded && vy > -1.2) {
      detached.current = false;
      floatRiseK.current = 0;
      reattachK.current = 0;
    }

    let pop = 0;
    let u = 1;
    const allowJumpPop =
      !detached.current && reattachK.current >= 0.98 && !isFullFlipPop;
    if (allowJumpPop && elapsed < CROWN_POP_DURATION_SEC) {
      u = elapsed / CROWN_POP_DURATION_SEC;
      pop = cartoonPopOffset(u);
    }

    const verticalPop = isFullFlipPop
      ? forwardFlipCrownPopOffset(elapsed / CROWN_FLIP_POP_DURATION_SEC)
      : pop;

    if (detached.current) {
      floatRiseK.current = Math.min(
        1,
        floatRiseK.current + dt / FALL_FLOAT_RISE_SEC,
      );
      const rise = floatRiseEase(floatRiseK.current);
      visual.getWorldPosition(_headWorld);
      _headWorld.y += CROWN_REST_Y + bobY + FALL_FLOAT_ABOVE_M * rise;
      if (rise > 0.72) {
        _headWorld.y += Math.sin(performance.now() * 0.009) * 0.03 * rise;
      }
      const parent = anchor.parent;
      if (parent) {
        parent.updateWorldMatrix(true, false);
        parent.worldToLocal(_headWorld);
      }
      floatHoldLocal.current.copy(_headWorld);
      anchor.position.copy(_headWorld);
    } else if (reattachK.current < 1) {
      reattachK.current = Math.min(1, reattachK.current + dt * REATTACH_LERP);
      _restLocal.y = CROWN_REST_Y + bobY + verticalPop;
      anchor.position.lerpVectors(
        floatHoldLocal.current,
        _restLocal,
        reattachK.current,
      );
    } else {
      anchor.position.set(
        _restLocal.x,
        CROWN_REST_Y + bobY + verticalPop,
        _restLocal.z,
      );
    }

    if (wrap) {
      if (isFullFlipPop) {
        const flipU = elapsed / CROWN_FLIP_POP_DURATION_SEC;
        wrap.rotation.x = crownSomersaultPitch(flipU);
        wrap.rotation.z = 0;
        wrap.scale.set(1, 1, 1);
      } else if (allowJumpPop && elapsed < CROWN_POP_DURATION_SEC) {
        const wave = Math.sin(u * Math.PI);
        const stretchY = 1 + 0.14 * wave;
        const squashXZ = 1 - 0.07 * wave;
        wrap.scale.set(squashXZ, stretchY, squashXZ);
        wrap.rotation.z = 0.06 * Math.sin(u * Math.PI * 2.4);
        wrap.rotation.x = 0.03 * Math.sin(u * Math.PI * 1.6);
      } else {
        wrap.scale.set(1, 1, 1);
        wrap.rotation.set(0, 0, 0);
      }
    }
  });

  return (
    <group ref={tiltSyncRef}>
      <group ref={anchorRef}>
        <group rotation={[0, CROWN_YAW, 0]}>
          <group rotation={[CROWN_PITCH, 0, 0]}>
            <group ref={popWrapRef}>
              <primitive object={crownScene} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
