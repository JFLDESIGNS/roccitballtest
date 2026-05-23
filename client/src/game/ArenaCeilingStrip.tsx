import { RoundedBox } from '@react-three/drei';
import { CuboidCollider, interactionGroups, RigidBody } from '@react-three/rapier';
import { useMemo } from 'react';
import * as THREE from 'three';
import { ARENA } from '../shared/Constants';
import { goalEndFaceX } from './goals';

const FT = 0.3048;
/** Base cross-section ~5 ft; 5× wider along arena Z */
const STRIP_THICKNESS_Z = 5 * FT * 5;
/** Base drop ~2.5 ft; 3× taller (top still flush with ceiling) */
const STRIP_DROP_Y = 2.5 * FT * 3;
const CHAMFER_RADIUS = 0.55;
const LED_STRIP_WIDTH = 1.75;

const CEILING_STRIP_COLLISION = interactionGroups(2, [0, 1, 2]);

const stripBodyMaterial = new THREE.MeshStandardMaterial({
  color: '#0a0a0c',
  metalness: 0.82,
  roughness: 0.35,
});

const stripLightMaterial = new THREE.MeshStandardMaterial({
  color: '#c8e8ff',
  emissive: '#88ccff',
  emissiveIntensity: 2.8,
  toneMapped: false,
});

export function arenaCeilingStripLayout() {
  const face = goalEndFaceX();
  const lengthX = face * 2 - 1.2;
  const ceilingY = ARENA.wallHeight + ARENA.ceilingOverlapM;
  const centerY = ceilingY - STRIP_DROP_Y / 2;
  const lightLength = lengthX - CHAMFER_RADIUS * 4;
  return { lengthX, centerY, lightLength };
}

/**
 * Black chamfered beam flush to the ceiling, spanning red goal wall to blue goal wall,
 * with an LED strip along the arena-facing underside.
 */
export function ArenaCeilingStrip() {
  const { lengthX, centerY, lightLength } = useMemo(
    () => arenaCeilingStripLayout(),
    [],
  );

  return (
    <group position={[0, centerY, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[lengthX / 2, STRIP_DROP_Y / 2, STRIP_THICKNESS_Z / 2]}
          friction={0.22}
          restitution={0.58}
          collisionGroups={CEILING_STRIP_COLLISION}
        />
      </RigidBody>

      <RoundedBox
        args={[lengthX, STRIP_DROP_Y, STRIP_THICKNESS_Z]}
        radius={CHAMFER_RADIUS}
        smoothness={6}
        castShadow
        receiveShadow
      >
        <primitive object={stripBodyMaterial} attach="material" />
      </RoundedBox>

      <mesh
        position={[0, -STRIP_DROP_Y / 2 - 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[lightLength, LED_STRIP_WIDTH]} />
        <primitive object={stripLightMaterial} attach="material" />
      </mesh>

      <CeilingStripPointLights lengthX={lengthX} y={-STRIP_DROP_Y / 2} />
    </group>
  );
}

function CeilingStripPointLights({
  lengthX,
  y,
}: {
  lengthX: number;
  y: number;
}) {
  const xs = useMemo(() => {
    const count = 9;
    const span = lengthX * 0.82;
    const out: number[] = [];
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      out.push(-span / 2 + t * span);
    }
    return out;
  }, [lengthX]);

  return (
    <>
      {xs.map((x) => (
        <pointLight
          key={x}
          position={[x, y - 0.4, 0]}
          color="#99ddff"
          intensity={42}
          distance={36}
          decay={2}
        />
      ))}
    </>
  );
}
