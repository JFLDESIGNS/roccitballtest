import * as THREE from 'three';
import { BALL } from '../shared/Constants';

const SAMPLE_INTERVAL =
  BALL.launchMomentumWindowSec / BALL.launchMomentumSampleCount;

export function resetMomentumSamples(
  samples: THREE.Vector3[],
  timer: { current: number },
  initialVel?: THREE.Vector3,
): void {
  samples.length = 0;
  timer.current = 0;
  if (initialVel) samples.push(initialVel.clone());
}

export function tickMomentumSamples(
  samples: THREE.Vector3[],
  timer: { current: number },
  dt: number,
  vel: THREE.Vector3,
): void {
  timer.current += dt;
  while (timer.current >= SAMPLE_INTERVAL) {
    timer.current -= SAMPLE_INTERVAL;
    samples.push(vel.clone());
    while (samples.length > BALL.launchMomentumSampleCount) {
      samples.shift();
    }
  }
}

export function averageMomentum(samples: THREE.Vector3[]): THREE.Vector3 {
  const avg = new THREE.Vector3();
  if (samples.length === 0) return avg;
  for (const s of samples) avg.add(s);
  return avg.divideScalar(samples.length);
}
