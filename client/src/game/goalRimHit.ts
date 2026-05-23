import { BALL, GOAL_RINGS } from '../shared/Constants';
import { ARENA_GOALS, goalScoreHoleRadius, ringTube } from './goals';

/** Ball grazed a goal ring rim (not through the scoring hole). */
export function isBallOnGoalRim(ballPos: { x: number; y: number; z: number }): boolean {
  for (const goal of ARENA_GOALS) {
    const planeDist = Math.abs(ballPos.x - goal.center.x);
    if (planeDist > GOAL_RINGS.sensorDepth + BALL.radius + 0.6) continue;

    const dy = ballPos.y - goal.center.y;
    const dz = ballPos.z - goal.center.z;
    const distYZ = Math.hypot(dy, dz);
    const holeR = goalScoreHoleRadius(goal.ringRadius);
    if (distYZ <= holeR * 0.95) continue;

    const tube = ringTube(goal.ringRadius);
    const ringDist = Math.abs(distYZ - goal.ringRadius);
    if (ringDist <= tube + BALL.radius * 0.9) return true;
  }
  return false;
}
