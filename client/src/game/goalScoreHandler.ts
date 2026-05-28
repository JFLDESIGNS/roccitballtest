import type { RapierRigidBody } from '@react-three/rapier';
import { MATCH } from '../shared/Constants';
import { releaseBallPhysics } from './ballAttach';
import { isGoalBallSuckActive, startGoalBallSuck } from './ballGoalSuck';
import { parkBallAtDropSpawn } from './ballDropSpawn';
import { playGoalCelebration, suppressBallBounceForMs } from './audio';
import { resetBeamContest } from './ballBeamContest';
import type { BotRuntime } from './Bots';
import type { Team } from '../shared/Types';
import { gameStore } from './gameStore';
import { checkGoalScore, checkGoalScoreSegment } from './scoring';
import { ARENA_GOALS, goalBallScoreRetreatPos, goalBallSuckLerpPos } from './goals';

type Vec3 = { x: number; y: number; z: number };

let resolveBots: (() => BotRuntime[]) | null = null;
let lastLocalGoalTouch:
  | { scorerName: string; position: Vec3; at: number }
  | null = null;

export function markLocalGoalShot(scorerName: string, position: Vec3): void {
  lastLocalGoalTouch = {
    scorerName: scorerName.trim() || 'You',
    position: { ...position },
    at: performance.now(),
  };
}

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
  const multiplayerOnline =
    typeof window !== 'undefined' &&
    (
      window as unknown as {
        __roccitballMultiplayerOnline?: boolean;
      }
    ).__roccitballMultiplayerOnline;
  if (multiplayerOnline) return false;
  const state = gameStore.getState();
  if (state.phase === 'intro' || state.phase === 'loading') return false;
  if (isGoalBallSuckActive()) return false;
  if (goalScoreRuntime.scoreCooldownSec > 0 || state.ballFrozen) return false;
  return true;
}

export function applyNetworkGoalScore(hit: {
  points: number;
  scoringTeam: Team;
  goalPos: { x: number; y: number; z: number };
  score: { red: number; blue: number };
  scorerName?: string | null;
  shotDistanceM?: number | null;
}): void {
  goalScoreRuntime.scoreCooldownSec =
    MATCH.scorePauseSec +
    MATCH.postScoreCountdownDelaySec +
    MATCH.resetCountdownSec +
    1;
  goalScoreRuntime.postScoreDelaySec = MATCH.postScoreCountdownDelaySec;
  gameStore.applyNetworkGoal(hit);
  playGoalCelebration();
  resetBeamContest();
  suppressBallBounceForMs(2500);
}

function registerGoalScore(
  hit: {
    points: number;
    scoringTeam: Team;
    goalId: string;
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
  const touch =
    lastLocalGoalTouch && performance.now() - lastLocalGoalTouch.at < 12000
      ? lastLocalGoalTouch
      : null;
  const shotDistanceM = touch
    ? Math.hypot(
        touch.position.x - hit.goalPos.x,
        touch.position.y - hit.goalPos.y,
        touch.position.z - hit.goalPos.z,
      )
    : null;
  gameStore.addScore(
    hit.scoringTeam,
    hit.points,
    hit.goalPos,
    touch?.scorerName ?? null,
    shotDistanceM,
  );
  playGoalCelebration();

  if (gameStore.getState().ballHolderId) {
    releaseBallPhysics(body);
  }
  gameStore.clearBallHolder(true);
  for (const b of bots) {
    b.holdingBall = false;
  }
  resetBeamContest();

  gameStore.freezeBallForKickoff();
  suppressBallBounceForMs(2500);

  const from = body.translation();
  const goal = ARENA_GOALS.find((g) => g.id === hit.goalId);
  const suckCenter = goal ? goalBallSuckLerpPos(goal) : hit.goalPos;
  const retreat = goal ? goalBallScoreRetreatPos(goal) : hit.goalPos;
  startGoalBallSuck(
    body,
    { x: from.x, y: from.y, z: from.z },
    suckCenter,
    retreat,
    () => {
      parkBallAtDropSpawn(body);
      gameStore.setBallState('loose');
    },
  );
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
