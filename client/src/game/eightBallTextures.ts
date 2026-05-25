/** PBR maps for the premium 8-ball FBX (`Front_Side`, `lambert1`, `Back_Side`) */

import backAlbedo from '../assets/models/8ball/source/Back_Side_albedo.jpg';
import backAo from '../assets/models/8ball/source/Back_Side_AO.jpg';
import backMetal from '../assets/models/8ball/source/Back_Side_metallic.jpg';
import backNormal from '../assets/models/8ball/source/Back_Side_normal.png';
import backRough from '../assets/models/8ball/source/Back_Side_roughness.jpg';
import frontAlbedo from '../assets/models/8ball/source/Front_Side_albedo.jpg';
import frontAo from '../assets/models/8ball/source/Front_Side_AO.jpg';
import frontMetal from '../assets/models/8ball/source/Front_Side_metallic.jpg';
import frontNormal from '../assets/models/8ball/source/Front_Side_normal.png';
import frontRough from '../assets/models/8ball/source/Front_Side_roughness.jpg';
import bodyAlbedo from '../assets/models/8ball/source/lambert1_albedo.jpg';
import bodyAo from '../assets/models/8ball/source/lambert1_AO.jpg';
import bodyMetal from '../assets/models/8ball/source/lambert1_metallic.jpg';
import bodyNormal from '../assets/models/8ball/source/lambert1_normal.png';
import bodyRough from '../assets/models/8ball/source/lambert1_roughness.jpg';

export type EightBallMaterialKey = 'Front_Side' | 'lambert1' | 'Back_Side';

export type EightBallTextureUrls = {
  albedo: string;
  ao: string;
  metal: string;
  normal: string;
  rough: string;
};

export const EIGHT_BALL_TEXTURE_URLS: Record<
  EightBallMaterialKey,
  EightBallTextureUrls
> = {
  Front_Side: {
    albedo: frontAlbedo,
    ao: frontAo,
    metal: frontMetal,
    normal: frontNormal,
    rough: frontRough,
  },
  lambert1: {
    albedo: bodyAlbedo,
    ao: bodyAo,
    metal: bodyMetal,
    normal: bodyNormal,
    rough: bodyRough,
  },
  Back_Side: {
    albedo: backAlbedo,
    ao: backAo,
    metal: backMetal,
    normal: backNormal,
    rough: backRough,
  },
};

export function resolveEightBallMaterialKey(
  materialName: string,
): EightBallMaterialKey {
  if (materialName === 'Front_Side' || materialName.includes('Front')) {
    return 'Front_Side';
  }
  if (materialName === 'Back_Side' || materialName.includes('Back')) {
    return 'Back_Side';
  }
  return 'lambert1';
}
