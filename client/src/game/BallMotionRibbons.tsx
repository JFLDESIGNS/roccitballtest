import { useMemo, useRef } from 'react';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { BALL } from '../shared/Constants';
import { VelocityPathRibbon } from './VelocityPathRibbon';

const RIBBON_WHITE = '#ffffff';
const ATTACH = BALL.radius * 0.92;

type RibbonLayer = {
  id: string;
  opacity: number;
  offset: THREE.Vector3;
  maxPoints: number;
  minStep: number;
};

const RIBBON_LAYERS: RibbonLayer[] = [
  {
    id: 'top',
    opacity: 0.24,
    offset: new THREE.Vector3(0, ATTACH, 0),
    maxPoints: 56,
    minStep: 0.04,
  },
  {
    id: 'left',
    opacity: 0.22,
    offset: new THREE.Vector3(-ATTACH, 0, 0),
    maxPoints: 52,
    minStep: 0.045,
  },
  {
    id: 'bottom',
    opacity: 0.22,
    offset: new THREE.Vector3(0, -ATTACH, 0),
    maxPoints: 52,
    minStep: 0.045,
  },
  {
    id: 'right',
    opacity: 0.2,
    offset: new THREE.Vector3(ATTACH, 0, 0),
    maxPoints: 52,
    minStep: 0.045,
  },
];

type BallMotionRibbonsProps = {
  bodyRef: React.RefObject<RapierRigidBody | null>;
  hidden?: boolean;
};

/** Four thin white strings from top/left/bottom/right of the ball */
export function BallMotionRibbons({ bodyRef, hidden }: BallMotionRibbonsProps) {
  const sampleOut = useRef(
    RIBBON_LAYERS.map(() => new THREE.Vector3()),
  );

  const layers = useMemo(() => RIBBON_LAYERS, []);

  return (
    <>
      {layers.map((layer, i) => (
        <VelocityPathRibbon
          key={layer.id}
          hidden={hidden}
          color={RIBBON_WHITE}
          opacity={layer.opacity}
          maxPoints={layer.maxPoints}
          minStep={layer.minStep}
          samplePosition={() => {
            const body = bodyRef.current;
            if (!body) return null;
            const t = body.translation();
            const out = sampleOut.current[i]!;
            out.set(
              t.x + layer.offset.x,
              t.y + layer.offset.y,
              t.z + layer.offset.z,
            );
            return out;
          }}
        />
      ))}
    </>
  );
}
