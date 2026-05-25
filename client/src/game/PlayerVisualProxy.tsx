import { useFrame } from '@react-three/fiber';
import type { RapierRigidBody } from '@react-three/rapier';
import { useRef, type ReactNode, type RefObject } from 'react';
import * as THREE from 'three';
import { MOVEMENT } from '../shared/Constants';

const _target = new THREE.Vector3();

type PlayerVisualProxyProps = {
  bodyRef: RefObject<RapierRigidBody | null>;
  capCenterY: number;
  visualRef: RefObject<THREE.Group | null>;
  tiltRef: RefObject<THREE.Group | null>;
  bobRef: RefObject<THREE.Group | null>;
  groundedRef: RefObject<boolean>;
  children: ReactNode;
  /** Thrusters inside bob/tilt so they pitch and bob with the avatar */
  thrusters?: ReactNode;
};

/** Display-only avatar root — smooth follow on physics capsule (reduces jitter) */
export function PlayerVisualProxy({
  bodyRef,
  capCenterY,
  visualRef,
  tiltRef,
  bobRef,
  groundedRef,
  children,
  thrusters,
}: PlayerVisualProxyProps) {
  const rootRef = useRef<THREE.Group>(null);
  const displayPos = useRef(new THREE.Vector3());
  const displayReady = useRef(false);

  useFrame((_, dt) => {
    const root = rootRef.current;
    const body = bodyRef.current;
    if (!root || !body) return;

    const t = body.translation();
    _target.set(t.x, t.y + capCenterY, t.z);

    if (!displayReady.current) {
      displayPos.current.copy(_target);
      displayReady.current = true;
      root.position.copy(displayPos.current);
      return;
    }

    if (displayPos.current.distanceToSquared(_target) > 9) {
      displayPos.current.copy(_target);
      root.position.copy(displayPos.current);
      return;
    }

    const dtClamped = Math.min(Math.max(dt, 1 / 240), 0.05);
    const smooth = groundedRef.current
      ? MOVEMENT.playerVisualPosSmooth
      : MOVEMENT.playerVisualAirPosSmooth;
    const alpha = 1 - Math.exp(-smooth * dtClamped);
    displayPos.current.lerp(_target, alpha);
    root.position.copy(displayPos.current);
  });

  return (
    <group ref={rootRef}>
      <group ref={visualRef}>
        <group ref={tiltRef}>
          <group ref={bobRef}>
            {children}
            {thrusters}
          </group>
        </group>
      </group>
    </group>
  );
}
