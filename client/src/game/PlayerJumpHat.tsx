import { useFrame, useLoader } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
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
const CROWN_POP_DURATION_SEC = 0.6;
/** Rest on cap top: slightly lowered then raised */
const CROWN_REST_Y = CAP_TOP_Y - CROWN_LOWER_FT * FT + CROWN_RAISE_IN * INCH;

/** Crown forward aligns with player look (-Z) */
const CROWN_YAW = Math.PI;
const CROWN_PITCH = 0;

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

/** Anticipation dip → high launch → bouncy settle */
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

/** Gold crown on local player — pops up on jump then settles back */
export function PlayerJumpHat() {
  const anchorRef = useRef<THREE.Group>(null);
  const popWrapRef = useRef<THREE.Group>(null);
  const popStartMs = useRef(0);
  const lastPopSeq = useRef(0);

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
  }, [popSeq]);

  useFrame(() => {
    const anchor = anchorRef.current;
    const wrap = popWrapRef.current;
    if (!anchor) return;

    const elapsed = (performance.now() - popStartMs.current) / 1000;
    let pop = 0;
    let u = 1;
    if (elapsed < CROWN_POP_DURATION_SEC) {
      u = elapsed / CROWN_POP_DURATION_SEC;
      pop = cartoonPopOffset(u);
    }

    anchor.position.set(0, CROWN_REST_Y + pop, CROWN_FORWARD_Z);

    if (wrap) {
      if (elapsed < CROWN_POP_DURATION_SEC) {
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
    <group ref={anchorRef}>
      <group rotation={[0, CROWN_YAW, 0]}>
        <group rotation={[CROWN_PITCH, 0, 0]}>
          <group ref={popWrapRef}>
            <primitive object={crownScene} />
          </group>
        </group>
      </group>
    </group>
  );
}
