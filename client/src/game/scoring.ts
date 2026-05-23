import { BALL, GOAL_RINGS } from '../shared/Constants';
import { ARENA_GOALS, goalScoreHoleRadius } from './goals';
import type { Team } from '../shared/Types';

export function checkGoalScore(ballPos: {
  x: number;
  y: number;
  z: number;
}): {
  points: number;
  scoringTeam: Team;
  goalTeam: Team;
  goalPos: { x: number; y: number; z: number };
} | null {
  const planeSlack = BALL.radius * 0.4;
  const holeSlack = BALL.radius * 0.5;

  for (const goal of ARENA_GOALS) {
    const dx = Math.abs(ballPos.x - goal.center.x);
    if (dx > GOAL_RINGS.sensorDepth + planeSlack) continue;

    const dy = ballPos.y - goal.center.y;
    const dz = ballPos.z - goal.center.z;
    const distYZ = Math.hypot(dy, dz);
    const holeR = goalScoreHoleRadius(goal.ringRadius);
    if (distYZ < holeR + holeSlack) {
      /** goal.team = defended wall; attackers are the opposite team */
      const scoringTeam: Team = goal.team === 'red' ? 'blue' : 'red';
      return {
        points: goal.points,
        scoringTeam,
        goalTeam: goal.team,
        goalPos: { ...goal.center },
      };
    }
  }
  return null;
}
