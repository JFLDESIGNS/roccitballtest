import { useMemo, useRef } from 'react';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { BEAM } from '../shared/Constants';
import type { Team } from '../shared/Types';
import { VelocityPathRibbon } from './VelocityPathRibbon';

const TEAM_TRAIL: Record<
  Team,
  { primary: string; secondary: string; accent: string }
> = {
  blue: { primary: '#88eeff', secondary: '#44bbff', accent: '#cceeff' },
  red: { primary: '#ffaa88', secondary: '#ff6644', accent: '#ffd4cc' },
};

type RibbonLayer = {
  colorKey: keyof (typeof TEAM_TRAIL)['blue'];
  opacity: number;
  lineWidthWorld: number;
  back: number;
  lateral: number;
  y: number;
  maxPoints: number;
  minStep: number;
};

const RIBBON_LAYERS: RibbonLayer[] = [
  {
    colorKey: 'primary',
    opacity: 0.52,
    lineWidthWorld: 0.44,
    back: 0.78,
    lateral: 0,
    y: BEAM.chestHeight * 0.42,
    maxPoints: 18,
    minStep: 0.16,
  },
  {
    colorKey: 'secondary',
    opacity: 0.44,
    lineWidthWorld: 0.36,
    back: 0.72,
    lateral: -0.32,
    y: BEAM.chestHeight * 0.28,
    maxPoints: 16,
    minStep: 0.18,
  },
  {
    colorKey: 'secondary',
    opacity: 0.4,
    lineWidthWorld: 0.36,
    back: 0.72,
    lateral: 0.32,
    y: BEAM.chestHeight * 0.28,
    maxPoints: 16,
    minStep: 0.18,
  },
  {
    colorKey: 'accent',
    opacity: 0.34,
    lineWidthWorld: 0.28,
    back: 0.58,
    lateral: 0,
    y: BEAM.chestHeight * 0.12,
    maxPoints: 14,
    minStep: 0.2,
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
  team: Team;
  hidden?: boolean;
};

/** Thick layered motion ribbons trailing behind the player drone */
export function PlayerMotionRibbons({
  bodyRef,
  team,
  hidden,
}: PlayerMotionRibbonsProps) {
  const colors = TEAM_TRAIL[team];
  const sampleOut = useRef(
    RIBBON_LAYERS.map(() => new THREE.Vector3()),
  );

  const layers = useMemo(
    () =>
      RIBBON_LAYERS.map((layer, i) => ({
        ...layer,
        color: colors[layer.colorKey],
        sampleIndex: i,
      })),
    [colors],
  );

  return (
    <>
      {layers.map((layer) => (
        <VelocityPathRibbon
          key={`${layer.colorKey}-${layer.lateral}-${layer.y}`}
          hidden={hidden}
          crossSection
          color={layer.color}
          opacity={layer.opacity}
          lineWidthWorld={layer.lineWidthWorld}
          maxPoints={layer.maxPoints}
          minStep={layer.minStep}
          samplePosition={() => {
            const body = bodyRef.current;
            if (!body) return null;
            return samplePlayerTrailPoint(
              body,
              layer,
              sampleOut.current[layer.sampleIndex]!,
            );
          }}
        />
      ))}
    </>
  );
}
