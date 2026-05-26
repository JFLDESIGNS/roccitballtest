import { useTexture } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { MOVEMENT } from '../shared/Constants';
import { CHARACTER_MESH_RENDER_ORDER } from './JerseyDecal';
import {
  applyDroneMapsToMesh,
  configureDroneTextures,
  DRONE_TEXTURE_URLS,
} from './droneMaterials';
import { PLAYER_MODEL_URL, PLAYER_TEXTURE_BASE } from './playerModel';
import type { Team } from '../shared/Types';

const capHalfH = MOVEMENT.capsuleHeight / 2 - MOVEMENT.capsuleRadius;
const capCenterY = capHalfH + MOVEMENT.capsuleRadius;
const CAPSULE_FOOT_LOCAL_Y = -capCenterY;

export type PlayerAvatarProps = {
  /** Player + bots on a team share the same material treatment */
  team?: Team;
  rotationY?: number;
};

/** Drone player mesh scaled to the movement capsule */
export function PlayerAvatar({ team, rotationY = 0 }: PlayerAvatarProps) {
  const fbx = useLoader(FBXLoader, PLAYER_MODEL_URL, (loader) => {
    loader.setResourcePath(PLAYER_TEXTURE_BASE);
  });

  const maps = useTexture(DRONE_TEXTURE_URLS);

  useLayoutEffect(() => {
    configureDroneTextures(maps);
  }, [maps]);

  const scene = useMemo(() => {
    const root = fbx.clone(true);
    root.rotation.y = rotationY;

    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.renderOrder = CHARACTER_MESH_RENDER_ORDER;
      mesh.visible = true;
      applyDroneMapsToMesh(mesh, maps, team);
    });

    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = MOVEMENT.capsuleHeight / Math.max(size.y, 0.001);
    root.scale.setScalar(scale);

    box.setFromObject(root);
    root.position.y = CAPSULE_FOOT_LOCAL_Y - box.min.y;

    return root;
  }, [fbx, team, rotationY, maps]);

  return <primitive object={scene} />;
}

/** @deprecated use PlayerAvatar */
export const MechAvatar = PlayerAvatar;
