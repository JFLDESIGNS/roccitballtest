import { useTexture } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { MOVEMENT } from '../shared/Constants';
import { applyDroneTeamMaterial } from './characterVisual';
import { CHARACTER_MESH_RENDER_ORDER } from './JerseyDecal';
import { PLAYER_MODEL_URL, PLAYER_TEXTURE_BASE } from './playerModel';
import type { Team } from '../shared/Types';

import droneBaseUrl from '../assets/models/NewPlayer/textures/drone_d.png';
import droneNormalUrl from '../assets/models/NewPlayer/textures/drone_n.png';
import droneMetalUrl from '../assets/models/NewPlayer/textures/drone_m.png';
import droneRoughUrl from '../assets/models/NewPlayer/textures/drone_r.png';
import droneEmissiveUrl from '../assets/models/NewPlayer/textures/drone_e.png';

const capHalfH = MOVEMENT.capsuleHeight / 2 - MOVEMENT.capsuleRadius;
const capCenterY = capHalfH + MOVEMENT.capsuleRadius;
const CAPSULE_FOOT_LOCAL_Y = -capCenterY;

type DroneMaps = {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  metalnessMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  emissiveMap: THREE.Texture;
};

function configureDroneTextures(tex: DroneMaps): DroneMaps {
  tex.map.colorSpace = THREE.SRGBColorSpace;
  tex.map.anisotropy = 4;
  for (const key of ['normalMap', 'metalnessMap', 'roughnessMap', 'emissiveMap'] as const) {
    tex[key].colorSpace = THREE.NoColorSpace;
    tex[key].anisotropy = 4;
  }
  tex.emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createDroneMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0xffffff });
}

function assignDroneMaps(std: THREE.MeshStandardMaterial, maps: DroneMaps) {
  std.map = maps.map;
  std.normalMap = maps.normalMap;
  std.metalnessMap = maps.metalnessMap;
  std.roughnessMap = maps.roughnessMap;
  std.emissiveMap = maps.emissiveMap;
  std.metalness = 0.85;
  std.roughness = 0.55;
  std.transparent = false;
  std.opacity = 1;
}

function applyDroneMaps(mesh: THREE.Mesh, maps: DroneMaps, team?: Team) {
  const wasArray = Array.isArray(mesh.material);
  const rawMats: THREE.Material[] = wasArray
    ? (mesh.material as THREE.Material[])
    : [mesh.material as THREE.Material];
  for (const mat of rawMats) {
    mat.dispose();
  }
  const nextMats = rawMats.map(() => {
    const std = createDroneMaterial();
    assignDroneMaps(std, maps);
    if (team) {
      applyDroneTeamMaterial(std, team, maps.emissiveMap);
    } else {
      std.color.setHex(0xffffff);
      std.emissive.setHex(0xffffff);
      std.emissiveIntensity = 1;
      std.customProgramCacheKey = () => 'drone-neutral';
    }
    std.needsUpdate = true;
    return std;
  });
  mesh.material = wasArray ? nextMats : nextMats[0]!;
}

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

  const maps = useTexture({
    map: droneBaseUrl,
    normalMap: droneNormalUrl,
    metalnessMap: droneMetalUrl,
    roughnessMap: droneRoughUrl,
    emissiveMap: droneEmissiveUrl,
  });

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
      applyDroneMaps(mesh, maps, team);
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
