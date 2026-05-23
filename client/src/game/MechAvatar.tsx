import { useLoader } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { MOVEMENT } from '../shared/Constants';
import { CHARACTER_MESH_RENDER_ORDER } from './JerseyDecal';
import { MECH_MODEL_URL } from './mechModel';

import mechBaseColorUrl from '../../user/3d/Mech/textures/v2_Material.002_BaseColor.png';
import mechNormalUrl from '../../user/3d/Mech/textures/v2_Material.002_Normal.png';
import mechMetalUrl from '../../user/3d/Mech/textures/v2_Material.002_Metallic.png';
import mechRoughUrl from '../../user/3d/Mech/textures/v2_Material.002_Roughness.png';

function loadMechTexture(url: string, colorSpace: THREE.ColorSpace): THREE.Texture {
  const tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = colorSpace;
  tex.anisotropy = 4;
  return tex;
}

const capHalfH = MOVEMENT.capsuleHeight / 2 - MOVEMENT.capsuleRadius;
const capCenterY = capHalfH + MOVEMENT.capsuleRadius;
const CAPSULE_FOOT_LOCAL_Y = -capCenterY;

type MechAvatarProps = {
  /** 0–1 subtle team wash on base color */
  tintAmount?: number;
  tint?: string;
  rotationY?: number;
};

/** Mech mesh scaled to the movement capsule */
export function MechAvatar({
  tint,
  tintAmount = 0,
  rotationY = Math.PI,
}: MechAvatarProps) {
  const fbx = useLoader(FBXLoader, MECH_MODEL_URL);

  const maps = useMemo(
    () => ({
      map: loadMechTexture(mechBaseColorUrl, THREE.SRGBColorSpace),
      normalMap: loadMechTexture(mechNormalUrl, THREE.NoColorSpace),
      metalnessMap: loadMechTexture(mechMetalUrl, THREE.NoColorSpace),
      roughnessMap: loadMechTexture(mechRoughUrl, THREE.NoColorSpace),
    }),
    [],
  );

  useEffect(
    () => () => {
      Object.values(maps).forEach((t) => t.dispose());
    },
    [maps],
  );

  const scene = useMemo(() => {
    const root = fbx.clone(true);
    root.rotation.y = rotationY;
    const tintColor = tint && tintAmount > 0 ? new THREE.Color(tint) : null;

    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.renderOrder = CHARACTER_MESH_RENDER_ORDER;

      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
        mat.map = maps.map;
        mat.normalMap = maps.normalMap;
        mat.metalnessMap = maps.metalnessMap;
        mat.roughnessMap = maps.roughnessMap;
        mat.metalness = 1;
        mat.roughness = 1;
        mat.color.setHex(0xffffff);
        mat.needsUpdate = true;
        if (tintColor) {
          mat.color.lerp(tintColor, tintAmount);
        }
      }
    });

    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = MOVEMENT.capsuleHeight / Math.max(size.y, 0.001);
    root.scale.setScalar(scale);

    box.setFromObject(root);
    root.position.y = CAPSULE_FOOT_LOCAL_Y - box.min.y;

    return root;
  }, [fbx, tint, tintAmount, rotationY, maps]);

  return <primitive object={scene} />;
}
