import { CuboidCollider, interactionGroups, RigidBody } from '@react-three/rapier';
import type { Team } from '../shared/Types';
import {
  goalEndFaceX,
  ringRadiusForTier,
  ringTube,
  stackedRingCenters,
} from './goals';

const ENV_COLLISION = interactionGroups(2, [0, 1, 2]);

function GoalEndBackstop({ team }: { team: Team }) {
  const face = goalEndFaceX();
  const wallX = team === 'red' ? -face : face;
  const r0 = ringRadiusForTier(0);
  const tube = ringTube(r0);
  const { bottomY, topY } = stackedRingCenters();
  const halfH = (topY - bottomY) * 0.5 + r0 + tube + 1.5;
  const y = (bottomY + topY) * 0.5;
  const halfZ = r0 + tube + 3.5;
  const halfX = 1.1;
  const x = team === 'red' ? wallX - halfX : wallX + halfX;

  return (
    <RigidBody type="fixed" colliders={false} position={[x, y, 0]}>
      <CuboidCollider
        args={[halfX, halfH, halfZ]}
        friction={0.25}
        restitution={0.55}
        collisionGroups={ENV_COLLISION}
      />
    </RigidBody>
  );
}

/** Solid wall behind each net — blocks walking through the end face */
export function GoalNetBackstop() {
  return (
    <>
      <GoalEndBackstop team="red" />
      <GoalEndBackstop team="blue" />
    </>
  );
}
