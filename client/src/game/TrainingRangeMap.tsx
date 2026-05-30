import { Billboard, Html } from '@react-three/drei';
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import {
  useMemo,
  useRef,
  useSyncExternalStore,
  type MutableRefObject,
  type RefObject,
} from 'react';
import * as THREE from 'three';
import { BALL } from '../shared/Constants';
import { gameStore } from './gameStore';
import { releaseBallPhysics } from './ballAttach';
import {
  TRAINING,
  isTrainingDefenseStand,
  isTrainingDrivingRangeStand,
} from './trainingMapConfig';
import { trainingMapStore } from './trainingMapStore';

const markerMat = new THREE.MeshBasicMaterial({ color: '#e8f5cb', toneMapped: false });
const grassMat = new THREE.MeshStandardMaterial({
  color: '#38a957',
  roughness: 0.85,
  metalness: 0,
});
const dirtMat = new THREE.MeshStandardMaterial({
  color: '#4b3f2b',
  roughness: 0.9,
  metalness: 0,
});

function TrainingHitPreview() {
  const hit = useSyncExternalStore(
    trainingMapStore.subscribe,
    () => trainingMapStore.getLastBallHit(),
  );
  const normal = hit?.normal ?? { x: 0, y: 0, z: 1 };
  const markerPos = [normal.x * 0.68, normal.y * 0.68, normal.z * 0.68] as const;
  const age = hit ? (performance.now() - hit.at) / 1000 : 99;
  const fresh = age < 3;

  return (
    <Billboard position={[-34, 6.2, -3]}>
      <group>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.72, 32, 18]} />
          <meshStandardMaterial color="#f7fbff" roughness={0.25} metalness={0.08} />
        </mesh>
        <mesh position={markerPos}>
          <sphereGeometry args={[fresh ? 0.14 : 0.08, 16, 10]} />
          <meshBasicMaterial color={fresh ? '#ff344c' : '#778899'} toneMapped={false} />
        </mesh>
        <Html center position={[0, -1.25, 0]} distanceFactor={10}>
          <div
            style={{
              minWidth: 190,
              padding: '8px 10px',
              border: '1px solid rgba(93, 202, 255, 0.65)',
              borderRadius: 8,
              background: 'rgba(3, 10, 20, 0.82)',
              color: '#eaf7ff',
              font: '700 12px system-ui, sans-serif',
              textAlign: 'center',
              letterSpacing: 0.4,
            }}
          >
            {hit ? 'ROCKET CONTACT MAP' : 'SHOOT INCOMING BALLS'}
          </div>
        </Html>
      </group>
    </Billboard>
  );
}

function Platform({
  position,
  scale,
  color,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  color?: string;
}) {
  return (
    <RigidBody type="fixed" colliders={false}>
      <mesh position={position} scale={scale} receiveShadow castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color ?? '#253746'} roughness={0.72} />
      </mesh>
      <CuboidCollider args={[scale[0] / 2, scale[1] / 2, scale[2] / 2]} position={position} />
    </RigidBody>
  );
}

function DrivingRangeMarkers() {
  const markers = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => {
        const feet = (i + 1) * 10;
        const z = TRAINING.drivingRange.startZ - (i + 1) * TRAINING.drivingRange.markerStep;
        return { feet, z };
      }),
    [],
  );

  return (
    <>
      {markers.map((m) => (
        <group key={m.feet} position={[TRAINING.drivingRange.x, 0.09, m.z]}>
          <mesh material={markerMat} scale={[TRAINING.drivingRange.width, 0.04, 0.09]}>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
          <Html center distanceFactor={14} position={[-TRAINING.drivingRange.width / 2 - 1.8, 0.35, 0]}>
            <div
              style={{
                color: '#f4ffd7',
                font: '800 10px system-ui, sans-serif',
                textShadow: '0 1px 4px #000',
              }}
            >
              {m.feet} ft
            </div>
          </Html>
        </group>
      ))}
    </>
  );
}

function launchTrainingBallAtPlayer(
  ball: RapierRigidBody,
  player: THREE.Vector3,
): void {
  const origin = TRAINING.defenseLauncher;
  const target = new THREE.Vector3(player.x, player.y + 1.15, player.z);
  const flightTime = 0.9 + Math.random() * 0.75;
  const gravity = -11;
  const vx = (target.x - origin.x) / flightTime;
  const vz = (target.z - origin.z) / flightTime;
  const vy =
    (target.y - origin.y - 0.5 * gravity * flightTime * flightTime) /
    flightTime;

  gameStore.releaseKickoffBall();
  releaseBallPhysics(ball);
  ball.setTranslation(origin, true);
  ball.setLinvel(
    {
      x: vx * (0.8 + Math.random() * 0.35),
      y: vy,
      z: vz * (0.8 + Math.random() * 0.35),
    },
    true,
  );
  ball.setAngvel(
    {
      x: (Math.random() - 0.5) * 34,
      y: (Math.random() - 0.5) * 44,
      z: (Math.random() - 0.5) * 34,
    },
    true,
  );
  gameStore.clearBallHolder(true);
  gameStore.setBallState('loose');
}

export function TrainingRangeMap({
  ballBodyRef,
  playerPositionRef,
}: {
  ballBodyRef: RefObject<RapierRigidBody | null>;
  playerPositionRef: MutableRefObject<THREE.Vector3>;
}) {
  const nextLaunchAt = useRef(0);
  const rangeEndZ = TRAINING.drivingRange.startZ - TRAINING.drivingRange.length;

  useFrame(() => {
    const pos = playerPositionRef.current;
    const ball = ballBodyRef.current;
    if (!ball || !isTrainingDefenseStand(pos.x, pos.z)) return;
    if (isTrainingDrivingRangeStand(pos.x, pos.z)) return;
    if (gameStore.getState().ballHolderId !== null) return;
    const now = performance.now() / 1000;
    if (now < nextLaunchAt.current) return;
    nextLaunchAt.current = now + 1.65 + Math.random() * 0.95;
    launchTrainingBallAtPlayer(ball, pos);
  });

  return (
    <group>
      <ambientLight intensity={0.45} />
      <directionalLight position={[18, 30, 18]} intensity={1.6} castShadow />

      <Platform
        position={[
          TRAINING.defenseStand.x,
          0.08,
          TRAINING.defenseStand.z,
        ]}
        scale={[
          TRAINING.defenseStand.half * 2,
          0.16,
          TRAINING.defenseStand.half * 2,
        ]}
        color="#19324a"
      />
      <Html center distanceFactor={14} position={[TRAINING.defenseStand.x, 1.1, TRAINING.defenseStand.z - 5.4]}>
        <div style={{ color: '#d9f5ff', font: '900 13px system-ui', textShadow: '0 2px 5px #000' }}>
          ROCKET REACTION PLATFORM
        </div>
      </Html>
      <mesh position={[TRAINING.defenseLauncher.x, TRAINING.defenseLauncher.y, TRAINING.defenseLauncher.z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.9, 1.25, 3.2, 24]} />
        <meshStandardMaterial color="#141a22" roughness={0.35} metalness={0.35} emissive="#18364a" emissiveIntensity={0.5} />
      </mesh>
      <TrainingHitPreview />

      <Platform
        position={[
          TRAINING.drivingStand.x,
          0.08,
          TRAINING.drivingStand.z,
        ]}
        scale={[
          TRAINING.drivingStand.halfX * 2,
          0.16,
          TRAINING.drivingStand.halfZ * 2,
        ]}
        color="#214a35"
      />
      <Html center distanceFactor={14} position={[TRAINING.drivingStand.x, 1.1, TRAINING.drivingStand.z + 4.6]}>
        <div style={{ color: '#edffd6', font: '900 13px system-ui', textShadow: '0 2px 5px #000' }}>
          DRIVING RANGE: AUTO BALL IN HAND
        </div>
      </Html>

      <RigidBody type="fixed" colliders={false}>
        <mesh
          position={[
            TRAINING.drivingRange.x,
            -0.025,
            (TRAINING.drivingRange.startZ + rangeEndZ) / 2,
          ]}
          scale={[TRAINING.drivingRange.width, 0.05, TRAINING.drivingRange.length]}
          material={grassMat}
          receiveShadow
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
        <mesh
          position={[
            TRAINING.drivingRange.x,
            -0.18,
            (TRAINING.drivingRange.startZ + rangeEndZ) / 2,
          ]}
          scale={[TRAINING.drivingRange.width, 0.24, TRAINING.drivingRange.length]}
          material={dirtMat}
          receiveShadow
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
        <CuboidCollider
          args={[
            TRAINING.drivingRange.width / 2,
            0.12,
            TRAINING.drivingRange.length / 2,
          ]}
          position={[
            TRAINING.drivingRange.x,
            -0.08,
            (TRAINING.drivingRange.startZ + rangeEndZ) / 2,
          ]}
        />
      </RigidBody>
      <DrivingRangeMarkers />

      <mesh position={[TRAINING.drivingRange.x, 0.22, rangeEndZ]}>
        <boxGeometry args={[TRAINING.drivingRange.width, 0.42, 0.35]} />
        <meshBasicMaterial color="#ffef7a" toneMapped={false} />
      </mesh>
      <mesh position={[TRAINING.drivingRange.x, BALL.radius + 0.05, TRAINING.drivingRange.startZ + 3.8]}>
        <sphereGeometry args={[BALL.radius, 24, 16]} />
        <meshStandardMaterial color="#f8fbff" roughness={0.28} metalness={0.04} />
      </mesh>
    </group>
  );
}
