import * as THREE from 'three';
import type { Team } from '../shared/Types';

import droneBaseUrl from '../assets/models/NewPlayer/textures/drone_d.png';
import droneNormalUrl from '../assets/models/NewPlayer/textures/drone_n.png';
import droneMetalUrl from '../assets/models/NewPlayer/textures/drone_m.png';
import droneRoughUrl from '../assets/models/NewPlayer/textures/drone_r.png';
import droneEmissiveUrl from '../assets/models/NewPlayer/textures/drone_e.png';
import droneAoUrl from '../assets/models/NewPlayer/textures/drone_ao.png';

/** Bundled PBR maps for `drone.FBX` (see `textures/drone_*.png`). */
export const DRONE_TEXTURE_URLS = {
  map: droneBaseUrl,
  normalMap: droneNormalUrl,
  metalnessMap: droneMetalUrl,
  roughnessMap: droneRoughUrl,
  emissiveMap: droneEmissiveUrl,
  aoMap: droneAoUrl,
} as const;

export type DroneMaps = {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  metalnessMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  emissiveMap: THREE.Texture;
  aoMap: THREE.Texture;
};

/** Peak emissive — `drone_e.png` carries glow color (eyes, core); white multiplier preserves it. */
export const DRONE_EMISSIVE_INTENSITY = 3.6;
export const DRONE_AO_INTENSITY = 1.12;

export const DRONE_TEAM_COLORS: Record<'red' | 'blue', THREE.Color> = {
  red: new THREE.Color('#d62828'),
  blue: new THREE.Color('#2a6fd8'),
};

const TEAM_DIFFUSE_GREY = 0.26;
const TEAM_DIFFUSE_TINT = 0.74;

export function configureDroneTextures(tex: DroneMaps): DroneMaps {
  tex.map.colorSpace = THREE.SRGBColorSpace;
  tex.map.anisotropy = 4;
  tex.emissiveMap.colorSpace = THREE.SRGBColorSpace;
  tex.emissiveMap.anisotropy = 4;
  for (const key of ['normalMap', 'metalnessMap', 'roughnessMap', 'aoMap'] as const) {
    tex[key].colorSpace = THREE.NoColorSpace;
    tex[key].anisotropy = 4;
  }
  return tex;
}

function applyDroneDiffuseTint(std: THREE.MeshStandardMaterial, team: 'red' | 'blue') {
  const teamColor = DRONE_TEAM_COLORS[team];
  const g = TEAM_DIFFUSE_GREY;
  std.color.setRGB(
    THREE.MathUtils.lerp(g, teamColor.r, TEAM_DIFFUSE_TINT),
    THREE.MathUtils.lerp(g, teamColor.g, TEAM_DIFFUSE_TINT),
    THREE.MathUtils.lerp(g, teamColor.b, TEAM_DIFFUSE_TINT),
  );
}

/**
 * Wire `drone_e.png` as emissive mask + color source (green eyes, cyan thruster on the atlas).
 * Do not multiply emissive by the dark diffuse tint — that was washing out the glow.
 */
export function applyDroneEmissive(
  std: THREE.MeshStandardMaterial,
  emissiveMap: THREE.Texture,
  team?: Team,
) {
  std.emissiveMap = emissiveMap;
  std.emissive.set(1, 1, 1);
  if (team === 'red') {
    std.emissive.multiply(new THREE.Color(1.08, 0.82, 0.78));
  } else if (team === 'blue') {
    std.emissive.multiply(new THREE.Color(0.82, 0.95, 1.12));
  }
  std.emissiveIntensity = DRONE_EMISSIVE_INTENSITY;
  std.toneMapped = false;
}

export function assignDroneMaps(std: THREE.MeshStandardMaterial, maps: DroneMaps) {
  std.map = maps.map;
  std.normalMap = maps.normalMap;
  std.metalnessMap = maps.metalnessMap;
  std.roughnessMap = maps.roughnessMap;
  std.aoMap = maps.aoMap;
  std.aoMapIntensity = DRONE_AO_INTENSITY;
  std.metalness = 0.85;
  std.roughness = 0.55;
  std.transparent = false;
  std.opacity = 1;
}

/** Shared red/blue drone look for player + bots */
export function applyDroneTeamMaterial(
  std: THREE.MeshStandardMaterial,
  team: 'red' | 'blue',
  emissiveMap: THREE.Texture,
) {
  applyDroneDiffuseTint(std, team);
  applyDroneEmissive(std, emissiveMap, team);
  std.customProgramCacheKey = () => `drone-team-${team}-emissive-v2`;
}

export function createDroneMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0xffffff });
}

export function applyDroneMapsToMesh(
  mesh: THREE.Mesh,
  maps: DroneMaps,
  team?: Team,
) {
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
      applyDroneEmissive(std, maps.emissiveMap);
      std.customProgramCacheKey = () => 'drone-neutral-emissive-v2';
    }
    std.needsUpdate = true;
    return std;
  });
  mesh.material = wasArray ? nextMats : nextMats[0]!;
}
