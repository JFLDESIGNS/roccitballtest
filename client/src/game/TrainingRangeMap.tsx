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
const concreteMat = new THREE.MeshStandardMaterial({
  color: '#2c3438',
  roughness: 0.78,
  metalness: 0.04,
});
const warehouseWallMat = new THREE.MeshStandardMaterial({
  color: '#171d22',
  roughness: 0.68,
  metalness: 0.08,
});
const warehouseTrimMat = new THREE.MeshStandardMaterial({
  color: '#6ee8ff',
  roughness: 0.36,
  metalness: 0.35,
  emissive: '#0a5263',
  emissiveIntensity: 0.45,
});
const cubeMats = [
  new THREE.MeshStandardMaterial({
    color: '#e8d36d',
    roughness: 0.55,
    metalness: 0.08,
  }),
  new THREE.MeshStandardMaterial({
    color: '#79d2ff',
    roughness: 0.5,
    metalness: 0.12,
  }),
  new THREE.MeshStandardMaterial({
    color: '#ff8a6e',
    roughness: 0.58,
    metalness: 0.08,
  }),
];

const FT_TO_M = 0.3048;

function formatFt(n: number): string {
  return `${Math.max(0, Math.round(n))} ft`;
}

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

function TrainingShotPanel() {
  const activeShot = useSyncExternalStore(
    trainingMapStore.subscribe,
    () => trainingMapStore.getActiveShot(),
  );
  const lastShot = useSyncExternalStore(
    trainingMapStore.subscribe,
    () => trainingMapStore.getLastShot(),
  );
  const bestShot = useSyncExternalStore(
    trainingMapStore.subscribe,
    () => trainingMapStore.getBestShot(),
  );
  const shot = activeShot ?? lastShot;

  return (
    <Billboard position={[TRAINING.drivingRange.x - 20, 7.2, TRAINING.drivingRange.startZ + 2]}>
      <Html center distanceFactor={13}>
        <div
          style={{
            width: 300,
            padding: '10px 12px',
            border: '1px solid rgba(148, 255, 169, 0.7)',
            borderRadius: 8,
            background: 'linear-gradient(180deg, rgba(4, 20, 18, 0.92), rgba(5, 12, 18, 0.82))',
            boxShadow: '0 0 24px rgba(82, 255, 155, 0.22)',
            color: '#effff4',
            font: '800 12px system-ui, sans-serif',
            letterSpacing: 0.3,
          }}
        >
          <div style={{ color: '#69ff9d', fontSize: 15, marginBottom: 8 }}>
            DRIVING RANGE TRACKER
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            <Stat label="LIVE" value={shot ? formatFt(shot.distanceFt) : '--'} />
            <Stat label="CARRY" value={shot ? formatFt(shot.carryFt) : '--'} />
            <Stat label="APEX" value={shot ? formatFt(shot.apexFt) : '--'} />
            <Stat label="SPEED" value={shot ? `${shot.speedMps.toFixed(1)} m/s` : '--'} />
          </div>
          <div style={{ marginTop: 8, color: '#c9f7d7' }}>
            BEST: {bestShot ? formatFt(bestShot.distanceFt) : 'no shot yet'}
          </div>
        </div>
      </Html>
    </Billboard>
  );
}

function DrivingShotMarkers() {
  const activeShot = useSyncExternalStore(
    trainingMapStore.subscribe,
    () => trainingMapStore.getActiveShot(),
  );
  const lastShot = useSyncExternalStore(
    trainingMapStore.subscribe,
    () => trainingMapStore.getLastShot(),
  );
  const bestShot = useSyncExternalStore(
    trainingMapStore.subscribe,
    () => trainingMapStore.getBestShot(),
  );
  const marker = activeShot ?? lastShot;
  const markerZ =
    marker != null
      ? TRAINING.drivingRange.startZ - marker.distanceFt * FT_TO_M
      : null;
  const bestZ =
    bestShot != null
      ? TRAINING.drivingRange.startZ - bestShot.distanceFt * FT_TO_M
      : null;

  return (
    <>
      {markerZ != null && (
        <group position={[TRAINING.drivingRange.x, 0.2, markerZ]}>
          <mesh scale={[TRAINING.drivingRange.width * 0.42, 0.08, 0.18]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#69ff9d" toneMapped={false} />
          </mesh>
          <mesh position={[0, 2.0, 0]} scale={[0.12, 4.0, 0.12]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#69ff9d" transparent opacity={0.55} toneMapped={false} />
          </mesh>
        </group>
      )}
      {bestZ != null && (
        <group position={[TRAINING.drivingRange.x + TRAINING.drivingRange.width / 2 + 1.1, 0.55, bestZ]}>
          <mesh scale={[0.25, 1.1, 0.25]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#ffe36e" toneMapped={false} />
          </mesh>
          <Html center distanceFactor={18} position={[0, 1.0, 0]}>
            <div
              style={{
                color: '#ffe36e',
                font: '900 11px system-ui, sans-serif',
                textShadow: '0 1px 5px #000',
                whiteSpace: 'nowrap',
              }}
            >
              BEST {formatFt(bestShot?.distanceFt ?? 0)}
            </div>
          </Html>
        </group>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: '7px 8px',
        borderRadius: 6,
        border: '1px solid rgba(160, 255, 194, 0.25)',
        background: 'rgba(255, 255, 255, 0.06)',
      }}
    >
      <div style={{ color: '#86cfa0', fontSize: 9 }}>{label}</div>
      <div style={{ color: '#ffffff', fontSize: 16 }}>{value}</div>
    </div>
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
  const markerCount = Math.floor(TRAINING.drivingRange.length / TRAINING.drivingRange.markerStep);
  const markers = useMemo(
    () =>
      Array.from({ length: markerCount }, (_, i) => {
        const feet = (i + 1) * 10;
        const z = TRAINING.drivingRange.startZ - (i + 1) * TRAINING.drivingRange.markerStep;
        return { feet, z };
      }),
    [markerCount],
  );

  return (
    <>
      {markers.map((m) => (
        <group key={m.feet} position={[TRAINING.drivingRange.x, 0.09, m.z]}>
          <mesh material={markerMat} scale={[TRAINING.drivingRange.width, 0.04, 0.09]}>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
          {(m.feet % 50 === 0 || m.feet === 10) && (
            <Html center distanceFactor={16} position={[-TRAINING.drivingRange.width / 2 - 2.2, 0.42, 0]}>
              <div
                style={{
                  color: m.feet % 100 === 0 ? '#fff4a8' : '#f4ffd7',
                  font: '900 11px system-ui, sans-serif',
                  textShadow: '0 1px 4px #000',
                }}
              >
                {m.feet} ft
              </div>
            </Html>
          )}
        </group>
      ))}
    </>
  );
}

function WarehouseShell() {
  const w = TRAINING.warehouse;
  const halfW = w.width / 2;
  const halfL = w.length / 2;
  const y = w.wallHeight / 2;

  return (
    <RigidBody type="fixed" colliders={false}>
      <mesh position={[w.x, -0.16, w.z]} scale={[w.width, 0.28, w.length]} material={concreteMat} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <CuboidCollider args={[halfW, 0.14, halfL]} position={[w.x, -0.16, w.z]} />

      <mesh position={[w.x - halfW, y, w.z]} scale={[0.5, w.wallHeight, w.length]} material={warehouseWallMat} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <CuboidCollider args={[0.25, y, halfL]} position={[w.x - halfW, y, w.z]} />

      <mesh position={[w.x + halfW, y, w.z]} scale={[0.5, w.wallHeight, w.length]} material={warehouseWallMat} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <CuboidCollider args={[0.25, y, halfL]} position={[w.x + halfW, y, w.z]} />

      <mesh position={[w.x, y, w.z - halfL]} scale={[w.width, w.wallHeight, 0.5]} material={warehouseWallMat} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <CuboidCollider args={[halfW, y, 0.25]} position={[w.x, y, w.z - halfL]} />

      <mesh position={[w.x, y, w.z + halfL]} scale={[w.width, w.wallHeight, 0.5]} material={warehouseWallMat} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <CuboidCollider args={[halfW, y, 0.25]} position={[w.x, y, w.z + halfL]} />

      <mesh position={[w.x, w.wallHeight + 0.15, w.z]} scale={[w.width, 0.3, w.length]} material={warehouseWallMat} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <CuboidCollider args={[halfW, 0.15, halfL]} position={[w.x, w.wallHeight + 0.15, w.z]} />

      {[-0.4, -0.2, 0, 0.2, 0.4].map((t) => (
        <mesh
          key={t}
          position={[w.x + t * w.width, 0.05, w.z]}
          scale={[0.18, 0.1, w.length * 0.98]}
          material={warehouseTrimMat}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      ))}
    </RigidBody>
  );
}

function TrainingLaunchers() {
  return (
    <>
      {TRAINING.defenseLaunchers.map((origin, i) => (
        <group key={`${origin.x}-${origin.z}`} position={[origin.x, origin.y, origin.z]} rotation={[0, origin.yaw, Math.PI / 2]}>
          <mesh>
            <cylinderGeometry args={[0.65, 1.0, 2.7, 24]} />
            <meshStandardMaterial color="#141a22" roughness={0.35} metalness={0.35} emissive={i % 2 ? '#4a2218' : '#18364a'} emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[0, 0, -1.52]}>
            <cylinderGeometry args={[0.72, 0.72, 0.12, 24]} />
            <meshBasicMaterial color={i % 2 ? '#ff744a' : '#6ee8ff'} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function TrainingPhysicsCubes() {
  const cubes = useMemo(
    () => [
      { p: [-14, 1.25, 31], s: [1.9, 1.9, 1.9], m: 0 },
      { p: [-9, 1.0, 26], s: [1.55, 1.55, 1.55], m: 1 },
      { p: [-18, 1.6, 23], s: [1.25, 2.6, 1.25], m: 2 },
      { p: [10, 1.1, 28], s: [2.1, 1.2, 1.2], m: 1 },
      { p: [17, 1.4, 18], s: [1.35, 2.0, 1.35], m: 0 },
      { p: [41, 1.2, 30], s: [1.7, 1.7, 1.7], m: 2 },
      { p: [44, 1.2, 21], s: [1.7, 1.7, 1.7], m: 1 },
      { p: [47, 1.2, 12], s: [1.7, 1.7, 1.7], m: 0 },
    ],
    [],
  );

  return (
    <>
      {cubes.map((cube, i) => (
        <RigidBody
          key={i}
          colliders={false}
          position={cube.p as [number, number, number]}
          restitution={0.34}
          friction={0.78}
          linearDamping={0.18}
          angularDamping={0.24}
          canSleep
        >
          <mesh
            castShadow
            receiveShadow
            scale={cube.s as [number, number, number]}
            material={cubeMats[cube.m]}
          >
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
          <CuboidCollider
            args={[
              cube.s[0] / 2,
              cube.s[1] / 2,
              cube.s[2] / 2,
            ]}
          />
        </RigidBody>
      ))}
    </>
  );
}

function launchTrainingBallAtPlayer(
  ball: RapierRigidBody,
  player: THREE.Vector3,
): void {
  const origin =
    TRAINING.defenseLaunchers[
      Math.floor(Math.random() * TRAINING.defenseLaunchers.length)
    ];
  const target = new THREE.Vector3(
    player.x + (Math.random() - 0.5) * 2.8,
    player.y + 0.8 + Math.random() * 1.7,
    player.z + (Math.random() - 0.5) * 3.8,
  );
  const flightTime = 1.35 + Math.random() * 0.85;
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
      x: vx * (0.78 + Math.random() * 0.22),
      y: vy,
      z: vz * (0.78 + Math.random() * 0.22),
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
  const drivingShot = useRef({
    armed: false,
    active: false,
    startZ: TRAINING.drivingRange.startZ + 3.8,
    startedAt: 0,
    maxDistanceFt: 0,
    maxCarryFt: 0,
    maxApexFt: 0,
    maxSpeedMps: 0,
  });
  const rangeEndZ = TRAINING.drivingRange.startZ - TRAINING.drivingRange.length;

  useFrame(() => {
    const pos = playerPositionRef.current;
    const ball = ballBodyRef.current;
    const state = gameStore.getState();
    const inDrivingStand = isTrainingDrivingRangeStand(pos.x, pos.z);

    if (ball && inDrivingStand && state.ballHolderId !== null) {
      drivingShot.current.armed = true;
      drivingShot.current.active = false;
    }

    if (ball && drivingShot.current.armed && state.ballHolderId === null) {
      const bt = ball.translation();
      if (!drivingShot.current.active && bt.z < TRAINING.drivingRange.startZ + 2.2) {
        drivingShot.current.active = true;
        drivingShot.current.startedAt = performance.now() / 1000;
        drivingShot.current.maxDistanceFt = 0;
        drivingShot.current.maxCarryFt = 0;
        drivingShot.current.maxApexFt = Math.max(0, bt.y / FT_TO_M);
        drivingShot.current.maxSpeedMps = 0;
      }

      if (drivingShot.current.active) {
        const lv = ball.linvel();
        const speed = Math.hypot(lv.x, lv.y, lv.z);
        const distanceFt = Math.max(
          0,
          (TRAINING.drivingRange.startZ - bt.z) / FT_TO_M,
        );
        drivingShot.current.maxDistanceFt = Math.max(
          drivingShot.current.maxDistanceFt,
          distanceFt,
        );
        drivingShot.current.maxCarryFt = Math.max(
          drivingShot.current.maxCarryFt,
          distanceFt,
        );
        drivingShot.current.maxApexFt = Math.max(
          drivingShot.current.maxApexFt,
          bt.y / FT_TO_M,
        );
        drivingShot.current.maxSpeedMps = Math.max(
          drivingShot.current.maxSpeedMps,
          speed,
        );
        trainingMapStore.updateActiveShot({
          distanceFt: drivingShot.current.maxDistanceFt,
          carryFt: drivingShot.current.maxCarryFt,
          apexFt: drivingShot.current.maxApexFt,
          speedMps: drivingShot.current.maxSpeedMps,
          landed: false,
        });

        const shotAge = performance.now() / 1000 - drivingShot.current.startedAt;
        const done =
          bt.y < 0.55 ||
          speed < 1.2 ||
          bt.z < rangeEndZ + 1 ||
          shotAge > 12;
        if (done && shotAge > 0.28) {
          trainingMapStore.finishShot({
            distanceFt: drivingShot.current.maxDistanceFt,
            carryFt: drivingShot.current.maxCarryFt,
            apexFt: drivingShot.current.maxApexFt,
            speedMps: drivingShot.current.maxSpeedMps,
            landed: true,
          });
          drivingShot.current.active = false;
          drivingShot.current.armed = false;
        }
      }
    }

    if (!ball || !isTrainingDefenseStand(pos.x, pos.z)) return;
    if (inDrivingStand) return;
    if (state.ballHolderId !== null) return;
    const now = performance.now() / 1000;
    if (now < nextLaunchAt.current) return;
    nextLaunchAt.current = now + 1.95 + Math.random() * 1.25;
    launchTrainingBallAtPlayer(ball, pos);
  });

  return (
    <>
      <color attach="background" args={['#11171c']} />
      <fog attach="fog" args={['#11171c', 145, 350]} />
      <group>
      <ambientLight intensity={0.62} />
      <directionalLight position={[18, 30, 18]} intensity={1.2} castShadow />
      <pointLight position={[TRAINING.defenseStand.x, 10, TRAINING.defenseStand.z]} intensity={22} distance={32} color="#76dfff" />
      <pointLight position={[TRAINING.drivingRange.x, 12, TRAINING.drivingRange.startZ - 35]} intensity={26} distance={56} color="#9cffbf" />

      <WarehouseShell />
      <TrainingPhysicsCubes />

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
      <TrainingLaunchers />
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
      <TrainingShotPanel />

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
      <DrivingShotMarkers />

      <mesh position={[TRAINING.drivingRange.x, 0.22, rangeEndZ]}>
        <boxGeometry args={[TRAINING.drivingRange.width, 0.42, 0.35]} />
        <meshBasicMaterial color="#ffef7a" toneMapped={false} />
      </mesh>
      <mesh position={[TRAINING.drivingRange.x, BALL.radius + 0.05, TRAINING.drivingRange.startZ + 3.8]}>
        <sphereGeometry args={[BALL.radius, 24, 16]} />
        <meshStandardMaterial color="#f8fbff" roughness={0.28} metalness={0.04} />
      </mesh>
      </group>
    </>
  );
}
