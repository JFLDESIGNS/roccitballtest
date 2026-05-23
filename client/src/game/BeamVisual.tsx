import { useRef } from 'react';
import * as THREE from 'three';
import { BeamPullTrace } from './BeamPullTrace';
import { beamTraceBallAnchor } from './beamPhysics';

type BeamVisualProps = {
  /** Lightning only while pulling a distant ball (not when already held) */
  pullActive: () => boolean;
  chestPosition: () => THREE.Vector3 | null;
  ballPosition: () => THREE.Vector3 | null;
  lowEnergy: boolean;
};

export function BeamVisual({
  pullActive,
  chestPosition,
  ballPosition,
  lowEnergy,
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
      variant="player"
      lowEnergy={lowEnergy}
    />
  );
}
