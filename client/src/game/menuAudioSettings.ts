import { MENU_MUSIC_VOLUME_DEFAULT } from './menuOptionDefaults';

const STORAGE_KEY = 'rocketball-menu-music-volume-v2';
const LEGACY_STORAGE_KEY = 'rocketball-menu-music-volume';
const DEFAULT_VOLUME = MENU_MUSIC_VOLUME_DEFAULT;

let menuMusicVolume = loadMenuMusicVolume();

function loadMenuMusicVolume(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const n = Number(raw);
      if (Number.isFinite(n)) return Math.max(0, Math.min(1, n));
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy !== null) {
      const n = Number(legacy);
      if (Number.isFinite(n)) {
        const halved = Math.max(0, Math.min(1, n * 0.5));
        localStorage.setItem(STORAGE_KEY, String(halved));
        return halved;
      }
    }
    return DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

function persistMenuMusicVolume(): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(menuMusicVolume));
  } catch {
    /* ignore */
  }
}

export function getMenuMusicVolume(): number {
  return menuMusicVolume;
}

export function setMenuMusicVolume(volume: number): void {
  menuMusicVolume = Math.max(0, Math.min(1, volume));
  persistMenuMusicVolume();
}
