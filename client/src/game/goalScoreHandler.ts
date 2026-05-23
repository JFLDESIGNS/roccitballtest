import type { RapierRigidBody } from '@react-three/rapier';
import { MATCH } from '../shared/Constants';
import { releaseBallPhysics } from './ballAttach';
import { parkBallAtDropSpawn } from './ballDropSpawn';
import { playGoalCelebration, suppressBallBounceForMs } from './audio';
import { resetBeamContest } from './ballBeamContest';
import type { BotRuntime } from './Bots';
import type { Team } from '../shared/Types';
import { gameStore } from './gameStore';
import { checkGoalScore, checkGoalScoreSegment } from './scoring';

type Vec3 = { x: number; y: number; z: number };

let resolveBots: (() => BotRuntime[]) | null = null;

export function registerGoalScoreBotProvider(provider: () => BotRuntime[]) {
  resolveBots = provider;
}

/** Shared match-loop timing for post-score countdown delay */
export const goalScoreRuntime = {
  scoreCooldownSec: 0,
  postScoreDelaySec: 0,
};

export function tickGoalScoreRuntime(dt: number) {
  goalScoreRuntime.scoreCooldownSec = Math.max(
    0,
    goalScoreRuntime.scoreCooldownSec - dt,
  );
  if (goalScoreRuntime.postScoreDelaySec > 0) {
    goalScoreRuntime.postScoreDelaySec = Math.max(
      0,
      goalScoreRuntime.postScoreDelaySec - dt,
    );
  }
}

function canRegisterGoalScore(): boolean {
  const state = gameStore.getState();
  if (state.phase === 'intro' || state.phase === 'loading') return false;
  if (goalScoreRuntime.scoreCooldownSec > 0 || state.ballFrozen) return false;
  return true;
}

function registerGoalScore(
  hit: {
    points: number;
    scoringTeam: Team;
    goalPos: { x: number; y: number; z: number };
  },
  body: RapierRigidBody,
): void {
  goalScoreRuntime.scoreCooldownSec =
    MATCH.scorePauseSec +
    MATCH.postScoreCountdownDelaySec +
    MATCH.resetCountdownSec +
    1;
  goalScoreRuntime.postScoreDelaySec = MATCH.postScoreCountdownDelaySec;

  const bots = resolveBots?.() ?? [];
  gameStore.addScore(hit.scoringTeam, hit.points, hit.goalPos);
  playGoalCelebration();

  if (gameStore.getState().ballHolderId) {
    releaseBallPhysics(body);
  }
  gameStore.clearBallHolder();
  for (const b of bots) {
    b.holdingBall = false;
  }
  resetBeamContest();

  suppressBallBounceForMs(2500);
  parkBallAtDropSpawn(body);
  gameStore.setBallState('loose');
  gameStore.freezeBallForKickoff();
}

/** Carried / held ball — score when the ball overlaps the goal volume */
export function tryBallGoalScoreAtPoint(
  pos: Vec3,
  body: RapierRigidBody,
): boolean {
  if (!canRegisterGoalScore()) return false;
  const hit = checkGoalScore(pos);
  if (!hit) return false;
  registerGoalScore(hit, body);
  return true;
}

/** Run after each physics step, before rim bounce can deflect the ball. */
export function tryBallGoalScore(
  from: Vec3,
  to: Vec3,
  body: RapierRigidBody,
): boolean {
  if (!canRegisterGoalScore()) return false;

  const lv = body.linvel();
  const speed = Math.hypot(lv.x, lv.y, lv.z);
  const hit = checkGoalScoreSegment(from, to, speed);
  if (!hit) return false;

  registerGoalScore(hit, body);
  return true;
}
