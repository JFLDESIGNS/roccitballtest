import { useMemo } from 'react';
import * as THREE from 'three';
import { MOVEMENT } from '../shared/Constants';

const capHalfH = MOVEMENT.capsuleHeight / 2 - MOVEMENT.capsuleRadius;
/** Top of capsule in local space */
const capsuleTopY = capHalfH + MOVEMENT.capsuleRadius;
const domeR = MOVEMENT.capsuleRadius * 0.82;

/**
 * Baseball-style cap on the capsule top; brim points along local -Z (parent rotation.y = yaw).
 */
export function LookDirectionHat({ color }: { color: string }) {
  const hatColor = useMemo(() => {
    const c = new THREE.Color(color);
    c.multiplyScalar(0.68);
    return `#${c.getHexString()}`;
  }, [color]);

  const domeGeo = useMemo(
    () =>
      new THREE.SphereGeometry(
        domeR,
        14,
        10,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2,
      ),
    [],
  );

  const brimGeo = useMemo(
    () => new THREE.BoxGeometry(domeR * 2.05, 0.11, domeR * 1.05),
    [],
  );

  return (
    <group position={[0, capsuleTopY, 0]}>
      <mesh geometry={domeGeo} castShadow>
        <meshStandardMaterial
          color={hatColor}
          metalness={0.22}
          roughness={0.58}
        />
      </mesh>
      <mesh geometry={brimGeo} position={[0, -0.06, -domeR * 0.92]} castShadow>
        <meshStandardMaterial
          color={hatColor}
          metalness={0.18}
          roughness={0.62}
        />
      </mesh>
    </group>
  );
}
