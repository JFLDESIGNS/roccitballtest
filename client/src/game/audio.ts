/** Web Audio — procedural fallbacks + user sample clips */

import { tuningStore } from './tuningStore';
import emptyClipUrl from '../assets/sounds/emptyclip.wav';
import shotUrl from '../assets/sounds/shot.flac';
import explosionUrl from '../assets/sounds/explosion.wav';
import chingUrl from '../assets/sounds/ching.mp3';
import ambientUrl from '../assets/sounds/ambient.wav';
import cheerUrl from '../assets/sounds/cheering.wav';
import panicUrl from '../assets/sounds/panic.wav';
import goal1Url from '../assets/sounds/goal1.WAV';

let ctx: AudioContext | null = null;

type BeamSound = {
  osc: OscillatorNode;
  gain: GainNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
};

let beamSound: BeamSound | null = null;
let bounceNoiseBuffer: AudioBuffer | null = null;
let lastBallShotAt = 0;

const BALL_SHOT_DEBOUNCE_MS = 120;
const SHOT_SAMPLE_BASE = 0.44;
const CHING_SAMPLE_BASE = 0.92;
const AMBIENT_BASE = 0.1;
const CHEER_BASE = 0.46;
const CHEER_HOLD_SEC = 4;
const CHEER_FADE_SEC = 1.5;
const PANIC_HOLD_SEC = 3;
const PANIC_FADE_SEC = 1;
/** Rocket / glass stand reactions — quieter than goal cheer */
const FAN_GLASS_CHEER_BASE = 0.22;
const FAN_GLASS_PANIC_BASE = 0.38;
const FAN_GLASS_CHEER_HOLD_SEC = 3;
const FAN_GLASS_CHEER_FADE_SEC = 1;
const GOAL_CHEER_VOLUME = 0.5;
const GOAL1_SAMPLE_BASE = 0.145;
const SAMPLE_START_OFFSET_MIN_SEC = 0.3;
/** Random crowd entry points span deep into long wav clips (sec) */
const SAMPLE_START_OFFSET_MAX_SEC = 48;
/** Hard cap on stand crowd / panic WebAudio gain */
const CROWD_PEAK_GAIN_CAP = 0.16;
const GLASS_AUDIO_COOLDOWN_MS = 500;
let lastGlassCrowdAudioAt = 0;
/** Suppress surface bounce SFX right after a shot (avoids double-audio with shot.flac) */
let suppressBallBounceUntil = 0;

type LoopingTrack = {
  source: AudioBufferSourceNode;
  gain: GainNode;
};

let ambientTrack: LoopingTrack | null = null;
let cheerTrack: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
let panicTrack: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

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

function preloadSamples(): void {
  void loadSample(emptyClipUrl);
  void loadSample(shotUrl);
  void loadSample(explosionUrl);
  void loadSample(chingUrl);
  void loadSample(ambientUrl);
  void loadSample(cheerUrl);
  void loadSample(panicUrl);
  void loadSample(goal1Url);
}

const FT = 0.3048;

/** Explosion loudness vs listener distance (feet). */
export function explosionVolumeByDistanceFt(distFt: number): number {
  if (distFt <= 10) return 1;
  if (distFt <= 20) return 1 + ((0.8 - 1) * (distFt - 10)) / 10;
  if (distFt <= 25) return 0.8 + ((0.6 - 0.8) * (distFt - 20)) / 5;
  if (distFt <= 40) return 0.6 + ((0.2 - 0.6) * (distFt - 25)) / 15;
  return 0.2;
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

export function resumeAudio(): void {
  getCtx();
  preloadSamples();
  startAmbientLoop();
}

function stopAmbientLoop(): void {
  if (!ambientTrack) return;
  const ac = getCtx();
  if (!ac) return;
  const { source, gain } = ambientTrack;
  const t = ac.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(gain.gain.value, t);
  gain.gain.linearRampToValueAtTime(0.001, t + 0.35);
  source.stop(t + 0.4);
  ambientTrack = null;
}

function startAmbientLoop(): void {
  const ac = getCtx();
  if (!ac || ambientTrack) return;

  void loadSample(ambientUrl).then((buffer) => {
    const live = getCtx();
    if (!buffer || !live || ambientTrack) return;

    const source = live.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = live.createGain();
    gain.gain.value = sfxGain(AMBIENT_BASE);

    source.connect(gain);
    gain.connect(live.destination);
    source.start();

    ambientTrack = { source, gain };
  });
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
  peak: number,
  holdSec: number,
  fadeSec: number,
  randomStart: boolean,
  assignTrack: (track: { source: AudioBufferSourceNode; gain: GainNode } | null) => void,
  getTrack: () => { source: AudioBufferSourceNode; gain: GainNode } | null,
  volumeMul = 1,
): void {
  const ac = getCtx();
  if (!ac) return;

  const scaledPeak = Math.min(
    peak * Math.max(0, Math.min(1, volumeMul)),
    CROWD_PEAK_GAIN_CAP,
  );
  if (scaledPeak < 0.0005) return;

  const prev = getTrack();
  if (prev) {
    const t = ac.currentTime;
    prev.gain.gain.cancelScheduledValues(t);
    const current = Math.min(prev.gain.gain.value, CROWD_PEAK_GAIN_CAP);
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

    const track = { source, gain };
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
    sfxGain(CHEER_BASE),
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

/** Crowd panic when fan glass is hit — capped gain, debounced */
export function playFanGlassPanic(volumeMul = 1): void {
  const now = performance.now();
  if (now - lastGlassCrowdAudioAt < GLASS_AUDIO_COOLDOWN_MS) return;
  lastGlassCrowdAudioAt = now;
  playTimedSample(
    panicUrl,
    sfxGain(FAN_GLASS_PANIC_BASE),
    PANIC_HOLD_SEC,
    PANIC_FADE_SEC,
    true,
    (t) => {
      panicTrack = t;
    },
    () => panicTrack,
    volumeMul,
  );
}

/** Home-side fan glass hit — cheer 3s then 1s fade */
export function playFanGlassCheer(volumeMul = 1): void {
  const now = performance.now();
  if (now - lastGlassCrowdAudioAt < GLASS_AUDIO_COOLDOWN_MS) return;
  lastGlassCrowdAudioAt = now;
  playTimedSample(
    cheerUrl,
    sfxGain(FAN_GLASS_CHEER_BASE),
    FAN_GLASS_CHEER_HOLD_SEC,
    FAN_GLASS_CHEER_FADE_SEC,
    true,
    (t) => {
      cheerTrack = t;
    },
    () => cheerTrack,
    volumeMul,
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
  playSample(emptyClipUrl, 0.95);
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

  const scale = Math.min(1.15, 0.82 + radius / 18);
  let distMul = 1;
  if (explosionPos && listenerPos) {
    const dist = Math.hypot(
      explosionPos.x - listenerPos.x,
      explosionPos.y - listenerPos.y,
      explosionPos.z - listenerPos.z,
    );
    distMul = explosionVolumeByDistanceM(dist);
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

/** Player jump — 0 ground, 1 double, 2 triple */
export function playJump(jumpIndex: number) {
  if (!getCtx()) return;

  if (jumpIndex >= 2) {
    playTone(360, 0.06, 'sine', 0.034, 620);
    playTone(640, 0.08, 'triangle', 0.024, 920, 0.025);
  } else if (jumpIndex >= 1) {
    playTone(280, 0.07, 'sine', 0.038, 520);
    playTone(520, 0.1, 'triangle', 0.028, 780, 0.03);
  } else {
    playTone(180, 0.09, 'sine', 0.042, 340);
    playTone(95, 0.12, 'triangle', 0.022, 70, 0.04);
  }
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
  const g = 0.038 + t * 0.05;

  playTone(620 + t * 180, 0.1 + t * 0.04, 'square', g, 280, 0, true);
  playTone(1040 + t * 320, 0.14 + t * 0.05, 'sawtooth', g * 0.75, 420, 0.02, true);
  playTone(1680 + t * 400, 0.08 + t * 0.03, 'triangle', g * 0.45, 900, 0.04, true);
  playNoiseBurst(0.035 + t * 0.025, g * 0.55, 0.01, true);
}

/** Continuous magnetic beam hum while attracting */
export function setBeamAttractActive(active: boolean) {
  const ac = getCtx();
  if (!ac) return;

  if (active) {
    if (beamSound) return;

    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const lfo = ac.createOscillator();
    const lfoGain = ac.createGain();

    osc.type = 'sine';
    osc.frequency.value = 165;
    lfo.type = 'sine';
    lfo.frequency.value = 6.5;
    lfoGain.gain.value = 28;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const peak = sfxGain(0.028);
    gain.gain.setValueAtTime(0, ac.currentTime);
    gain.gain.linearRampToValueAtTime(peak, ac.currentTime + 0.06);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    lfo.start();

    beamSound = { osc, gain, lfo, lfoGain };
    return;
  }

  if (!beamSound) return;
  const { osc, gain, lfo } = beamSound;
  const t = ac.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(gain.gain.value, t);
  gain.gain.linearRampToValueAtTime(0, t + 0.07);
  osc.stop(t + 0.08);
  lfo.stop(t + 0.08);
  beamSound = null;
}

/** Ball shot / throw — user sample only (no procedural fallback) */
export function playBallLaunch() {
  if (!getCtx()) return;
  suppressBallBounceUntil = performance.now() + 200;
  playShotSample();
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
  stopCheer();
  stopPanic();
  stopAmbientLoop();
}
