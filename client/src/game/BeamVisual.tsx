import { useRef } from 'react';
import * as THREE from 'three';
import { BeamPullTrace } from './BeamPullTrace';
import { beamTraceBallAnchor } from './beamPhysics';
import type { Team } from '../shared/Types';

type BeamVisualProps = {
  /** Lightning only while pulling a distant ball (not when already held) */
  pullActive: () => boolean;
  chestPosition: () => THREE.Vector3 | null;
  ballPosition: () => THREE.Vector3 | null;
  lowEnergy: boolean;
  team: Team;
};

export function BeamVisual({
  pullActive,
  chestPosition,
  ballPosition,
  lowEnergy,
  team,
}: BeamVisualProps) {
  const traceEnd = useRef(new THREE.Vector3());

  return (
    <BeamPullTrace
      active={pullActive}
      from={chestPosition}
      to={() => {
        const chest = chestPosition();
        const ball = ballPosition();
        if (!chest || !ball) return null;
        return beamTraceBallAnchor(ball, chest, traceEnd.current);
      }}
      team={team}
      lowEnergy={lowEnergy}
    />
  );
}
