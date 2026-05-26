import { MENU_MUSIC_VOLUME_DEFAULT } from './menuOptionDefaults';

const STORAGE_KEY = 'rocketball-menu-music-volume';
const DEFAULT_VOLUME = MENU_MUSIC_VOLUME_DEFAULT;

let menuMusicVolume = loadMenuMusicVolume();

function loadMenuMusicVolume(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_VOLUME;
    const n = Number(raw);
    if (!Number.isFinite(n)) return DEFAULT_VOLUME;
    return Math.max(0, Math.min(1, n));
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
