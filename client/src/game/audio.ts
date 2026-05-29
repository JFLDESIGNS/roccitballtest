/** Web Audio — procedural fallbacks + user sample clips */

import { getMenuMusicVolume, setMenuMusicVolume } from './menuAudioSettings';
import { tuningStore } from './tuningStore';
import emptyClipUrl from '../assets/sounds/emptyclip.wav';
import shotUrl from '../assets/sounds/shot.flac';
import explosionUrl from '../assets/sounds/explosion.wav';
import chingUrl from '../assets/sounds/ching.mp3';
import cheerUrl from '../assets/sounds/cheering.wav';
import panicUrl from '../assets/sounds/panic.wav';
import goal1Url from '../assets/sounds/goal1.WAV';
import rocketDopeTronUrl from '../assets/sounds/rocket-dope-tron.mp3';
import jumpSoundUrl from '../assets/sounds/jumpsound.mp3';
import grindRailUrl from '../assets/sounds/grind-rail.mp3';
import beamAttractLoopUrl from '../assets/sounds/beamattractloop.mp3';
import newSlapUrl from '../assets/sounds/newslap.wav';
import rimSoundUrl from '../assets/sounds/rimsound.mp3';
import windUrl from '../assets/sounds/wind.mp3';

let ctx: AudioContext | null = null;

let bounceNoiseBuffer: AudioBuffer | null = null;
let lastBallShotAt = 0;

const BALL_SHOT_DEBOUNCE_MS = 120;
const SHOT_SAMPLE_BASE = 0.44;
const ELECTRIC_SLAP_SAMPLE_BASE = 0.58;
const CHING_SAMPLE_BASE = 0.92;
const JUMP_SAMPLE_BASE = 0.62;
const BEAM_ATTRACT_LOOP_GAIN = 0.13;
const WIND_LOOP_GAIN = 0.24;
const WIND_START_SPEED_MPS = 15;
const WIND_FULL_SPEED_MPS = 54;
/** Menu + in-match loops (Rocket Dope Tron) */
export const BACKGROUND_MUSIC_ENABLED = true;

/** Menu / title screen — kept low under master + menu slider */
const BG_MUSIC_MENU_BASE = 0.035;
/** In-match / pregame loop — quieter than menu so SFX stay forward */
const BG_MUSIC_GAME_BASE = 0.01375;
const CHEER_BASE = 0.46;
const CHEER_HOLD_SEC = 4;
const CHEER_FADE_SEC = 1.5;
const PANIC_HOLD_SEC = 3;
const PANIC_FADE_SEC = 1;
/** Rocket / glass stand reactions — home cheer + away panic (50% of prior level) */
const FAN_GLASS_CHEER_BASE = 2.97 * 0.5;
const FAN_GLASS_PANIC_BASE = 10.26 * 0.5;
const FAN_GLASS_CHEER_HOLD_SEC = 3;
const FAN_GLASS_CHEER_FADE_SEC = 1;
const GOAL_CHEER_VOLUME = 0.5;
const GOAL1_SAMPLE_BASE = 0.145;
const SAMPLE_START_OFFSET_MIN_SEC = 0.3;
/** Random crowd entry points span deep into long wav clips (sec) */
const SAMPLE_START_OFFSET_MAX_SEC = 48;
/** Hard cap on goal cheer / generic crowd WebAudio gain */
const CROWD_PEAK_GAIN_CAP = 0.16;
/** Higher cap for fan-glass hits so distance falloff can actually get loud up close */
const FAN_GLASS_PEAK_GAIN_CAP = 4.5;
/** Glass hits allow distance multiplier above 1.0 (same radius curve, louder overall) */
const FAN_GLASS_VOLUME_MUL_MAX = 3;
const GLASS_AUDIO_COOLDOWN_MS = 500;
let lastGlassCrowdAudioAt = 0;
/** Suppress surface bounce SFX right after a shot (avoids double-audio with shot.flac) */
let suppressBallBounceUntil = 0;

type LoopingTrack = {
  source: AudioBufferSourceNode;
  gain: GainNode;
};

/** Long crowd clips — retain pre-master peak for live master slider updates */
type TimedCrowdTrack = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  localPeak: number;
  peakGainCap: number;
};

let bgMusicTrack: LoopingTrack | null = null;
let grindRailTrack: LoopingTrack | null = null;
let beamAttractTrack: LoopingTrack | null = null;
let beamAttractLoading = false;
let windTrack: LoopingTrack | null = null;
let windLoading = false;
let bgMusicMode: 'menu' | 'game' | null = null;
/** Bumps when a new start is requested or music stops — stale async loads bail out */
let bgMusicStartGen = 0;
/** In-flight loop start (avoids double `source.start` before `bgMusicTrack` is set) */
let bgMusicLoadingMode: 'menu' | 'game' | null = null;
let cheerTrack: TimedCrowdTrack | null = null;
let panicTrack: TimedCrowdTrack | null = null;
let masterVolumeListenerBound = false;
const activeBeamAttractKeys = new Set<string>();
let windLevel = 0;

const sampleBuffers = new Map<string, AudioBuffer | null>();
const sampleLoads = new Map<string, Promise<AudioBuffer | null>>();

/** Base loudness before the tuning panel master slider */
const BASE_MASTER = 0.32;

function loadSample(url: string): Promise<AudioBuffer | null> {
  const cached = sampleBuffers.get(url);
  if (cached) return Promise.resolve(cached);

  const pending = sampleLoads.get(url);
  if (pending) return pending;

  const promise = (async () => {
    const ac = getCtx();
    if (!ac) return null;
    try {
      const res = await fetch(url);
      const data = await res.arrayBuffer();
      const decoded = await ac.decodeAudioData(data.slice(0));
      sampleBuffers.set(url, decoded);
      return decoded;
    } catch {
      sampleBuffers.set(url, null);
      return null;
    } finally {
      sampleLoads.delete(url);
    }
  })();

  sampleLoads.set(url, promise);
  return promise;
}

const GAME_AUDIO_PRELOAD_URLS = [
  emptyClipUrl,
  shotUrl,
  explosionUrl,
  chingUrl,
  cheerUrl,
  panicUrl,
  goal1Url,
  rocketDopeTronUrl,
  jumpSoundUrl,
  grindRailUrl,
  beamAttractLoopUrl,
  newSlapUrl,
  rimSoundUrl,
  windUrl,
] as const;

function preloadSamples(): void {
  for (const url of GAME_AUDIO_PRELOAD_URLS) {
    void loadSample(url);
  }
}

/** Decode gameplay samples one at a time so the menu stays responsive */
export async function preloadGameAudioSamples(
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const total = GAME_AUDIO_PRELOAD_URLS.length;
  for (let i = 0; i < total; i++) {
    await loadSample(GAME_AUDIO_PRELOAD_URLS[i]!);
    onProgress?.(i + 1, total);
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
}

const FT = 0.3048;

/** Rocket explosion SFX — loud when close, still audible far away (~3× prior tail). */
export function explosionVolumeByDistanceFt(distFt: number): number {
  const maxVol = 1.2;
  const minVol = 0.2;
  const fullDistFt = 22;
  const silentDistFt = 150;
  if (distFt <= fullDistFt) return maxVol;
  if (distFt >= silentDistFt) return minVol;
  const t = (distFt - fullDistFt) / (silentDistFt - fullDistFt);
  const eased = t * t;
  return maxVol + (minVol - maxVol) * eased;
}

export function explosionVolumeByDistanceM(
  distM: number,
): number {
  return explosionVolumeByDistanceFt(distM / FT);
}

/**
 * Stand crowd reaction vs distance to glass (feet).
 * Quiet when close; barely audible far away (rocket hits near stands).
 */
export function crowdVolumeByDistanceFt(distFt: number): number {
  if (distFt <= 12) return 0.26;
  if (distFt <= 30) return 0.26 + ((0.1 - 0.26) * (distFt - 12)) / 18;
  if (distFt <= 58) return 0.1 + ((0.04 - 0.1) * (distFt - 30)) / 28;
  if (distFt <= 95) return 0.04 + ((0.015 - 0.04) * (distFt - 58)) / 37;
  return 0.012;
}

export function crowdVolumeByDistanceM(distM: number): number {
  return crowdVolumeByDistanceFt(distM / FT);
}

/**
 * Fan-glass cheer/panic — louder when the listener is near the hit stand.
 */
const FAN_GLASS_CROWD_DISTANCE_VOL = 0.5;

export function fanGlassVolumeByDistanceFt(distFt: number): number {
  let v: number;
  if (distFt <= 14) v = 1;
  else if (distFt <= 32) v = 1 + ((0.72 - 1) * (distFt - 14)) / 18;
  else if (distFt <= 58) v = 0.72 + ((0.32 - 0.72) * (distFt - 32)) / 26;
  else if (distFt <= 100) v = 0.32 + ((0.12 - 0.32) * (distFt - 58)) / 42;
  else v = 0.12;
  return v * FAN_GLASS_CROWD_DISTANCE_VOL;
}

export function fanGlassVolumeByDistanceM(distM: number): number {
  return fanGlassVolumeByDistanceFt(distM / FT);
}

function playSample(
  url: string,
  volume = 1,
  useImpact = false,
  playbackRate = 1,
): void {
  const ac = getCtx();
  if (!ac) return;

  const g = useImpact ? impactGain(volume) : sfxGain(volume);
  if (g < 0.0005) return;

  const playBuffer = (buffer: AudioBuffer) => {
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = playbackRate;
    const gainNode = ac.createGain();
    gainNode.gain.value = g;
    src.connect(gainNode);
    gainNode.connect(ac.destination);
    src.start();
  };

  const cached = sampleBuffers.get(url);
  if (cached) {
    playBuffer(cached);
    return;
  }

  void loadSample(url).then((buffer) => {
    if (buffer) playBuffer(buffer);
  });
}

export function setPlayerWindSpeed(speedMps: number, flying = false): void {
  const ac = getCtx();
  if (!ac) return;

  const base = Math.max(
    0,
    Math.min(
      1,
      (speedMps - WIND_START_SPEED_MPS) /
        (WIND_FULL_SPEED_MPS - WIND_START_SPEED_MPS),
    ),
  );
  const target = Math.max(0, Math.min(1, base + (flying ? 0.18 : 0)));
  windLevel = target;

  if (target <= 0.01) {
    if (!windTrack) {
      windLoading = false;
      return;
    }
    const { source, gain } = windTrack;
    const t = ac.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.22);
    try {
      source.stop(t + 0.24);
    } catch {
      /* already stopped */
    }
    windTrack = null;
    windLoading = false;
    return;
  }

  if (windTrack) {
    const t = ac.currentTime;
    windTrack.gain.gain.cancelScheduledValues(t);
    windTrack.gain.gain.setValueAtTime(windTrack.gain.gain.value, t);
    windTrack.gain.gain.linearRampToValueAtTime(
      sfxGain(WIND_LOOP_GAIN * target),
      t + 0.12,
    );
    return;
  }

  if (windLoading) return;
  windLoading = true;
  void loadSample(windUrl).then((buffer) => {
    const live = getCtx();
    windLoading = false;
    if (!buffer || !live || windTrack || windLevel <= 0.01) return;
    const source = live.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = live.createGain();
    const t = live.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(
      sfxGain(WIND_LOOP_GAIN * windLevel),
      t + 0.14,
    );
    source.connect(gain);
    gain.connect(live.destination);
    source.start(t);
    windTrack = { source, gain };
    source.onended = () => {
      if (windTrack?.source === source) windTrack = null;
    };
  });
}

export function resumeAudio(): void {
  getCtx();
  preloadSamples();
  bindMasterVolumeListener();
}

/** Cut a looping track immediately so a new loop cannot overlap the old one. */
function disconnectLoopingTrack(track: LoopingTrack): void {
  const ac = getCtx();
  if (!ac) return;
  const { source, gain } = track;
  const t = ac.currentTime;
  try {
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(0, t);
  } catch {
    /* ignore */
  }
  try {
    source.stop(t);
  } catch {
    try {
      source.stop();
    } catch {
      /* already stopped */
    }
  }
  try {
    source.disconnect();
  } catch {
    /* ignore */
  }
  try {
    gain.disconnect();
  } catch {
    /* ignore */
  }
}

function stopBgMusic(): void {
  bgMusicStartGen += 1;
  bgMusicLoadingMode = null;

  const track = bgMusicTrack;
  bgMusicTrack = null;
  bgMusicMode = null;
  if (track) disconnectLoopingTrack(track);
}

function stopGrindRailLoop(): void {
  const track = grindRailTrack;
  grindRailTrack = null;
  if (track) disconnectLoopingTrack(track);
}

function stopBeamAttractLoop(): void {
  beamAttractLoading = false;
  activeBeamAttractKeys.clear();
  const track = beamAttractTrack;
  beamAttractTrack = null;
  if (track) disconnectLoopingTrack(track);
}

function stopWindLoop(): void {
  windLoading = false;
  windLevel = 0;
  const track = windTrack;
  windTrack = null;
  if (track) disconnectLoopingTrack(track);
}

function isBgMusicActive(mode: 'menu' | 'game'): boolean {
  return bgMusicMode === mode && bgMusicTrack !== null;
}

function menuBgMusicGain(): number {
  return sfxGain(BG_MUSIC_MENU_BASE * getMenuMusicVolume());
}

function gameBgMusicGain(): number {
  return sfxGain(BG_MUSIC_GAME_BASE);
}

function timedCrowdPeak(localPeak: number, peakGainCap: number): number {
  return Math.min(sfxGain(localPeak), peakGainCap);
}

/** Re-apply master slider to anything still playing */
function applyActiveAudioMasterVolume(): void {
  const ac = getCtx();
  if (!ac) return;
  const t = ac.currentTime;

  if (bgMusicTrack) {
    bgMusicTrack.gain.gain.cancelScheduledValues(t);
    const gain =
      bgMusicMode === 'menu' ? menuBgMusicGain() : gameBgMusicGain();
    bgMusicTrack.gain.gain.setValueAtTime(gain, t);
  }

  if (grindRailTrack) {
    grindRailTrack.gain.gain.cancelScheduledValues(t);
    grindRailTrack.gain.gain.setValueAtTime(sfxGain(0.09), t);
  }

  if (beamAttractTrack) {
    beamAttractTrack.gain.gain.cancelScheduledValues(t);
    beamAttractTrack.gain.gain.setValueAtTime(
      sfxGain(BEAM_ATTRACT_LOOP_GAIN),
      t,
    );
  }

  if (windTrack) {
    windTrack.gain.gain.cancelScheduledValues(t);
    windTrack.gain.gain.setValueAtTime(
      sfxGain(WIND_LOOP_GAIN * windLevel),
      t,
    );
  }

  for (const track of [cheerTrack, panicTrack]) {
    if (!track) continue;
    const peak = timedCrowdPeak(track.localPeak, track.peakGainCap);
    track.gain.gain.cancelScheduledValues(t);
    track.gain.gain.setValueAtTime(
      Math.min(track.gain.gain.value, peak) || peak,
      t,
    );
  }
}

function bindMasterVolumeListener(): void {
  if (masterVolumeListenerBound) return;
  masterVolumeListenerBound = true;
  let prev = tuningStore.getState().masterVolume;
  tuningStore.subscribe(() => {
    const next = tuningStore.getState().masterVolume;
    if (next === prev) return;
    prev = next;
    applyActiveAudioMasterVolume();
  });
}

function applyMenuBgMusicGain(): void {
  if (bgMusicMode !== 'menu' || !bgMusicTrack) return;
  bgMusicTrack.gain.gain.value = menuBgMusicGain();
}

function startBgMusicLoop(mode: 'menu' | 'game'): void {
  const ac = getCtx();
  if (!ac) return;

  if (isBgMusicActive(mode)) {
    if (mode === 'menu') applyMenuBgMusicGain();
    else if (bgMusicTrack) bgMusicTrack.gain.gain.value = gameBgMusicGain();
    return;
  }
  if (bgMusicLoadingMode === mode) return;

  stopBgMusic();
  bgMusicLoadingMode = mode;
  const startGen = bgMusicStartGen;

  void loadSample(rocketDopeTronUrl).then((buffer) => {
    if (startGen !== bgMusicStartGen) return;
    if (bgMusicLoadingMode !== mode) return;

    const live = getCtx();
    if (!buffer || !live) {
      if (bgMusicLoadingMode === mode) bgMusicLoadingMode = null;
      return;
    }

    if (isBgMusicActive(mode)) {
      bgMusicLoadingMode = null;
      return;
    }

    const stale = bgMusicTrack;
    if (stale) disconnectLoopingTrack(stale);

    const source = live.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = live.createGain();
    gain.gain.value = mode === 'menu' ? menuBgMusicGain() : gameBgMusicGain();

    source.connect(gain);
    gain.connect(live.destination);
    source.start(0);

    bgMusicTrack = { source, gain };
    bgMusicMode = mode;
    bgMusicLoadingMode = null;
  });
}

/** Stop menu or match background loop (e.g. leaving menu for arena) */
export function stopBackgroundMusic(): void {
  stopBgMusic();
}

/** Title / main menu — loop from start */
export function startMenuBackgroundMusic(): void {
  if (!BACKGROUND_MUSIC_ENABLED) {
    stopBgMusic();
    return;
  }
  if (isBgMusicActive('menu') || bgMusicLoadingMode === 'menu') {
    applyMenuBgMusicGain();
    return;
  }
  startBgMusicLoop('menu');
}

/** Menu slider — updates live gain when title music is playing */
export function setMenuBackgroundMusicVolume(volume: number): void {
  setMenuMusicVolume(volume);
  applyMenuBgMusicGain();
}

/** Match gameplay — stop, restart from beginning, loop at ~20% */
export function restartGameplayBackgroundMusic(): void {
  if (!BACKGROUND_MUSIC_ENABLED) {
    stopBgMusic();
    return;
  }
  if (isBgMusicActive('game') || bgMusicLoadingMode === 'game') {
    if (bgMusicTrack && bgMusicMode === 'game') {
      bgMusicTrack.gain.gain.value = gameBgMusicGain();
    }
    return;
  }
  startBgMusicLoop('game');
}

/** Leaving a match back to menu */
export function returnToMenuAudio(): void {
  stopMatchAudio();
  if (BACKGROUND_MUSIC_ENABLED) startMenuBackgroundMusic();
}

function randomSampleStartOffset(buffer: AudioBuffer, playSec: number): number {
  const min = SAMPLE_START_OFFSET_MIN_SEC;
  const playable = buffer.duration - playSec - 0.12;
  const max = Math.min(SAMPLE_START_OFFSET_MAX_SEC, playable);
  if (max <= min) return Math.max(0, Math.min(min, playable));
  return min + Math.random() * (max - min);
}

function playTimedSample(
  url: string,
  localPeak: number,
  holdSec: number,
  fadeSec: number,
  randomStart: boolean,
  assignTrack: (track: TimedCrowdTrack | null) => void,
  getTrack: () => TimedCrowdTrack | null,
  volumeMul = 1,
  peakGainCap = CROWD_PEAK_GAIN_CAP,
  volumeMulMax = 1,
): void {
  const ac = getCtx();
  if (!ac) return;

  const localScaled =
    localPeak * Math.max(0, Math.min(volumeMulMax, volumeMul));
  const scaledPeak = timedCrowdPeak(localScaled, peakGainCap);
  if (scaledPeak < 0.0005) return;

  const prev = getTrack();
  if (prev) {
    const t = ac.currentTime;
    prev.gain.gain.cancelScheduledValues(t);
    const current = Math.min(prev.gain.gain.value, peakGainCap);
    prev.gain.gain.setValueAtTime(current, t);
    prev.gain.gain.linearRampToValueAtTime(0.001, t + 0.14);
    try {
      prev.source.stop(t + 0.15);
    } catch {
      /* already stopped */
    }
    assignTrack(null);
  }

  void loadSample(url).then((buffer) => {
    const live = getCtx();
    if (!buffer || !live) return;

    const source = live.createBufferSource();
    source.buffer = buffer;

    const gain = live.createGain();
    const t0 = live.currentTime;
    const fadeEnd = t0 + holdSec + fadeSec;
    const playSec = holdSec + fadeSec;
    const startOffset = randomStart ? randomSampleStartOffset(buffer, playSec) : 0;

    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.linearRampToValueAtTime(scaledPeak, t0 + 0.1);
    gain.gain.setValueAtTime(scaledPeak, t0 + holdSec);
    gain.gain.linearRampToValueAtTime(0.001, fadeEnd);

    source.connect(gain);
    gain.connect(live.destination);
    source.start(t0, startOffset);
    source.stop(fadeEnd + 0.05);

    const track: TimedCrowdTrack = {
      source,
      gain,
      localPeak: localScaled,
      peakGainCap,
    };
    assignTrack(track);
    source.onended = () => {
      if (getTrack()?.source === source) assignTrack(null);
    };
  });
}

function stopCheer(): void {
  if (!cheerTrack) return;
  const ac = getCtx();
  if (!ac) return;
  const { source, gain } = cheerTrack;
  const t = ac.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(gain.gain.value, t);
  gain.gain.linearRampToValueAtTime(0.001, t + 0.12);
  try {
    source.stop(t + 0.15);
  } catch {
    /* already stopped */
  }
  cheerTrack = null;
}

function playCheerSample(
  holdSec = CHEER_HOLD_SEC,
  fadeSec = CHEER_FADE_SEC,
  randomStart = false,
  volumeMul = 1,
): void {
  playTimedSample(
    cheerUrl,
    CHEER_BASE,
    holdSec,
    fadeSec,
    randomStart,
    (t) => {
      cheerTrack = t;
    },
    () => cheerTrack,
    volumeMul,
  );
}

function stopPanic(): void {
  if (!panicTrack) return;
  const ac = getCtx();
  if (!ac) return;
  const { source, gain } = panicTrack;
  const t = ac.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(gain.gain.value, t);
  gain.gain.linearRampToValueAtTime(0.001, t + 0.12);
  try {
    source.stop(t + 0.15);
  } catch {
    /* already stopped */
  }
  panicTrack = null;
}

function fanGlassCrowdLevel(): number {
  return Math.max(0, tuningStore.getState().fanGlassCrowdVolume);
}

/** Crowd panic when fan glass is hit — capped gain, debounced */
export function playFanGlassPanic(volumeMul = 1): void {
  const now = performance.now();
  if (now - lastGlassCrowdAudioAt < GLASS_AUDIO_COOLDOWN_MS) return;
  lastGlassCrowdAudioAt = now;
  const crowd = fanGlassCrowdLevel();
  if (crowd < 0.001) return;
  playTimedSample(
    panicUrl,
    FAN_GLASS_PANIC_BASE * crowd,
    PANIC_HOLD_SEC,
    PANIC_FADE_SEC,
    true,
    (t) => {
      panicTrack = t;
    },
    () => panicTrack,
    volumeMul,
    FAN_GLASS_PEAK_GAIN_CAP,
    FAN_GLASS_VOLUME_MUL_MAX,
  );
}

/** Home-side fan glass hit — cheer 3s then 1s fade */
export function playFanGlassCheer(volumeMul = 1): void {
  const now = performance.now();
  if (now - lastGlassCrowdAudioAt < GLASS_AUDIO_COOLDOWN_MS) return;
  lastGlassCrowdAudioAt = now;
  const crowd = fanGlassCrowdLevel();
  if (crowd < 0.001) return;
  playTimedSample(
    cheerUrl,
    FAN_GLASS_CHEER_BASE * crowd,
    FAN_GLASS_CHEER_HOLD_SEC,
    FAN_GLASS_CHEER_FADE_SEC,
    true,
    (t) => {
      cheerTrack = t;
    },
    () => cheerTrack,
    volumeMul,
    FAN_GLASS_PEAK_GAIN_CAP,
    FAN_GLASS_VOLUME_MUL_MAX,
  );
}

/** Prime AudioContext and nodes so first beam / shot does not hitch */
function ensureBounceNoiseBuffer(ac: AudioContext): void {
  if (bounceNoiseBuffer) return;
  const duration = 0.08;
  bounceNoiseBuffer = ac.createBuffer(
    1,
    Math.floor(ac.sampleRate * duration),
    ac.sampleRate,
  );
  const data = bounceNoiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
}

export function warmAudio(): void {
  const ac = getCtx();
  if (!ac) return;

  preloadSamples();

  const buffer = ac.createBuffer(1, 1, ac.sampleRate);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const gain = ac.createGain();
  gain.gain.value = 0.0001;
  src.connect(gain);
  gain.connect(ac.destination);
  const t = ac.currentTime;
  src.start(t);
  src.stop(t + 0.002);
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function masterMul(): number {
  return BASE_MASTER * tuningStore.getState().masterVolume;
}

/** General SFX gain */
function sfxGain(local = 1): number {
  return masterMul() * local;
}

/** Rockets / explosions — extra impact slider */
function impactGain(local = 1): number {
  const { impactVolume } = tuningStore.getState();
  return sfxGain(local * impactVolume);
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType,
  gain: number,
  freqEnd?: number,
  when = 0,
  useImpact = false,
) {
  const ac = getCtx();
  if (!ac) return;
  const g = useImpact ? impactGain(gain) : sfxGain(gain);
  if (g < 0.0005) return;

  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const gainNode = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, freqEnd),
      t0 + duration,
    );
  }
  gainNode.gain.setValueAtTime(g, t0);
  gainNode.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gainNode);
  gainNode.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function playNoiseBurst(
  duration: number,
  gain: number,
  when = 0,
  useImpact = false,
) {
  const ac = getCtx();
  if (!ac) return;
  const g = useImpact ? impactGain(gain) : sfxGain(gain);
  if (g < 0.0005) return;

  const t0 = ac.currentTime + when;
  const noise = ac.createBufferSource();
  if (duration <= 0.09) {
    ensureBounceNoiseBuffer(ac);
    noise.buffer = bounceNoiseBuffer;
  } else {
    const buffer = ac.createBuffer(
      1,
      Math.floor(ac.sampleRate * duration),
      ac.sampleRate,
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    noise.buffer = buffer;
  }
  const gainNode = ac.createGain();
  gainNode.gain.setValueAtTime(g, t0);
  gainNode.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  noise.connect(gainNode);
  gainNode.connect(ac.destination);
  noise.start(t0);
  noise.stop(t0 + duration);
}

/** Magazine empty or max rockets in flight */
export function playRocketEmpty() {
  if (!getCtx()) return;
  playSample(emptyClipUrl, 0.48);
}

/** Beam attempted without a valid ball lock. */
export function playBeamNoLock() {
  if (!getCtx()) return;
  playTone(180, 0.05, 'square', 0.032);
  playTone(132, 0.07, 'sawtooth', 0.026, undefined, 0.045);
  playNoiseBurst(0.045, 0.018, 0.015);
}

function playShotSample(): void {
  const now = performance.now();
  if (now - lastBallShotAt < BALL_SHOT_DEBOUNCE_MS) return;
  lastBallShotAt = now;
  playSample(shotUrl, SHOT_SAMPLE_BASE * tuningStore.getState().shotVolume);
}

/** Rocket fired — same sample as ball shot */
export function playRocketFire(_explosive?: boolean) {
  if (!getCtx()) return;
  playShotSample();
}

/** Rocket / explosive detonation (wall, player, ball, etc.) */
export function playRocketExplosion(
  radius = 7,
  explosionPos?: { x: number; y: number; z: number },
  listenerPos?: { x: number; y: number; z: number },
) {
  if (!getCtx()) return;

  const scale = Math.min(1.05, 0.7 + radius / 22);
  let distMul = 1;
  if (explosionPos && listenerPos) {
    const dist = Math.hypot(
      explosionPos.x - listenerPos.x,
      explosionPos.y - listenerPos.y,
      explosionPos.z - listenerPos.z,
    );
    distMul = explosionVolumeByDistanceM(dist);
  } else {
    distMul = 0.35;
  }
  playSample(explosionUrl, 0.72 * scale * distMul, true);
}

/** WW forward dash */
export function playDash() {
  if (!getCtx()) return;
  playTone(120, 0.06, 'sine', 0.03, 200, 0.02);
  playTone(340, 0.11, 'triangle', 0.034, 480, 0.04);
  playNoiseBurst(0.05, 0.04);
}

export function playEnergyPickup() {
  if (!getCtx()) return;
  playTone(520, 0.08, 'triangle', 0.025, 760);
  playTone(980, 0.12, 'sine', 0.025, 1480, 0.035);
  playNoiseBurst(0.035, 0.012, 0.02);
}

/** Ceiling bump — small sci-fi tick */
export function playCeilingBump(impactSpeed: number) {
  if (!getCtx()) return;
  const min = 1.6;
  if (impactSpeed < min) return;
  const t = Math.min(1, (impactSpeed - min) / 18);
  const g = 0.02 + t * 0.03;
  playTone(720 + t * 220, 0.06 + t * 0.02, 'triangle', g, 380, 0.0, true);
  playTone(1400 + t * 520, 0.04 + t * 0.02, 'sine', g * 0.55, 520, 0.01, true);
  playNoiseBurst(0.02 + t * 0.015, g * 0.35, 0.0, true);
}

/** Player jump — 0 ground, 1 double, 2 triple */
export function playJump(jumpIndex: number) {
  if (!getCtx()) return;
  const rate =
    jumpIndex >= 2 ? 1.14 : jumpIndex >= 1 ? 1.07 : 1;
  playSample(jumpSoundUrl, JUMP_SAMPLE_BASE, false, rate);
}

/** Ball surface impact — louder when collision speed is higher */
export function playBallBounce(impactSpeed: number) {
  if (!getCtx()) return;
  if (shouldSuppressBallBounceSound()) return;

  import('./gameStore').then(({ isCombatGraceActive }) => {
    if (isCombatGraceActive()) return;

    const min = 1.4;
    if (impactSpeed < min) return;

    const t = Math.min(1, (impactSpeed - min) / 18);
    const thump = 0.032 + t * 0.062;
    playTone(180 + t * 120, 0.04 + t * 0.03, 'sine', thump, 90 + t * 40);
    playTone(420 + t * 220, 0.028 + t * 0.02, 'triangle', thump * 0.5, 240, 0.008);
    playTone(720 + t * 280, 0.015 + t * 0.012, 'sine', thump * 0.28, 1100, 0.012);
    playNoiseBurst(0.022 + t * 0.028, thump * 0.62);
  });
}

/** Local player hits a bot (rocket / ball) */
export function playBotHit() {
  if (!getCtx()) return;
  playSample(chingUrl, CHING_SAMPLE_BASE * tuningStore.getState().chingVolume);
}

/** Reward sting when your shot connects with a player / bot */
export function playPlayerHit() {
  playBotHit();
}

/** Ball clips a goal ring rim — metallic clang */
export function playGoalRimHit(impactSpeed: number) {
  if (!getCtx()) return;

  const min = 2.2;
  if (impactSpeed < min) return;
  const t = Math.min(1, (impactSpeed - min) / 22);
  playSample(rimSoundUrl, 0.42 + t * 0.58, true, 0.96 + t * 0.08);
}

/** Continuous magnetic beam hum while attracting */
export function setBeamAttractActive(active: boolean, key = 'local') {
  const ac = getCtx();
  if (!ac) return;

  if (active) activeBeamAttractKeys.add(key);
  else activeBeamAttractKeys.delete(key);

  const shouldPlay = activeBeamAttractKeys.size > 0;
  if (!shouldPlay) {
    if (!beamAttractTrack) {
      beamAttractLoading = false;
      return;
    }
    const { source, gain } = beamAttractTrack;
    const t = ac.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.08);
    try {
      source.stop(t + 0.09);
    } catch {
      /* already stopped */
    }
    beamAttractTrack = null;
    beamAttractLoading = false;
    return;
  }

  if (active) {
    if (beamAttractTrack || beamAttractLoading) return;
    beamAttractLoading = true;
    void loadSample(beamAttractLoopUrl).then((buffer) => {
      const live = getCtx();
      beamAttractLoading = false;
      if (!buffer || !live || beamAttractTrack || activeBeamAttractKeys.size === 0) {
        return;
      }
      const source = live.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = live.createGain();
      const t = live.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(
        sfxGain(BEAM_ATTRACT_LOOP_GAIN),
        t + 0.08,
      );
      source.connect(gain);
      gain.connect(live.destination);
      source.start(t);
      beamAttractTrack = { source, gain };
      source.onended = () => {
        if (beamAttractTrack?.source === source) beamAttractTrack = null;
      };
    });
  }
}

export function setGrindRailActive(active: boolean) {
  const ac = getCtx();
  if (!ac) return;

  if (!active) {
    stopGrindRailLoop();
    return;
  }

  if (grindRailTrack) return;

  void loadSample(grindRailUrl).then((buffer) => {
    const live = getCtx();
    if (!buffer || !live || grindRailTrack) return;
    const source = live.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = live.createGain();
    gain.gain.value = sfxGain(0.09);
    source.connect(gain);
    gain.connect(live.destination);
    source.start(0);
    grindRailTrack = { source, gain };
    source.onended = () => {
      if (grindRailTrack?.source === source) grindRailTrack = null;
    };
  });
}

/** Ball shot / throw — user sample only (no procedural fallback) */
export function playBallLaunch() {
  if (!getCtx()) return;
  suppressBallBounceUntil = performance.now() + 200;
  const now = performance.now();
  if (now - lastBallShotAt < BALL_SHOT_DEBOUNCE_MS) return;
  lastBallShotAt = now;
  playSample(
    newSlapUrl,
    ELECTRIC_SLAP_SAMPLE_BASE * tuningStore.getState().shotVolume,
  );
}

/** Skip floor/wall bounce SFX immediately after a ball shot */
export function shouldSuppressBallBounceSound(): boolean {
  return performance.now() < suppressBallBounceUntil;
}

/** Suppress ball bounce SFX (spawn, pointer-lock click bleed, etc.) */
export function suppressBallBounceForMs(ms: number): void {
  suppressBallBounceUntil = performance.now() + ms;
}

/** Goal scored — crowd cheer + goal1 sting (volume from tuning → Audio tab) */
export function playGoalCelebration() {
  if (!getCtx()) return;
  playCheerSample(CHEER_HOLD_SEC, CHEER_FADE_SEC, true, GOAL_CHEER_VOLUME);
  const goal1Mul = tuningStore.getState().goal1Volume;
  playSample(goal1Url, GOAL1_SAMPLE_BASE * goal1Mul);
}

export function stopMatchAudio(): void {
  stopGrindRailLoop();
  stopBeamAttractLoop();
  stopWindLoop();
  stopCheer();
  stopPanic();
  stopBgMusic();
}

bindMasterVolumeListener();
