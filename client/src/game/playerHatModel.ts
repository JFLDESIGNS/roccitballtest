import * as THREE from 'three';

/** Deep black satin — soft sheen, fabric (not metallic) */
export function createPlayerHatSatinMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x060606),
    roughness: 0.32,
    metalness: 0,
    sheen: 1,
    sheenRoughness: 0.42,
    sheenColor: new THREE.Color(0x1a1a1a),
    side: THREE.DoubleSide,
  });
}

export const PLAYER_HAT_OBJ_URL = new URL(
  '../assets/models/Hat/hat.obj',
  import.meta.url,
).href;

export const PLAYER_HAT_MTL_URL = new URL(
  '../assets/models/Hat/hat.mtl',
  import.meta.url,
).href;

export const PLAYER_HAT_RESOURCE_PATH = new URL(
  '../assets/models/Hat/',
  import.meta.url,
).href;
