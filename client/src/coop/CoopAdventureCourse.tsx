import { Html } from '@react-three/drei';
import { CuboidCollider, interactionGroups, RigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { COOP_ADVENTURE_LEVELS } from './coopAdventureLevels';

const PLATFORM_COLLISION = interactionGroups(2, [0, 1, 2]);
const _goalPos = new THREE.Vector3();

export function CoopAdventureCourse({
  playerPositionRef,
}: {
  playerPositionRef: React.MutableRefObject<THREE.Vector3>;
}) {
  const [levelIndex, setLevelIndex] = useState(0);
  const advanceLock = useRef(0);
  const level = COOP_ADVENTURE_LEVELS[levelIndex]!;
  const platformGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  useFrame((_, dt) => {
    advanceLock.current = Math.max(0, advanceLock.current - dt);
    if (advanceLock.current > 0) return;
    _goalPos.set(level.goal.x, level.goal.y, level.goal.z);
    if (playerPositionRef.current.distanceTo(_goalPos) < 3.4) {
      advanceLock.current = 1.5;
      setLevelIndex((index) =>
        Math.min(COOP_ADVENTURE_LEVELS.length - 1, index + 1),
      );
    }
  });

  return (
    <group>
      {level.platforms.map((platform) => (
        <RigidBody key={platform.id} type="fixed" colliders={false}>
          <CuboidCollider
            args={[
              platform.size.x / 2,
              platform.size.y / 2,
              platform.size.z / 2,
            ]}
            position={[
              platform.position.x,
              platform.position.y,
              platform.position.z,
            ]}
            collisionGroups={PLATFORM_COLLISION}
            friction={0.9}
            restitution={0.05}
          />
          <mesh
            geometry={platformGeometry}
            position={[
              platform.position.x,
              platform.position.y,
              platform.position.z,
            ]}
            scale={[platform.size.x, platform.size.y, platform.size.z]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={platform.color}
              roughness={0.42}
              metalness={0.15}
              emissive={platform.color}
              emissiveIntensity={0.08}
            />
          </mesh>
        </RigidBody>
      ))}
      <group position={[level.goal.x, level.goal.y, level.goal.z]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.8, 0.16, 12, 36]} />
          <meshStandardMaterial
            color="#69f7c8"
            emissive="#31ffb7"
            emissiveIntensity={2.1}
            toneMapped={false}
          />
        </mesh>
        <pointLight color="#66ffd5" intensity={1.8} distance={13} />
        <Html center distanceFactor={18} position={[0, 2.4, 0]}>
          <div className="coop-adventure-goal">GOAL</div>
        </Html>
      </group>
      <Html fullscreen>
        <div className="coop-adventure-hud">
          <strong>
            Coop Adventure {level.id}/{COOP_ADVENTURE_LEVELS.length}: {level.name}
          </strong>
          <span>{level.tip}</span>
          <em>RMB attracts a teammate in this mode. Release to throw.</em>
        </div>
      </Html>
    </group>
  );
}
