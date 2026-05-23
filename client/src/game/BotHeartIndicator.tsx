import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { MOVEMENT } from '../shared/Constants';
import { CHARACTER_INDICATOR_RENDER_ORDER } from './characterVisual';
import {
  getBotHeartPhase,
  type BotCombatState,
  type BotHeartPhase,
} from './botCombat';

/** Above TeamOrb (orb sits at capsuleHeight × 0.92) */
const HEART_Y = MOVEMENT.capsuleHeight * 1.42;
const HEART_SCALE = 0.34;

function buildHeartShape(): THREE.Shape {
  const s = new THREE.Shape();
  const r = 0.42;
  s.moveTo(0, -0.15);
  s.bezierCurveTo(0, 0.35, -r, 0.55, -r, 0.15);
  s.bezierCurveTo(-r, -0.12, 0, -0.38, 0, -0.62);
  s.bezierCurveTo(0, -0.38, r, -0.12, r, 0.15);
  s.bezierCurveTo(r, 0.55, 0, 0.35, 0, -0.15);
  return s;
}

type BotHeartIndicatorProps = {
  combat: BotCombatState;
};

export function BotHeartIndicator({ combat }: BotHeartIndicatorProps) {
  const fullRef = useRef<THREE.Group>(null);
  const halfRef = useRef<THREE.Group>(null);
  const phaseRef = useRef<BotHeartPhase>('full');

  const heartGeo = useMemo(() => {
    const shape = buildHeartShape();
    return new THREE.ShapeGeometry(shape, 16);
  }, []);

  const fullMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ff3a58',
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const halfMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ff3a58',
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  useFrame(() => {
    const phase = getBotHeartPhase(combat);
    phaseRef.current = phase;
    if (fullRef.current) fullRef.current.visible = phase === 'full';
    if (halfRef.current) halfRef.current.visible = phase === 'half';
  });

  return (
    <Billboard position={[0, HEART_Y, 0]} follow>
      <group
        scale={HEART_SCALE}
        renderOrder={CHARACTER_INDICATOR_RENDER_ORDER + 6}
      >
        <group ref={fullRef}>
          <mesh geometry={heartGeo} material={fullMat} />
        </group>
        <group ref={halfRef} visible={false}>
          <mesh geometry={heartGeo} material={halfMat} />
          <mesh position={[0.21, 0, 0.01]}>
            <planeGeometry args={[0.9, 1.4]} />
            <meshBasicMaterial
              color="#1a2438"
              transparent
              opacity={0.92}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      </group>
    </Billboard>
  );
}
