import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { MOVEMENT } from '../shared/Constants';
import { CHARACTER_INDICATOR_RENDER_ORDER } from './characterVisual';
import {
  getBotMarkerPhase,
  type BotCombatState,
  type BotMarkerPhase,
} from './botCombat';
import type { Team } from '../shared/Types';

const ORB_Y = MOVEMENT.capsuleHeight * 0.92;

const MARKER_COLORS: Record<
  Team,
  { core: string; ring: string }
> = {
  red: { core: '#ff1818', ring: '#ff5555' },
  blue: { core: '#1888ff', ring: '#55ccff' },
};

type TeamOrbProps = {
  team: Team;
  combat?: BotCombatState;
};

/** Team-colored marker above bots — half-black after one hit, hidden on ragdoll death */
export function TeamOrb({ team, combat }: TeamOrbProps) {
  const fullRef = useRef<THREE.Group>(null);
  const halfRef = useRef<THREE.Group>(null);
  const phaseRef = useRef<BotMarkerPhase>('full');
  const [hidden, setHidden] = useState(false);

  const { core, ring } = MARKER_COLORS[team];

  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: core,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        toneMapped: false,
      }),
    [core],
  );

  const ringMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: ring,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        toneMapped: false,
      }),
    [ring],
  );

  useFrame(() => {
    if (!combat) {
      setHidden(false);
      if (fullRef.current) fullRef.current.visible = true;
      if (halfRef.current) halfRef.current.visible = false;
      return;
    }
    const phase = getBotMarkerPhase(combat);
    phaseRef.current = phase;
    setHidden(phase === 'hidden');
    if (fullRef.current) fullRef.current.visible = phase === 'full';
    if (halfRef.current) halfRef.current.visible = phase === 'half';
  });

  if (hidden) return null;

  return (
    <Billboard
      position={[0, ORB_Y, 0]}
      follow={true}
      lockX={false}
      lockY={false}
      lockZ={false}
    >
      <group renderOrder={CHARACTER_INDICATOR_RENDER_ORDER}>
        <group ref={fullRef}>
          <mesh material={ringMat} renderOrder={CHARACTER_INDICATOR_RENDER_ORDER}>
            <ringGeometry args={[0.22, 0.3, 20]} />
          </mesh>
          <mesh material={mat} renderOrder={CHARACTER_INDICATOR_RENDER_ORDER + 1}>
            <circleGeometry args={[0.22, 16]} />
          </mesh>
        </group>
        <group ref={halfRef} visible={false}>
          <mesh material={ringMat} renderOrder={CHARACTER_INDICATOR_RENDER_ORDER}>
            <ringGeometry args={[0.22, 0.3, 20]} />
          </mesh>
          <mesh material={mat} renderOrder={CHARACTER_INDICATOR_RENDER_ORDER + 1}>
            <circleGeometry args={[0.22, 16]} />
          </mesh>
          <mesh position={[0.21, 0, 0.01]}>
            <planeGeometry args={[0.9, 0.62]} />
            <meshBasicMaterial
              color="#050608"
              transparent
              opacity={0.96}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      </group>
    </Billboard>
  );
}
