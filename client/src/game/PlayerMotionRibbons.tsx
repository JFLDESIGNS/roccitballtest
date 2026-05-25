import { useRef } from 'react';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { BEAM } from '../shared/Constants';
import { VelocityPathRibbon } from './VelocityPathRibbon';

const RIBBON_WHITE = '#ffffff';

type RibbonLayer = {
  opacity: number;
  back: number;
  lateral: number;
  y: number;
  maxPoints: number;
  minStep: number;
};

const OPACITY_BOOST = 1.3;
const RIBBON_WIDTH = 0.065;
const RIBBON_LATERAL_SPREAD = 0.38;

/** Three tubular motion trails attached behind the player */
const RIBBON_LAYERS: RibbonLayer[] = [
  {
    opacity: 0.4 * OPACITY_BOOST,
    back: 0.68,
    lateral: 0,
    y: BEAM.chestHeight * 0.4,
    maxPoints: 20,
    minStep: 0.12,
  },
  {
    opacity: 0.34 * OPACITY_BOOST,
    back: 0.64,
    lateral: -RIBBON_LATERAL_SPREAD,
    y: BEAM.chestHeight * 0.32,
    maxPoints: 18,
    minStep: 0.14,
  },
  {
    opacity: 0.34 * OPACITY_BOOST,
    back: 0.64,
    lateral: RIBBON_LATERAL_SPREAD,
    y: BEAM.chestHeight * 0.32,
    maxPoints: 18,
    minStep: 0.14,
  },
];

const _fwd = new THREE.Vector3();
const _back = new THREE.Vector3();
const _lat = new THREE.Vector3();
const _quat = new THREE.Quaternion();

function samplePlayerTrailPoint(
  body: RapierRigidBody,
  layer: RibbonLayer,
  out: THREE.Vector3,
): THREE.Vector3 {
  const t = body.translation();
  const lv = body.linvel();
  const horiz = Math.hypot(lv.x, lv.z);

  if (horiz > 0.35) {
    _back.set(-lv.x / horiz, 0, -lv.z / horiz).multiplyScalar(layer.back);
  } else {
    const rot = body.rotation();
    _quat.set(rot.x, rot.y, rot.z, rot.w);
    _fwd.set(0, 0, -1).applyQuaternion(_quat);
    _fwd.y = 0;
    if (_fwd.lengthSq() > 1e-6) {
      _fwd.normalize();
    } else {
      _fwd.set(0, 0, 1);
    }
    _back.copy(_fwd).multiplyScalar(layer.back);
  }

  _lat.set(-_back.z, 0, _back.x);
  if (_lat.lengthSq() > 1e-6) {
    _lat.normalize().multiplyScalar(layer.lateral);
  } else {
    _lat.set(layer.lateral, 0, 0);
  }

  out.set(t.x + _back.x + _lat.x, t.y + layer.y, t.z + _back.z + _lat.z);
  return out;
}

type PlayerMotionRibbonsProps = {
  bodyRef: React.RefObject<RapierRigidBody | null>;
  hidden?: boolean;
};

export function PlayerMotionRibbons({
  bodyRef,
  hidden,
}: PlayerMotionRibbonsProps) {
  const sampleOut = useRef(
    RIBBON_LAYERS.map(() => new THREE.Vector3()),
  );

  return (
    <>
      {RIBBON_LAYERS.map((layer, i) => (
        <VelocityPathRibbon
          key={`${layer.lateral}-${layer.y}`}
          hidden={hidden}
          color={RIBBON_WHITE}
          opacity={layer.opacity}
          maxPoints={layer.maxPoints}
          minStep={layer.minStep}
          lineWidthWorld={RIBBON_WIDTH}
          tubeSegments={6}
          getHorizSpeed={() => {
            const body = bodyRef.current;
            if (!body) return 0;
            const lv = body.linvel();
            return Math.hypot(lv.x, lv.z);
          }}
          samplePosition={() => {
            const body = bodyRef.current;
            if (!body) return null;
            return samplePlayerTrailPoint(body, layer, sampleOut.current[i]!);
          }}
        />
      ))}
    </>
  );
}
