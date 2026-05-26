import {
  CuboidCollider,
  CylinderCollider,
  TrimeshCollider,
  interactionGroups,
  RigidBody,
} from '@react-three/rapier';
import { useMemo } from 'react';
import { ARENA_GOALS, buildTorusTrimesh, goalBackRingCenterX, goalScoreHoleRadius, ringTiltX, ringTube } from '../game/goals';
import { ARENA_PILLAR } from '../game/arenaPillars';
import { GOAL_RINGS, BALL } from '../shared/Constants';
import type { GoalDef } from '../shared/Types';
import { parseStadiumKey } from './stadiumLayout';

/** Lit goal ring — ball only; players/bots pass through */
const GOAL_LIT_RING_COLLISION = interactionGroups(2, [1, 2]);
const GOAL_BLACK_RING_COLLISION = interactionGroups(2, [1, 2]);
const GOAL_RING_RESTITUTION = BALL.restitution * 0.92;
const GOAL_RING_FRICTION = 0.42;

function StadiumGoalColliders({ goal }: { goal: GoalDef }) {
  const tube = ringTube(goal.ringRadius);
  const tiltX = ringTiltX(goal.team, goal.size);
  const radial = GOAL_RINGS.torusRadialSegments;
  const tubular = GOAL_RINGS.torusTubularSegments;
  const backRadius = goal.ringRadius * GOAL_RINGS.backRingScale;
  const backTube = ringTube(backRadius) * GOAL_RINGS.backRingTubeScale;
  const backLocalX = goalBackRingCenterX(goal) - goal.center.x;
  const capColliderR = goalScoreHoleRadius(goal.ringRadius, goal.size) * 0.38;

  const litTorusCollider = useMemo(
    () => buildTorusTrimesh(goal.ringRadius, tube, radial, tubular),
    [goal.ringRadius, tube, radial, tubular],
  );
  const backTorusCollider = useMemo(
    () => buildTorusTrimesh(backRadius, backTube, radial, tubular),
    [backRadius, backTube, radial, tubular],
  );

  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <group rotation={[0, Math.PI / 2, 0]}>
          <group rotation={[tiltX, 0, 0]}>
            <TrimeshCollider
              args={[litTorusCollider.vertices, litTorusCollider.indices]}
              friction={GOAL_RING_FRICTION}
              restitution={GOAL_RING_RESTITUTION}
              collisionGroups={GOAL_LIT_RING_COLLISION}
            />
          </group>
        </group>
      </RigidBody>
      <RigidBody type="fixed" colliders={false} position={[backLocalX, 0, 0]}>
        <group rotation={[0, Math.PI / 2, 0]}>
          <group rotation={[tiltX, 0, 0]}>
            <TrimeshCollider
              args={[backTorusCollider.vertices, backTorusCollider.indices]}
              friction={GOAL_RING_FRICTION}
              restitution={GOAL_RING_RESTITUTION}
              collisionGroups={GOAL_BLACK_RING_COLLISION}
            />
            <CuboidCollider
              args={[capColliderR, capColliderR, 0.05]}
              friction={0.2}
              restitution={0.82}
              collisionGroups={interactionGroups(2, [0, 2])}
            />
          </group>
        </group>
      </RigidBody>
    </>
  );
}

function StadiumPillarCollider() {
  const yCenter = ARENA_PILLAR.height / 2;
  return (
    <RigidBody type="fixed" colliders={false} position={[0, yCenter, 0]}>
      <CylinderCollider
        args={[ARENA_PILLAR.height / 2, ARENA_PILLAR.colliderRadius]}
        friction={0.32}
        restitution={ARENA_PILLAR.bounceRestitution}
        collisionGroups={interactionGroups(2, [0, 1, 2])}
      />
    </RigidBody>
  );
}

/** Rapier colliders for stadium groups (goals/pillars moved in the map editor). */
export function StadiumGroupPhysics({ stadiumKey }: { stadiumKey: string }) {
  const parsed = parseStadiumKey(stadiumKey);
  if (!parsed) return null;
  if (parsed.kind === 'goal') {
    const goal = ARENA_GOALS.find((g) => g.id === parsed.goalId);
    if (!goal) return null;
    return <StadiumGoalColliders goal={goal} />;
  }
  if (parsed.kind === 'pillar') {
    return <StadiumPillarCollider />;
  }
  return null;
}
