import { BOT } from '../shared/Constants';
import { tuningStore } from './tuningStore';

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export type BotPressureScalars = {
  followPlayerRocketChance: number;
  followPlayerRocketIntervalSec: number;
  followPlayerProjectileIntervalSec: number;
  followPlayerRocketCooldownSec: number;
  enemyRocketVolleyChance: number;
  enemyRocketVolleyIntervalSec: number;
  rocketAimErrorM: number;
  followPlayerAimErrorMinPct: number;
  followPlayerAimErrorMaxPct: number;
  moveShootBias: number;
  ballLaunchAimErrorM: number;
  playerCarrierShotBias: number;
  /** Enemy bots — shoot local player while they hold the ball (per-bot rolls) */
  enemyPlayerCarrierShotChance: number;
  periodicFireAtPlayerCarrierChance: number;
  beamPullScale: number;
  allyBeamPullScale: number;
  enemyBeamPullScale: number;
};

export function getBotPressureScalars(): BotPressureScalars {
  const tune = tuningStore.getState();
  const p = tune.botPressure;
  const intervalScale = 1 / Math.max(0.25, p);
  const aimScale = 1 / Math.max(0.25, p);

  return {
    followPlayerRocketChance: clamp(
      tune.botFollowRocketChance * p,
      0.04,
      0.92,
    ),
    followPlayerRocketIntervalSec:
      BOT.followPlayerRocketIntervalSec * intervalScale,
    followPlayerProjectileIntervalSec:
      BOT.followPlayerProjectileIntervalSec * intervalScale,
    followPlayerRocketCooldownSec:
      BOT.followPlayerRocketCooldownSec * intervalScale,
    enemyRocketVolleyChance: clamp(
      tune.botEnemyVolleyChance * p,
      0.04,
      0.92,
    ),
    enemyRocketVolleyIntervalSec:
      BOT.enemyRocketVolleyIntervalSec * intervalScale,
    rocketAimErrorM: clamp(tune.botRocketAimErrorM * aimScale, 2.5, 18),
    followPlayerAimErrorMinPct: clamp(
      BOT.followPlayerAimErrorMinPct * aimScale,
      0.02,
      0.35,
    ),
    followPlayerAimErrorMaxPct: clamp(
      BOT.followPlayerAimErrorMaxPct * aimScale,
      0.05,
      0.45,
    ),
    moveShootBias: clamp(BOT.moveShootBias * p, 0.18, 0.92),
    ballLaunchAimErrorM: clamp(tune.botBallLaunchAimErrorM * aimScale, 1.2, 8),
    enemyPlayerCarrierShotChance: clamp(
      tune.botPlayerCarrierShotChance * Math.max(0.35, p * 0.65),
      0.05,
      0.95,
    ),
    playerCarrierShotBias: clamp(tune.botPlayerCarrierShotChance * p, 0.08, 0.92),
    periodicFireAtPlayerCarrierChance: clamp(
      tune.botPlayerCarrierShotChance * p * 0.45,
      0.03,
      0.55,
    ),
    beamPullScale: tune.botBeamPullScale,
    allyBeamPullScale: tune.botAllyBeamScale,
    enemyBeamPullScale: tune.botEnemyBeamScale,
  };
}
