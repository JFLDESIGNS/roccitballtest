import * as THREE from 'three';
import type { Team } from '../shared/Types';
import { BEAM } from '../shared/Constants';
import {
  type BeamMotionAnalysis,
  isBeamTouchingPlayer,
} from './beamPhysics';

const pulls = { red: 0, blue: 0 };

const COLOR_RED = new THREE.Color('#ff5544');
const COLOR_BLUE = new THREE.Color('#55bbee');
const COLOR_NEUTRAL = new THREE.Color('#ffee66');
const _blend = new THREE.Color();

export function resetBeamContest() {
  pulls.red = 0;
  pulls.blue = 0;
}

export function decayBeamContest(dt: number) {
  const decay = Math.exp(-BEAM.contestDecay * dt);
  pulls.red *= decay;
  pulls.blue *= decay;
}

export function recordBeamPull(team: Team, amount: number) {
  if (amount <= 0) return;
  pulls[team] += amount;
}

export function getTeamPull(team: Team): number {
  return pulls[team];
}

export type BeamBallGlow = {
  color: THREE.Color;
  intensity: number;
  contested: boolean;
  dominantTeam: Team | null;
};

export function getBeamBallGlow(): BeamBallGlow {
  const { red, blue } = pulls;
  const total = red + blue;
  if (total < BEAM.minContestGlow) {
    return {
      color: COLOR_NEUTRAL,
      intensity: 0.12,
      contested: false,
      dominantTeam: null,
    };
  }

  const dominant: Team = red >= blue ? 'red' : 'blue';
  const top = Math.max(red, blue);
  const second = Math.min(red, blue);
  const contested = second / Math.max(top, 0.001) > BEAM.contestTieRatio;

  if (contested) {
    const t = blue / total;
    _blend.copy(COLOR_RED).lerp(COLOR_BLUE, t);
    return {
      color: _blend,
      intensity: 0.35 + Math.min(0.45, total * 0.08),
      contested: true,
      dominantTeam: null,
    };
  }

  return {
    color: dominant === 'red' ? COLOR_RED : COLOR_BLUE,
    intensity: 0.4 + Math.min(0.85, top * 0.12),
    contested: false,
    dominantTeam: dominant,
  };
}

export function canCaptureWithContest(
  team: Team,
  analysis: BeamMotionAnalysis,
  grabDist: number,
  isBot: boolean,
  chestDist?: number,
): boolean {
  if (chestDist !== undefined && isBeamTouchingPlayer(grabDist, chestDist)) {
    if (analysis.speed > BEAM.maxContactCaptureSpeed) return false;
    return true;
  }

  const tight = isBot ? BEAM.botTightCaptureDistance : BEAM.tightCaptureDistance;
  const maxGrab = isBot
    ? BEAM.captureDistance * BEAM.botCaptureReachScale
    : BEAM.captureDistance;

  if (grabDist > maxGrab) return false;

  const my = pulls[team];
  const other = team === 'red' ? pulls.blue : pulls.red;
  const total = my + other;
  const minPull = isBot ? BEAM.botMinCapturePull : BEAM.minCapturePull;
  const domRatio = isBot ? BEAM.botCaptureDominanceRatio : BEAM.captureDominanceRatio;
  if (my < minPull) return false;
  if (total > 0.01 && my / total < domRatio) return false;
  if (my < other * (isBot ? 1.02 : BEAM.captureLeadRatio)) return false;

  const speedLimit = BEAM.maxCaptureSpeed * (isBot ? 1.02 : 1.08);

  if (grabDist <= tight + 0.15 && analysis.speed <= speedLimit) {
    return true;
  }

  return (
    grabDist <= tight + 0.55 &&
    analysis.canCapture &&
    analysis.speed <= speedLimit
  );
}

