import { useLoader } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { BALL } from '../shared/Constants';
import {
  createEightBallAuraMaterial,
  EIGHT_BALL_AURA_NAME,
} from './eightBallAuraMaterial';
import { EIGHT_BALL_MODEL_URL, EIGHT_BALL_TEXTURE_BASE } from './eightBallModel';
import {
  EIGHT_BALL_TEXTURE_URLS,
  resolveEightBallMaterialKey,
  type EightBallMaterialKey,
  type EightBallTextureUrls,
} from './eightBallTextures';

const TARGET_DIAMETER = BALL.radius * 2;
/** Visual-only rim — no collision */
const AURA_RADIUS = BALL.radius * 1.14;

type LoadedMaterialMaps = {
  map: THREE.Texture;
  aoMap: THREE.Texture;
  metalnessMap: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
};

function loadTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
): THREE.Texture {
  const tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = colorSpace;
  tex.anisotropy = 4;
  return tex;
}

function loadMaterialMaps(urls: EightBallTextureUrls): LoadedMaterialMaps {
  return {
    map: loadTexture(urls.albedo, THREE.SRGBColorSpace),
    aoMap: loadTexture(urls.ao, THREE.NoColorSpace),
    metalnessMap: loadTexture(urls.metal, THREE.NoColorSpace),
    normalMap: loadTexture(urls.normal, THREE.NoColorSpace),
    roughnessMap: loadTexture(urls.rough, THREE.NoColorSpace),
  };
}

function ensureAoUv2(geometry: THREE.BufferGeometry): void {
  if (geometry.attributes.uv2) return;
  const uv = geometry.attributes.uv;
  if (uv) geometry.setAttribute('uv2', uv);
}

function applyPbrMaterial(
  mesh: THREE.Mesh,
  maps: LoadedMaterialMaps,
): THREE.MeshStandardMaterial {
  const old = mesh.material;
  if (Array.isArray(old)) old.forEach((m) => m.dispose());
  else if (old) old.dispose();

  if (mesh.geometry) ensureAoUv2(mesh.geometry);

  const mat = new THREE.MeshStandardMaterial({
    map: maps.map,
    aoMap: maps.aoMap,
    aoMapIntensity: 1,
    metalnessMap: maps.metalnessMap,
    roughnessMap: maps.roughnessMap,
    normalMap: maps.normalMap,
    metalness: 1,
    roughness: 1,
    color: 0xffffff,
    emissive: 0x000000,
    emissiveIntensity: 0,
  });
  mat.name = mesh.name;
  mesh.material = mat;
  return mat;
}

function centerAndScaleBall(root: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const scale = TARGET_DIAMETER / maxDim;
  root.scale.setScalar(scale);

  box.setFromObject(root);
  const center = new THREE.Vector3();
  box.getCenter(center);
  root.position.sub(center);
}

function bindEightBallTextures(
  root: THREE.Object3D,
  sets: Record<EightBallMaterialKey, LoadedMaterialMaps>,
): void {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const rawMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const key = resolveEightBallMaterialKey(
      (rawMats[0] as THREE.Material | undefined)?.name ?? mesh.name,
    );
    applyPbrMaterial(mesh, sets[key]);
  });
}

/** Premium 8-ball mesh + outer fresnel aura (display only). */
export function EightBallVisual() {
  const fbx = useLoader(FBXLoader, EIGHT_BALL_MODEL_URL, (loader) => {
    loader.setResourcePath(EIGHT_BALL_TEXTURE_BASE);
  });

  const auraGeometry = useMemo(
    () => new THREE.SphereGeometry(AURA_RADIUS, 36, 28),
    [],
  );
  const auraMaterial = useMemo(() => createEightBallAuraMaterial(), []);

  const materialSets = useMemo(() => {
    const keys = Object.keys(EIGHT_BALL_TEXTURE_URLS) as EightBallMaterialKey[];
    const sets = {} as Record<EightBallMaterialKey, LoadedMaterialMaps>;
    for (const key of keys) {
      sets[key] = loadMaterialMaps(EIGHT_BALL_TEXTURE_URLS[key]);
    }
    return sets;
  }, []);

  useEffect(
    () => () => {
      auraGeometry.dispose();
      auraMaterial.dispose();
      for (const set of Object.values(materialSets)) {
        set.map.dispose();
        set.aoMap.dispose();
        set.metalnessMap.dispose();
        set.normalMap.dispose();
        set.roughnessMap.dispose();
      }
    },
    [auraGeometry, auraMaterial, materialSets],
  );

  const scene = useMemo(() => {
    const root = fbx.clone(true);
    bindEightBallTextures(root, materialSets);
    centerAndScaleBall(root);
    return root;
  }, [fbx, materialSets]);

  return (
    <group>
      <primitive object={scene} />
      <mesh
        name={EIGHT_BALL_AURA_NAME}
        geometry={auraGeometry}
        material={auraMaterial}
        frustumCulled={false}
        renderOrder={12}
      />
    </group>
  );
}
