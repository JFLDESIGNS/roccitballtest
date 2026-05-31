import { Billboard, Html } from '@react-three/drei';
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import {
  useMemo,
  useEffect,
  useRef,
  useSyncExternalStore,
  type MutableRefObject,
  type RefObject,
} from 'react';
import * as THREE from 'three';
import { BALL } from '../shared/Constants';
import { gameStore } from './gameStore';
import { releaseBallPhysics } from './ballAttach';
import { playBallLaunch } from './audio';
import {
  TRAINING,
  isTrainingDefenseStand,
  isTrainingDrivingRangeStand,
} from './trainingMapConfig';
import { trainingMapStore } from './trainingMapStore';
import { registerTrainingCube } from './trainingCubeRegistry';

const markerMat = new THREE.MeshBasicMaterial({
  color: '#e8f5cb',
  transparent: true,
  opacity: 0.1,
  depthWrite: false,
  toneMapped: false,
});
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
const buildingMat = new THREE.MeshStandardMaterial({
  color: '#273640',
  roughness: 0.72,
  metalness: 0.02,
});
const buildingWindowMat = new THREE.MeshBasicMaterial({
  color: '#9ee8ff',
  transparent: true,
  opacity: 0.36,
  toneMapped: false,
});
const cloudMat = new THREE.MeshBasicMaterial({
  color: '#e8fff9',
  transparent: true,
  opacity: 0.66,
  depthWrite: false,
  toneMapped: false,
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
const DRIVING_TEE_Y = BALL.radius + 0.08;
const DRIVING_TEE_Z_OFFSET = 3.8;
const DRIVING_LANDING_Y = BALL.radius + 0.22;
const DRIVING_AIRBORNE_Y = BALL.radius + 0.55;
const DRIVING_ROLLOUT_SEC = 4;
const DRIVING_OB_HOLD_SEC = 1.25;
const DISPLAY_FEET_PER_WORLD_FOOT = 1 / 5;
const TRAINING_HTML_Z_INDEX_RANGE = [8, 0] as [number, number];
const DEFENSE_TARGET_X = -72;
const DEFENSE_SHOT_MAX_AGE_SEC = 12;
const DEFENSE_SHOT_BOUNCES_BEFORE_RESET = 2;

function formatFt(n: number): string {
  return `${Math.max(0, Math.round(n))} ft`;
}

function displayFtToMeters(ft: number): number {
  return ft / DISPLAY_FEET_PER_WORLD_FOOT * FT_TO_M;
}

function worldFtToDisplayFt(ft: number): number {
  return ft * DISPLAY_FEET_PER_WORLD_FOOT;
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
    <Billboard position={[TRAINING.defenseStand.x - 10, 6.2, -3]}>
      <group>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.72, 32, 18]} />
          <meshStandardMaterial color="#f7fbff" roughness={0.25} metalness={0.08} />
        </mesh>
        <mesh position={markerPos}>
          <sphereGeometry args={[fresh ? 0.14 : 0.08, 16, 10]} />
          <meshBasicMaterial color={fresh ? '#ff344c' : '#778899'} toneMapped={false} />
        </mesh>
        <Html center position={[0, -1.25, 0]} distanceFactor={10} zIndexRange={TRAINING_HTML_Z_INDEX_RANGE}>
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
      ? TRAINING.drivingRange.startZ - displayFtToMeters(marker.distanceFt)
      : null;
  const bestZ =
    bestShot != null
      ? TRAINING.drivingRange.startZ - displayFtToMeters(bestShot.distanceFt)
      : null;
  const sideX = TRAINING.drivingRange.x + TRAINING.drivingRange.width / 2 + 2.2;

  return (
    <>
      {markerZ != null && (
        <group position={[sideX, 1.05, markerZ]}>
          <mesh scale={[0.16, 2.1, 0.16]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial
              color="#69ff9d"
              transparent
              opacity={0.72}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, -1.05, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.11, 2.6, 0.11]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#69ff9d" transparent opacity={0.5} toneMapped={false} />
          </mesh>
          <Html center distanceFactor={18} position={[0, 1.45, 0]} zIndexRange={TRAINING_HTML_Z_INDEX_RANGE}>
            <div
              style={{
                color: '#d8ffe4',
                font: '900 11px system-ui, sans-serif',
                textShadow: '0 1px 5px #000',
                whiteSpace: 'nowrap',
              }}
            >
              {formatFt(marker?.distanceFt ?? 0)}
            </div>
          </Html>
        </group>
      )}
      {bestZ != null && (
        <group position={[sideX + 1.4, 0.55, bestZ]}>
          <mesh scale={[0.22, 1.1, 0.22]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#ffe36e" toneMapped={false} />
          </mesh>
          <Html center distanceFactor={18} position={[0, 1.0, 0]} zIndexRange={TRAINING_HTML_Z_INDEX_RANGE}>
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

function DrivingLiveBallFrame({
  ballBodyRef,
}: {
  ballBodyRef: RefObject<RapierRigidBody | null>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const obRef = useRef<THREE.Group>(null);
  const activeShot = useSyncExternalStore(
    trainingMapStore.subscribe,
    () => trainingMapStore.getActiveShot(),
  );

  useFrame(() => {
    const group = groupRef.current;
    const ob = obRef.current;
    const ball = ballBodyRef.current;
    if (!group || !ball || !activeShot) {
      if (group) group.visible = false;
      if (ob) ob.visible = false;
      return;
    }

    const bt = ball.translation();
    group.visible = true;
    group.position.set(bt.x, bt.y, bt.z);

    if (ob) {
      ob.visible = !!activeShot.outOfBounds;
      const side =
        bt.x >= TRAINING.drivingRange.x
          ? TRAINING.drivingRange.x + TRAINING.drivingRange.width / 2
          : TRAINING.drivingRange.x - TRAINING.drivingRange.width / 2;
      ob.position.set(side, Math.max(2.4, bt.y), bt.z);
    }
  });

  const label = activeShot?.outOfBounds
    ? `OB ${formatFt(activeShot.distanceFt)}`
    : formatFt(activeShot?.distanceFt ?? 0);

  return (
    <>
      <group ref={groupRef} visible={false}>
        <mesh scale={[BALL.radius * 3.4, BALL.radius * 3.4, BALL.radius * 3.4]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            color="#55d8ff"
            transparent
            opacity={0.42}
            wireframe
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <Html center distanceFactor={12} position={[0, BALL.radius * 2.55, 0]} zIndexRange={TRAINING_HTML_Z_INDEX_RANGE}>
          <div
            style={{
              minWidth: 150,
              padding: '8px 12px',
              border: activeShot?.outOfBounds
                ? '2px solid rgba(99, 255, 145, 0.9)'
                : '2px solid rgba(85, 216, 255, 0.85)',
              borderRadius: 8,
              background: 'rgba(3, 10, 20, 0.72)',
              color: activeShot?.outOfBounds ? '#7dff9d' : '#d9f8ff',
              font: '1000 34px system-ui, sans-serif',
              lineHeight: 1,
              textAlign: 'center',
              textShadow: '0 2px 8px #000',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </div>
        </Html>
      </group>
      <group ref={obRef} visible={false}>
        <mesh scale={[0.12, 4.2, 9.5]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            color="#66ff8e"
            transparent
            opacity={0.48}
            wireframe
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <Html center distanceFactor={14} position={[0, 2.75, 0]} zIndexRange={TRAINING_HTML_Z_INDEX_RANGE}>
          <div
            style={{
              padding: '5px 10px',
              borderRadius: 7,
              background: 'rgba(4, 40, 16, 0.78)',
              border: '1px solid rgba(102, 255, 142, 0.8)',
              color: '#9effb7',
              font: '1000 18px system-ui, sans-serif',
              textShadow: '0 1px 5px #000',
            }}
          >
            OB
          </div>
        </Html>
      </group>
    </>
  );
}

function Platform({
  position,
  scale,
  color,
  collidable = true,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  color?: string;
  collidable?: boolean;
}) {
  return (
    <RigidBody type="fixed" colliders={false}>
      <mesh position={position} scale={scale} receiveShadow castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color ?? '#253746'} roughness={0.72} />
      </mesh>
      {collidable && (
        <CuboidCollider args={[scale[0] / 2, scale[1] / 2, scale[2] / 2]} position={position} />
      )}
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
            <Html center distanceFactor={18} position={[-TRAINING.drivingRange.width / 2 - 3.6, 0.8, 0]} zIndexRange={TRAINING_HTML_Z_INDEX_RANGE}>
              <div
                style={{
                  color: m.feet % 100 === 0 ? '#fff4a8' : '#f4ffd7',
                  font: '1000 28px system-ui, sans-serif',
                  lineHeight: 0.9,
                  textAlign: 'center',
                  textShadow: '0 2px 7px #000, 0 0 12px rgba(0,0,0,0.7)',
                }}
              >
                {m.feet}
                <br />
                <span style={{ fontSize: 20 }}>ft</span>
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
  const closedLength = w.length * 0.48;
  const closedHalfL = closedLength / 2;
  const closedZ = w.z - w.length * 0.26;
  const closedY = w.wallHeight / 2;

  return (
    <RigidBody type="fixed" colliders={false}>
      <mesh position={[w.x, -0.16, w.z]} scale={[w.width, 0.28, w.length]} material={concreteMat} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <CuboidCollider args={[halfW, 0.14, halfL]} position={[w.x, -0.16, w.z]} />

      <mesh position={[w.x - halfW, closedY, closedZ]} scale={[0.5, w.wallHeight, closedLength]} material={warehouseWallMat} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>

      <mesh position={[w.x + halfW, closedY, closedZ]} scale={[0.5, w.wallHeight, closedLength]} material={warehouseWallMat} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>

      <mesh position={[w.x, closedY, closedZ - closedHalfL]} scale={[w.width, w.wallHeight, 0.5]} material={warehouseWallMat} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>

      <mesh position={[w.x, w.wallHeight + 0.15, closedZ]} scale={[w.width, 0.3, closedLength]} material={warehouseWallMat} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>

      {[-0.4, -0.2, 0, 0.2, 0.4].map((t) => (
        <mesh
          key={t}
          position={[w.x + t * w.width, 0.05, closedZ]}
          scale={[0.18, 0.1, closedLength * 0.98]}
          material={warehouseTrimMat}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      ))}
    </RigidBody>
  );
}

function OutdoorTrainingScenery() {
  const buildings = useMemo(
    () => [
      { p: [-62, 10, 58], s: [10, 20, 14] },
      { p: [-47, 14, 76], s: [12, 28, 11] },
      { p: [-28, 8, 69], s: [9, 16, 16] },
      { p: [88, 12, 62], s: [13, 24, 12] },
      { p: [72, 17, 79], s: [11, 34, 13] },
      { p: [51, 9, 72], s: [14, 18, 10] },
      { p: [-70, 7, 17], s: [8, 14, 18] },
      { p: [84, 8, 19], s: [9, 16, 15] },
    ],
    [],
  );
  const clouds = useMemo(
    () => [
      { p: [-46, 34, 46], s: [9, 1.8, 4] },
      { p: [-20, 42, 73], s: [13, 2.2, 5] },
      { p: [22, 38, 55], s: [11, 1.9, 4.5] },
      { p: [55, 45, 78], s: [15, 2.4, 5.5] },
      { p: [75, 32, 30], s: [10, 1.6, 4] },
      { p: [-72, 40, 21], s: [12, 2, 4.8] },
    ],
    [],
  );

  return (
    <group>
      {buildings.map((b, i) => (
        <group key={`building-${i}`} position={b.p as [number, number, number]}>
          <mesh scale={b.s as [number, number, number]} material={buildingMat} receiveShadow castShadow>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
          {[-0.28, 0, 0.28].map((x) => (
            <mesh
              key={x}
              position={[x * b.s[0], b.s[1] * 0.12, -b.s[2] * 0.51]}
              scale={[b.s[0] * 0.12, b.s[1] * 0.62, 0.03]}
              material={buildingWindowMat}
            >
              <boxGeometry args={[1, 1, 1]} />
            </mesh>
          ))}
        </group>
      ))}
      {clouds.map((c, i) => (
        <group key={`cloud-${i}`} position={c.p as [number, number, number]}>
          <mesh scale={c.s as [number, number, number]} material={cloudMat}>
            <sphereGeometry args={[1, 24, 12]} />
          </mesh>
          <mesh position={[c.s[0] * 0.34, -0.12, c.s[2] * 0.18]} scale={[c.s[0] * 0.58, c.s[1] * 0.92, c.s[2] * 0.78]} material={cloudMat}>
            <sphereGeometry args={[1, 24, 12]} />
          </mesh>
          <mesh position={[-c.s[0] * 0.28, 0.08, -c.s[2] * 0.1]} scale={[c.s[0] * 0.54, c.s[1] * 0.86, c.s[2] * 0.72]} material={cloudMat}>
            <sphereGeometry args={[1, 24, 12]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function launcherYawTowardStand(origin: { x: number; z: number }): number {
  const dx = TRAINING.defenseStand.x - origin.x;
  const dz = TRAINING.defenseStand.z - origin.z;
  return Math.atan2(-dx, -dz);
}

function TrainingGoalBank() {
  const rings = useMemo(
    () => [
      { y: 5.4, z: 8, r: 3.8, tube: 0.34 },
      { y: 11.4, z: 8, r: 2.7, tube: 0.28 },
      { y: 16.2, z: 8, r: 1.8, tube: 0.22 },
    ],
    [],
  );

  return (
    <group position={[DEFENSE_TARGET_X, 0, 0]}>
      <mesh position={[-0.34, 10.2, 8]} scale={[0.5, 20, 18]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#101820"
          roughness={0.46}
          metalness={0.16}
          emissive="#132530"
          emissiveIntensity={0.3}
        />
      </mesh>
      {rings.map((ring, i) => (
        <group key={i} position={[0, ring.y, ring.z]} rotation={[0, Math.PI / 2, 0]}>
          <mesh>
            <torusGeometry args={[ring.r, ring.tube, 16, 72]} />
            <meshStandardMaterial
              color="#f6fbff"
              emissive="#ffffff"
              emissiveIntensity={2.4}
              roughness={0.22}
              metalness={0.08}
              toneMapped={false}
            />
          </mesh>
          <mesh scale={[ring.r * 1.55, ring.r * 1.55, 1]}>
            <ringGeometry args={[0.72, 0.78, 64]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.2}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
      <pointLight position={[2.6, 11.5, 8]} color="#ffffff" intensity={28} distance={28} />
    </group>
  );
}

function TrainingLaunchers() {
  return (
    <>
      {TRAINING.defenseLaunchers.map((origin, i) => {
        const yaw = launcherYawTowardStand(origin);
        return (
        <group key={`${origin.x}-${origin.z}`} position={[origin.x, origin.y, origin.z]} rotation={[0, yaw, 0]}>
          <group rotation={[Math.PI / 2, 0, 0]}>
            <mesh>
              <cylinderGeometry args={[0.65, 1.0, 2.7, 24]} />
              <meshStandardMaterial color="#141a22" roughness={0.35} metalness={0.35} emissive={i % 2 ? '#4a2218' : '#18364a'} emissiveIntensity={0.5} />
            </mesh>
          </group>
          <mesh position={[0, 0, -1.58]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.72, 0.72, 0.12, 24]} />
            <meshBasicMaterial color={i % 2 ? '#ff744a' : '#6ee8ff'} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, -1.72]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.68, 0.85, 28]} />
            <meshBasicMaterial color="#f4fbff" transparent opacity={0.65} toneMapped={false} />
          </mesh>
        </group>
        );
      })}
    </>
  );
}

function TrainingPhysicsCube({
  id,
  position,
  scale,
  material,
}: {
  id: string;
  position: [number, number, number];
  scale: [number, number, number];
  material: THREE.Material;
}) {
  const bodyRef = useRef<RapierRigidBody>(null);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return undefined;
    const radius = Math.hypot(scale[0], scale[1], scale[2]) * 0.5;
    return registerTrainingCube(id, body, radius);
  }, [id, scale]);

  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      position={position}
      restitution={0.34}
      friction={0.78}
      linearDamping={0.18}
      angularDamping={0.24}
      canSleep={false}
    >
      <mesh castShadow receiveShadow scale={scale} material={material}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <CuboidCollider args={[scale[0] / 2, scale[1] / 2, scale[2] / 2]} />
    </RigidBody>
  );
}

function TrainingPhysicsCubes() {
  const cubes = useMemo(
    () => [
      { p: [-44, 1.85, 31], s: [3.0, 3.0, 3.0], m: 0 },
      { p: [-39, 1.55, 26], s: [2.45, 2.45, 2.45], m: 1 },
      { p: [-49, 2.25, 23], s: [2.0, 4.0, 2.0], m: 2 },
      { p: [-34, 1.3, 18], s: [3.3, 1.9, 1.9], m: 1 },
      { p: [-51, 2.0, 13], s: [2.15, 3.25, 2.15], m: 0 },
      { p: [63, 1.7, 30], s: [2.8, 2.8, 2.8], m: 2 },
      { p: [68, 1.7, 21], s: [2.8, 2.8, 2.8], m: 1 },
      { p: [73, 1.7, 12], s: [2.8, 2.8, 2.8], m: 0 },
    ],
    [],
  );

  return (
    <>
      {cubes.map((cube, i) => (
        <TrainingPhysicsCube
          key={i}
          id={`training-cube-${i}`}
          position={cube.p as [number, number, number]}
          scale={cube.s as [number, number, number]}
          material={cubeMats[cube.m]}
        />
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
    player.x + (Math.random() - 0.5) * 4.2,
    player.y + 1.1 + Math.random() * 2.5,
    player.z + (Math.random() - 0.5) * 4.8,
  );
  const launcherPos = new THREE.Vector3(
    origin.x,
    origin.y + (Math.random() - 0.35) * 2.6,
    origin.z,
  );
  const launchFrom = launcherPos
    .clone()
    .add(target.clone().sub(launcherPos).normalize().multiplyScalar(4.8));
  const flightTime = 0.58 + Math.random() * 0.36;
  const gravity = -11;
  const vx = (target.x - launchFrom.x) / flightTime;
  const vz = (target.z - launchFrom.z) / flightTime;
  const vy =
    (target.y - launchFrom.y - 0.5 * gravity * flightTime * flightTime) /
    flightTime;

  gameStore.releaseKickoffBall();
  releaseBallPhysics(ball);
  ball.setTranslation(launchFrom, true);
  ball.setLinvel(
    {
      x: vx * (0.9 + Math.random() * 0.24),
      y: vy,
      z: vz * (0.9 + Math.random() * 0.24),
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

function teeDrivingRangeBall(ball: RapierRigidBody): void {
  gameStore.releaseKickoffBall();
  gameStore.clearBallHolder(true);
  releaseBallPhysics(ball);
  ball.setTranslation(
    {
      x: TRAINING.drivingRange.x,
      y: DRIVING_TEE_Y,
      z: TRAINING.drivingRange.startZ + DRIVING_TEE_Z_OFFSET,
    },
    true,
  );
  ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
  ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
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
  const defenseShot = useRef({
    active: false,
    bounces: 0,
    lastBounceAt: 0,
    startedAt: 0,
  });
  const drivingBallReady = useRef(false);
  const drivingRespawnAt = useRef(0);
  const drivingShot = useRef({
    armed: false,
    active: false,
    startZ: TRAINING.drivingRange.startZ + DRIVING_TEE_Z_OFFSET,
    startedAt: 0,
    maxDistanceFt: 0,
    maxCarryFt: 0,
    maxApexFt: 0,
    maxSpeedMps: 0,
    maxInBoundsDistanceFt: 0,
    outOfBounds: false,
    obAt: -1,
    wasAirborne: false,
    landedAt: -1,
  });
  const rangeEndZ = TRAINING.drivingRange.startZ - TRAINING.drivingRange.length;

  useFrame(() => {
    const pos = playerPositionRef.current;
    const ball = ballBodyRef.current;
    const state = gameStore.getState();
    const now = performance.now() / 1000;
    const inDrivingStand = isTrainingDrivingRangeStand(pos.x, pos.z);
    const inDefenseStand = isTrainingDefenseStand(pos.x, pos.z);
    trainingMapStore.setDrivingRangeActive(inDrivingStand);

    if (ball && inDrivingStand && state.ballHolderId !== null) {
      drivingShot.current.armed = true;
      drivingShot.current.active = false;
      drivingBallReady.current = false;
    }

    if (
      ball &&
      inDrivingStand &&
      state.ballHolderId === null &&
      !drivingShot.current.active &&
      !drivingShot.current.armed &&
      !drivingBallReady.current &&
      now >= drivingRespawnAt.current
    ) {
      teeDrivingRangeBall(ball);
      drivingBallReady.current = true;
    }

    if (ball && drivingShot.current.armed && state.ballHolderId === null) {
      const bt = ball.translation();
      if (!drivingShot.current.active && bt.z < TRAINING.drivingRange.startZ + 2.2) {
        drivingShot.current.active = true;
        drivingShot.current.startedAt = performance.now() / 1000;
        drivingShot.current.maxDistanceFt = 0;
        drivingShot.current.maxCarryFt = 0;
        drivingShot.current.maxApexFt = Math.max(
          0,
          worldFtToDisplayFt(bt.y / FT_TO_M),
        );
        drivingShot.current.maxSpeedMps = 0;
        drivingShot.current.maxInBoundsDistanceFt = 0;
        drivingShot.current.outOfBounds = false;
        drivingShot.current.obAt = -1;
        drivingShot.current.wasAirborne = bt.y > DRIVING_AIRBORNE_Y;
        drivingShot.current.landedAt = -1;
      }

      if (drivingShot.current.active) {
        const lv = ball.linvel();
        const speed = Math.hypot(lv.x, lv.y, lv.z);
        const worldDistanceFt = Math.max(
          0,
          (TRAINING.drivingRange.startZ - bt.z) / FT_TO_M,
        );
        const distanceFt = worldFtToDisplayFt(worldDistanceFt);
        const inBoundsX =
          Math.abs(bt.x - TRAINING.drivingRange.x) <=
          TRAINING.drivingRange.width / 2;
        if (!drivingShot.current.outOfBounds && inBoundsX) {
          drivingShot.current.maxInBoundsDistanceFt = Math.max(
            drivingShot.current.maxInBoundsDistanceFt,
            distanceFt,
          );
        } else if (!drivingShot.current.outOfBounds) {
          drivingShot.current.outOfBounds = true;
          drivingShot.current.obAt = now;
          playBallLaunch();
        }
        drivingShot.current.maxDistanceFt = Math.max(
          drivingShot.current.maxDistanceFt,
          distanceFt,
        );
        if (drivingShot.current.landedAt < 0) {
          drivingShot.current.maxCarryFt = Math.max(
            drivingShot.current.maxCarryFt,
            distanceFt,
          );
        }
        drivingShot.current.maxApexFt = Math.max(
          drivingShot.current.maxApexFt,
          worldFtToDisplayFt(bt.y / FT_TO_M),
        );
        drivingShot.current.maxSpeedMps = Math.max(
          drivingShot.current.maxSpeedMps,
          speed,
        );
        trainingMapStore.updateActiveShot({
          distanceFt: drivingShot.current.outOfBounds
            ? drivingShot.current.maxInBoundsDistanceFt
            : drivingShot.current.maxDistanceFt,
          carryFt: drivingShot.current.maxCarryFt,
          apexFt: drivingShot.current.maxApexFt,
          speedMps: drivingShot.current.maxSpeedMps,
          landed: drivingShot.current.landedAt >= 0,
          outOfBounds: drivingShot.current.outOfBounds,
        });

        if (bt.y > DRIVING_AIRBORNE_Y || Math.abs(lv.y) > 3) {
          drivingShot.current.wasAirborne = true;
        }

        const shotAge = now - drivingShot.current.startedAt;
        const hitTurf =
          drivingShot.current.landedAt < 0 &&
          drivingShot.current.wasAirborne &&
          bt.y <= DRIVING_LANDING_Y &&
          shotAge > 0.3 &&
          lv.y <= 2.5;
        if (hitTurf) {
          drivingShot.current.landedAt = now;
          drivingShot.current.maxCarryFt = Math.max(
            drivingShot.current.maxCarryFt,
            distanceFt,
          );
        }
        const rolloutDone =
          drivingShot.current.landedAt >= 0 &&
          now - drivingShot.current.landedAt >= DRIVING_ROLLOUT_SEC;
        const done =
          (drivingShot.current.outOfBounds &&
            now - drivingShot.current.obAt >= DRIVING_OB_HOLD_SEC) ||
          rolloutDone ||
          bt.z < rangeEndZ + 1 ||
          shotAge > 18;
        if (done && shotAge > 0.28) {
          trainingMapStore.finishShot({
            distanceFt: drivingShot.current.outOfBounds
              ? drivingShot.current.maxInBoundsDistanceFt
              : drivingShot.current.maxDistanceFt,
            carryFt: drivingShot.current.maxCarryFt,
            apexFt: drivingShot.current.maxApexFt,
            speedMps: drivingShot.current.maxSpeedMps,
            landed: true,
            outOfBounds: drivingShot.current.outOfBounds,
          });
          drivingShot.current.active = false;
          drivingShot.current.armed = false;
          drivingBallReady.current = false;
          drivingRespawnAt.current = now + 0.85;
        }
      }
    }

    if (!ball) return;
    if (inDrivingStand) {
      defenseShot.current.active = false;
      return;
    }
    if (defenseShot.current.active) {
      const bt = ball.translation();
      const lv = ball.linvel();
      const bounceY = BALL.radius + 0.32;
      if (
        bt.y <= bounceY &&
        Math.abs(lv.y) > 1.0 &&
        now - defenseShot.current.lastBounceAt > 0.42
      ) {
        defenseShot.current.bounces += 1;
        defenseShot.current.lastBounceAt = now;
      }
      const timedOut =
        now - defenseShot.current.startedAt > DEFENSE_SHOT_MAX_AGE_SEC;
      const outOfTrainer =
        bt.x < DEFENSE_TARGET_X - 20 ||
        bt.x > TRAINING.defenseStand.x + 30 ||
        Math.abs(bt.z - TRAINING.defenseStand.z) > 48 ||
        bt.y < -3 ||
        bt.y > TRAINING.warehouse.wallHeight + 12;
      if (
        defenseShot.current.bounces >= DEFENSE_SHOT_BOUNCES_BEFORE_RESET ||
        timedOut ||
        outOfTrainer
      ) {
        defenseShot.current.active = false;
        nextLaunchAt.current = now + 0.8;
      } else {
        return;
      }
    }
    if (!inDefenseStand) return;
    if (inDrivingStand) return;
    if (state.ballHolderId !== null) return;
    if (now < nextLaunchAt.current) return;
    nextLaunchAt.current = now + 1.95 + Math.random() * 1.25;
    launchTrainingBallAtPlayer(ball, pos);
    defenseShot.current.active = true;
    defenseShot.current.bounces = 0;
    defenseShot.current.lastBounceAt = now;
    defenseShot.current.startedAt = now;
  });

  return (
    <>
      <color attach="background" args={['#74c9ff']} />
      <fog attach="fog" args={['#74c9ff', 155, 390]} />
      <group>
      <ambientLight intensity={0.62} />
      <directionalLight position={[18, 30, 18]} intensity={1.2} castShadow />
      <pointLight position={[TRAINING.defenseStand.x, 10, TRAINING.defenseStand.z]} intensity={22} distance={32} color="#76dfff" />
      <pointLight position={[TRAINING.drivingRange.x, 12, TRAINING.drivingRange.startZ - 35]} intensity={26} distance={56} color="#9cffbf" />

      <WarehouseShell />
      <OutdoorTrainingScenery />
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
        collidable={false}
      />
      <Html center distanceFactor={14} position={[TRAINING.defenseStand.x, 1.1, TRAINING.defenseStand.z - 5.4]} zIndexRange={TRAINING_HTML_Z_INDEX_RANGE}>
        <div style={{ color: '#d9f5ff', font: '900 13px system-ui', textShadow: '0 2px 5px #000' }}>
          ROCKET REACTION PLATFORM
        </div>
      </Html>
      <TrainingGoalBank />
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
        collidable={false}
      />
      <Html center distanceFactor={14} position={[TRAINING.drivingStand.x, 1.1, TRAINING.drivingStand.z + 4.6]} zIndexRange={TRAINING_HTML_Z_INDEX_RANGE}>
        <div style={{ color: '#edffd6', font: '900 13px system-ui', textShadow: '0 2px 5px #000' }}>
          DRIVING RANGE: BALL TEES ON PAD
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
      <DrivingLiveBallFrame ballBodyRef={ballBodyRef} />
      <DrivingShotMarkers />

      <mesh position={[TRAINING.drivingRange.x, 0.22, rangeEndZ]}>
        <boxGeometry args={[TRAINING.drivingRange.width, 0.42, 0.35]} />
        <meshBasicMaterial color="#ffef7a" toneMapped={false} />
      </mesh>
      </group>
    </>
  );
}
