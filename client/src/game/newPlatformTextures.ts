import baseColorUrl from '../assets/models/NewPlatform/textures/NEWCHING_DefaultMaterial_BaseColor.png';
import normalUrl from '../assets/models/NewPlatform/textures/NEWCHING_DefaultMaterial_Normal.png';
import metalUrl from '../assets/models/NewPlatform/textures/NEWCHING_DefaultMaterial_Metallic.png';
import roughUrl from '../assets/models/NewPlatform/textures/NEWCHING_DefaultMaterial_Roughness.png';

export const NEW_PLATFORM_TEXTURE_URLS = {
  map: baseColorUrl,
  normalMap: normalUrl,
  metalnessMap: metalUrl,
  roughnessMap: roughUrl,
} as const;
