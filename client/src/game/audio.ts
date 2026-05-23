/** Lightweight Web Audio — no asset files */

import { tuningStore } from './tuningStore';

let ctx: AudioContext | null = null;

type BeamSound = {
  osc: OscillatorNode;
  gain: GainNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
};

let beamSound: BeamSound | null = null;
let bounceNoiseBuffer: AudioBuffer | null = null;

/** Base loudness before the tuning panel master slider */
const BASE_MASTER = 0.32;

export function resumeAudio(): void {
  getCtx();
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

  ensureBounceNoiseBuffer(ac);

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

  setBeamAttractActive(true);
  setBeamAttractActive(false);
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

/** Rocket fired — tap vs charged */
export function playRocketFire(explosive: boolean) {
  if (!getCtx()) return;

  if (explosive) {
    playTone(180, 0.05, 'square', 0.028, undefined, 0, true);
    playTone(420, 0.1, 'sawtooth', 0.038, 720, 0, true);
    playNoiseBurst(0.04, 0.028, 0, true);
  } else {
    playTone(320, 0.06, 'triangle', 0.032, undefined, 0, true);
    playTone(680, 0.12, 'sine', 0.042, 1100, 0, true);
    playTone(1200, 0.08, 'sine', 0.022, 900, 0.04, true);
  }
}

/** Rocket / explosive detonation */
export function playRocketExplosion(radius = 7) {
  if (!getCtx()) return;

  const scale = Math.min(1.2, 0.7 + radius / 14);

  playNoiseBurst(0.2 * scale, 0.055 * scale, 0, true);
  playTone(90, 0.32 * scale, 'triangle', 0.048 * scale, 35, 0, true);
  playTone(55, 0.45 * scale, 'sine', 0.032 * scale, 28, 0.05, true);
  playTone(220, 0.07, 'square', 0.018 * scale, 80, 0.02, true);
}

/** Player jump — first vs double */
export function playJump(doubleJump: boolean) {
  if (!getCtx()) return;

  if (doubleJump) {
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

  const min = 1.4;
  if (impactSpeed < min) return;

  const t = Math.min(1, (impactSpeed - min) / 18);
  const thump = 0.032 + t * 0.062;
  playTone(180 + t * 120, 0.04 + t * 0.03, 'sine', thump, 90 + t * 40);
  playTone(420 + t * 220, 0.028 + t * 0.02, 'triangle', thump * 0.5, 240, 0.008);
  playTone(720 + t * 280, 0.015 + t * 0.012, 'sine', thump * 0.28, 1100, 0.012);
  playNoiseBurst(0.022 + t * 0.028, thump * 0.62);
}

/** Reward sting when your shot connects with a player / bot */
export function playPlayerHit() {
  if (!getCtx()) return;

  playTone(1568, 0.05, 'sine', 0.038, 2100);
  playTone(2093, 0.07, 'triangle', 0.042, 2637, 0.025);
  playTone(2637, 0.09, 'sine', 0.034, 3136, 0.05);
  playTone(3136, 0.11, 'triangle', 0.028, 3520, 0.08);
  playTone(1200, 0.04, 'square', 0.012, 1800, 0.1);
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

/** Magnetic launch / throw from beam */
export function playBallLaunch() {
  if (!getCtx()) return;

  playTone(220, 0.08, 'square', 0.032);
  playTone(520, 0.14, 'sine', 0.048, 880);
  playTone(140, 0.18, 'triangle', 0.026, 90);
  playNoiseBurst(0.06, 0.022);
}

/** Goal scored — celebratory burst */
export function playGoalCelebration() {
  if (!getCtx()) return;

  const times = [0, 0.06, 0.12, 0.2, 0.28, 0.38];
  const freqs = [523, 659, 784, 988, 1175, 1568];
  times.forEach((when, i) => {
    window.setTimeout(
      () => playTone(freqs[i], 0.22, 'sine', 0.042, freqs[i] * 1.2),
      when * 1000,
    );
  });
  window.setTimeout(() => playTone(80, 0.5, 'triangle', 0.038, 40), 50);
}
