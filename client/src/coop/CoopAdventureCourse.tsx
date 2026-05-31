import { Html } from '@react-three/drei';
import {
  CuboidCollider,
  CylinderCollider,
  interactionGroups,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import pictureEndUrl from '../assets/images/ui/pictureend.png';
import { inputManager } from '../game/InputManager';
import { multiplayerStore } from '../multiplayer/multiplayerStore';
import { COOP_ADVENTURE_LEVELS, type CoopAdventurePlatform } from './coopAdventureLevels';
import {
  buildCoopAdventureClouds,
  clearCoopAdventureClouds,
  setCoopAdventureClouds,
} from './coopAdventureClouds';
import {
  clearCoopAdventureRails,
  setCoopAdventureRails,
} from './coopAdventureRails';
import { BTS_FACTS } from './btsFacts';

const PLATFORM_COLLISION = interactionGroups(2, [0, 1, 2]);
const FALL_RESCUE_Y = -28;
const GOAL_RADIUS = 4.4;
const RAIL_BUTTON_RADIUS = 4.2;
const RAIL_BUTTON_VERTICAL_RADIUS = 4.6;
const COOP_MAX_RAIL_PLATFORMS = 10;
const FACT_DISPLAY_SEC = 10;
const START_READY_RADIUS = 8;
const COOP_COIN_RADIUS = 3.3;
const PUZZLE_CLOSE_THRESHOLD = 0.75;

const _goalPos = new THREE.Vector3();
const _remotePos = new THREE.Vector3();
const _spawnPos = new THREE.Vector3();
const _remoteSpawnPos = new THREE.Vector3();
const _buttonPos = new THREE.Vector3();
const _railStart = new THREE.Vector3();
const _railEnd = new THREE.Vector3();
const _tokenPos = new THREE.Vector3();
const _railDirection = new THREE.Vector3();
const _coinPos = new THREE.Vector3();
const _railMid = new THREE.Vector3();
const _railDelta = new THREE.Vector3();
const _railQuat = new THREE.Quaternion();
const _railXAxis = new THREE.Vector3(1, 0, 0);

type ActiveRail = {
  key: string;
  platformId: string;
};

type FactNotice = {
  fact: string;
  levelName: string;
  completeAfter: boolean;
};

type RemoteLoveToast = {
  text: string;
  from: string;
  until: number;
};

type PuzzleState = {
  id: number;
  question: string;
  answer: string;
  guesses: number;
  status: 'active' | 'close' | 'wrong' | 'solved' | 'skipped';
};

const COOP_PUZZLES = [
  { question: 'What color do you get by mixing blue and yellow?', answer: 'green' },
  { question: 'What is 9 + 6?', answer: '15' },
  { question: 'What shape has 3 sides?', answer: 'triangle' },
  { question: 'What planet is known as the Red Planet?', answer: 'mars' },
  { question: 'What is the opposite of north?', answer: 'south' },
  { question: 'How many days are in a week?', answer: '7' },
  { question: 'What sweet food comes from flowers and hives?', answer: 'honey' },
  { question: 'What is 12 divided by 3?', answer: '4' },
  { question: 'What do you call the middle of a target?', answer: 'center' },
  { question: 'What is frozen water called?', answer: 'ice' },
] as const;

function playerSpawnForLevel(levelIndex: number, teamSlot: number): THREE.Vector3 {
  const level = COOP_ADVENTURE_LEVELS[levelIndex]!;
  const side = teamSlot % 2 === 0 ? -1 : 1;
  return _spawnPos.set(
    level.spawn.x + side * 2.7,
    level.spawn.y,
    level.spawn.z + (teamSlot > 1 ? -2.4 : 0),
  );
}

function CoopClouds({ platforms }: { platforms: CoopAdventurePlatform[] }) {
  const clouds = useMemo(
    () => buildCoopAdventureClouds(platforms),
    [platforms],
  );
  const geo = useMemo(() => new THREE.SphereGeometry(1, 14, 10), []);
  const mat = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color: '#f4fbff',
        emissive: '#9dccff',
        emissiveIntensity: 0.75,
        toneMapped: false,
      }),
    [],
  );

  return (
    <group>
      {clouds.map((cloud, i) => (
        <group key={i} position={cloud.position}>
          <mesh geometry={geo} material={mat} scale={cloud.scale} />
          <mesh
            geometry={geo}
            material={mat}
            position={[cloud.scale[0] * 0.55, 1.2, -cloud.scale[2] * 0.15]}
            scale={[
              cloud.scale[0] * 0.6,
              cloud.scale[1] * 0.85,
              cloud.scale[2] * 0.7,
            ]}
          />
          <mesh
            geometry={geo}
            material={mat}
            position={[-cloud.scale[0] * 0.48, 0.8, cloud.scale[2] * 0.22]}
            scale={[
              cloud.scale[0] * 0.58,
              cloud.scale[1] * 0.75,
              cloud.scale[2] * 0.62,
            ]}
          />
        </group>
      ))}
    </group>
  );
}

function platformMotionOffset(platform: CoopAdventurePlatform, timeSec: number): number {
  if (!platform.motion) return 0;
  return (
    Math.sin(timeSec * platform.motion.speed + platform.motion.phase) *
    platform.motion.amplitude
  );
}

function CoopPlatformTree({ index, platform }: { index: number; platform: CoopAdventurePlatform }) {
  const top = platform.size.y * 0.5;
  const spreadX = Math.max(1.8, platform.size.x * 0.24);
  const spreadZ = Math.max(1.6, platform.size.z * 0.22);
  const x = index % 2 === 0 ? -spreadX : spreadX * 0.7;
  const z = index % 3 === 0 ? -spreadZ : spreadZ * 0.85;
  const height = 1.7 + (index % 2) * 0.35;
  return (
    <group position={[x, top + height * 0.5, z]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.16, 0.22, height, 7]} />
        <meshStandardMaterial color="#5b3420" roughness={0.8} />
      </mesh>
      <mesh position={[0, height * 0.58, 0]} castShadow>
        <coneGeometry args={[0.78, 1.35, 8]} />
        <meshStandardMaterial
          color="#1f8f52"
          roughness={0.86}
          emissive="#0d3d25"
          emissiveIntensity={0.08}
        />
      </mesh>
    </group>
  );
}

function CoopLoveToken({
  platform,
  collected,
}: {
  platform: CoopAdventurePlatform;
  collected: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.position.y =
      platformTopY(platform) + 1.25 + platformMotionOffset(platform, t) + Math.sin(t * 2.4) * 0.18;
    ref.current.rotation.y = t * 1.8;
  });
  if (collected) return null;
  return (
    <group
      ref={ref}
      position={[platform.position.x, platformTopY(platform) + 1.25, platform.position.z]}
    >
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.55, 0.12, 10, 28]} />
        <meshStandardMaterial
          color="#ff7ac7"
          emissive="#ff4eb6"
          emissiveIntensity={1.6}
          roughness={0.35}
          metalness={0.1}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[-0.16, 0.08, 0]} scale={[1, 0.9, 1]}>
        <sphereGeometry args={[0.22, 14, 10]} />
        <meshStandardMaterial color="#ffe2f2" emissive="#ff67c4" emissiveIntensity={0.9} toneMapped={false} />
      </mesh>
      <mesh position={[0.16, 0.08, 0]} scale={[1, 0.9, 1]}>
        <sphereGeometry args={[0.22, 14, 10]} />
        <meshStandardMaterial color="#ffe2f2" emissive="#ff67c4" emissiveIntensity={0.9} toneMapped={false} />
      </mesh>
      <pointLight color="#ff75c7" intensity={1.15} distance={7} />
    </group>
  );
}

function CoopCoin({
  platform,
  index,
  collected,
}: {
  platform: CoopAdventurePlatform;
  index: number;
  collected: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const side = index % 2 === 0 ? -1 : 1;
    const lane = index === 2 ? 0 : side;
    ref.current.position.set(
      platform.position.x + lane * platform.size.x * 0.22,
      platformTopYAt(platform, t) + 1.45 + Math.sin(t * 3 + index) * 0.16,
      platform.position.z + (index === 2 ? -platform.size.z * 0.18 : platform.size.z * 0.18),
    );
    ref.current.rotation.y = t * 2.6;
  });
  if (collected) return null;
  return (
    <group ref={ref}>
      <mesh castShadow>
        <cylinderGeometry args={[0.44, 0.44, 0.12, 28]} />
        <meshStandardMaterial
          color="#ffd45e"
          emissive="#ffb629"
          emissiveIntensity={1.35}
          metalness={0.55}
          roughness={0.28}
          toneMapped={false}
        />
      </mesh>
      <mesh scale={[0.72, 0.72, 0.72]}>
        <torusGeometry args={[0.45, 0.035, 8, 28]} />
        <meshBasicMaterial color="#fff1a8" toneMapped={false} />
      </mesh>
    </group>
  );
}

function CoopPlatform({ platform }: { platform: CoopAdventurePlatform }) {
  const bodyRef = useRef<RapierRigidBody | null>(null);
  const topY = platform.size.y * 0.5 + 0.035;
  const trimColor =
    platform.kind === 'finish'
      ? '#6fffd2'
      : platform.kind === 'start'
        ? '#74bbff'
        : '#d8f08a';
  const stackRadius = Math.max(platform.size.x, platform.size.z) * 0.45;
  const stackLayerHeight = platform.size.y / 4;

  useFrame(({ clock }) => {
    if (!platform.motion || !bodyRef.current) return;
    bodyRef.current.setNextKinematicTranslation({
      x: platform.position.x,
      y: platform.position.y + platformMotionOffset(platform, clock.elapsedTime),
      z: platform.position.z,
    });
  });

  const trees = Array.from({ length: platform.treeCount }, (_, i) => i);

  return (
    <RigidBody
      ref={bodyRef}
      type={platform.motion ? 'kinematicPosition' : 'fixed'}
      colliders={false}
      position={[platform.position.x, platform.position.y, platform.position.z]}
    >
      {platform.shape === 'stack' ? (
        <>
          {[0, 1, 2, 3].map((layer) => {
            const radius = stackRadius * (1 - layer * 0.06);
            const y = -platform.size.y * 0.5 + stackLayerHeight * (layer + 0.5);
            return (
              <CylinderCollider
                key={`collider-${layer}`}
                args={[stackLayerHeight * 0.5, radius]}
                position={[0, y, 0]}
                collisionGroups={PLATFORM_COLLISION}
                friction={1}
                restitution={0.03}
              />
            );
          })}
        </>
      ) : (
        <CuboidCollider
          args={[platform.size.x / 2, platform.size.y / 2, platform.size.z / 2]}
          collisionGroups={PLATFORM_COLLISION}
          friction={1}
          restitution={0.03}
        />
      )}
      <group>
        {platform.shape === 'stack' ? (
          <>
            {[0, 1, 2, 3].map((layer) => {
              const radius = stackRadius * (1 - layer * 0.06);
              const y = -platform.size.y * 0.5 + stackLayerHeight * (layer + 0.5);
              return (
                <mesh key={layer} position={[0, y, 0]} castShadow receiveShadow>
                  <cylinderGeometry args={[radius, radius * 1.04, stackLayerHeight, 28]} />
                  <meshStandardMaterial color={platform.side} roughness={0.82} metalness={0} />
                </mesh>
              );
            })}
            <mesh position={[0, platform.size.y * 0.5 + 0.055, 0]} receiveShadow>
              <cylinderGeometry args={[stackRadius * 0.84, stackRadius * 0.86, 0.14, 28]} />
              <meshStandardMaterial
                color={platform.grass}
                roughness={0.95}
                emissive={platform.grass}
                emissiveIntensity={0.06}
              />
            </mesh>
          </>
        ) : (
          <>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[platform.size.x, platform.size.y, platform.size.z]} />
              <meshStandardMaterial color={platform.side} roughness={0.78} metalness={0} />
            </mesh>
            <mesh position={[0, platform.size.y * 0.5 + 0.045, 0]} receiveShadow>
              <boxGeometry args={[platform.size.x + 0.12, 0.12, platform.size.z + 0.12]} />
              <meshStandardMaterial
                color={platform.grass}
                roughness={0.95}
                metalness={0}
                emissive={platform.grass}
                emissiveIntensity={0.06}
              />
            </mesh>
          </>
        )}
        <mesh position={[0, topY + 0.095, 0]}>
          <boxGeometry args={[platform.size.x + 0.38, 0.08, 0.28]} />
          <meshStandardMaterial
            color={trimColor}
            emissive={trimColor}
            emissiveIntensity={platform.kind === 'finish' ? 1.1 : 0.2}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, topY + 0.105, 0]}>
          <boxGeometry args={[0.28, 0.08, platform.size.z + 0.38]} />
          <meshStandardMaterial
            color={trimColor}
            emissive={trimColor}
            emissiveIntensity={platform.kind === 'finish' ? 1.1 : 0.2}
            toneMapped={false}
          />
        </mesh>
        {trees.map((index) => (
          <CoopPlatformTree key={index} index={index} platform={platform} />
        ))}
      </group>
      {platform.kind === 'finish' && (
        <pointLight
          color="#63ffd0"
          intensity={2.2}
          distance={18}
          position={[0, topY + 2, 0]}
        />
      )}
    </RigidBody>
  );
}

function platformTopY(platform: CoopAdventurePlatform): number {
  return platform.position.y + platform.size.y * 0.5;
}

function platformMotionY(platform: CoopAdventurePlatform, timeSec: number): number {
  return platformMotionOffset(platform, timeSec);
}

function platformTopYAt(platform: CoopAdventurePlatform, timeSec: number): number {
  return platformTopY(platform) + platformMotionY(platform, timeSec);
}

function normalizedAnswer(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function answerSimilarity(a: string, b: string): number {
  const left = normalizedAnswer(a);
  const right = normalizedAnswer(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const maxLen = Math.max(left.length, right.length);
  const prev = Array.from({ length: right.length + 1 }, (_, i) => i);
  const curr = new Array(right.length + 1).fill(0);
  for (let i = 1; i <= left.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    for (let j = 0; j <= right.length; j += 1) prev[j] = curr[j];
  }
  return 1 - prev[right.length] / maxLen;
}

function railButtonPosition(platform: CoopAdventurePlatform): THREE.Vector3 {
  return _buttonPos.set(
    platform.position.x,
    platformTopY(platform) + 0.42,
    platform.position.z + platform.size.z * 0.28,
  );
}

function railEndpoint(
  platform: CoopAdventurePlatform,
  toward?: CoopAdventurePlatform,
  timeSec = 0,
): THREE.Vector3 {
  const point = new THREE.Vector3(
    platform.position.x,
    platformTopYAt(platform, timeSec) + 1.08,
    platform.position.z,
  );
  if (!toward) return point;
  _railDirection.set(
    toward.position.x - platform.position.x,
    0,
    toward.position.z - platform.position.z,
  );
  const distance = _railDirection.length();
  if (distance <= 0.001) return point;
  _railDirection.multiplyScalar(1 / distance);
  const edgeX =
    Math.abs(_railDirection.x) > 0.001
      ? platform.size.x * 0.5 / Math.abs(_railDirection.x)
      : Infinity;
  const edgeZ =
    Math.abs(_railDirection.z) > 0.001
      ? platform.size.z * 0.5 / Math.abs(_railDirection.z)
      : Infinity;
  const edge = Math.max(0, Math.min(edgeX, edgeZ) - 1.4);
  point.addScaledVector(_railDirection, edge);
  return point;
}

function railKey(levelId: number, platformId: string): string {
  return `coop-rail-${levelId}-${platformId}`;
}

function railSegmentForPlatform(
  platforms: CoopAdventurePlatform[],
  targetPlatformId: string,
  timeSec = 0,
): { start: THREE.Vector3; end: THREE.Vector3 } | null {
  const maxIndex = Math.min(platforms.length, COOP_MAX_RAIL_PLATFORMS) - 1;
  const targetIndex = platforms.findIndex(
    (candidate) => candidate.id === targetPlatformId,
  );
  if (targetIndex <= 0 || targetIndex > maxIndex) return null;
  const startPlatform = platforms[targetIndex - 1]!;
  const endPlatform = platforms[targetIndex]!;
  return {
    start: railEndpoint(startPlatform, endPlatform, timeSec),
    end: railEndpoint(endPlatform, startPlatform, timeSec),
  };
}

function CoopRailButton({
  platform,
  active,
}: {
  platform: CoopAdventurePlatform;
  active: boolean;
}) {
  const p = railButtonPosition(platform).clone();
  const color = active ? '#63ffd0' : '#ffd45e';
  return (
    <group position={[p.x, p.y, p.z]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.9, 0.9, 0.28, 24]} />
        <meshStandardMaterial
          color={active ? '#183d36' : '#352911'}
          emissive={color}
          emissiveIntensity={active ? 0.65 : 0.95}
          roughness={0.48}
          metalness={0.18}
          toneMapped={false}
        />
      </mesh>
      <pointLight color={color} intensity={active ? 0.9 : 1.4} distance={8} />
      <Html center distanceFactor={12} position={[0, 0.8, 0]}>
        <div className={`coop-rail-button ${active ? 'coop-rail-button--active' : ''}`}>
          {active ? 'RAIL LIVE' : 'PRESS E'}
        </div>
      </Html>
    </group>
  );
}

function CoopSpawnedRail({
  startPlatform,
  endPlatform,
}: {
  startPlatform: CoopAdventurePlatform;
  endPlatform: CoopAdventurePlatform;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<RapierRigidBody | null>(null);
  const railColliderLength = useMemo(() => {
    const segment = {
      start: railEndpoint(startPlatform, endPlatform),
      end: railEndpoint(endPlatform, startPlatform),
    };
    return segment.end.distanceTo(segment.start);
  }, [endPlatform, startPlatform]);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    const timeSec = clock.elapsedTime;
    _railStart.copy(railEndpoint(startPlatform, endPlatform, timeSec));
    _railEnd.copy(railEndpoint(endPlatform, startPlatform, timeSec));
    _railDelta.subVectors(_railEnd, _railStart);
    const length = Math.max(0.001, _railDelta.length());
    _railMid.copy(_railStart).lerp(_railEnd, 0.5);
    _railQuat.setFromUnitVectors(_railXAxis, _railDelta.multiplyScalar(1 / length));
    group.position.copy(_railMid);
    group.quaternion.copy(_railQuat);
    group.scale.set(1, length, 1);
    if (bodyRef.current) {
      bodyRef.current.setNextKinematicTranslation(_railMid);
      bodyRef.current.setNextKinematicRotation(_railQuat);
    }
  });

  return (
    <>
      <group ref={groupRef}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 1, 10]} />
          <meshStandardMaterial
            color="#05070a"
            emissive="#0edbc6"
            emissiveIntensity={0.26}
            metalness={0.36}
            roughness={0.22}
            toneMapped={false}
          />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.28, 0.28, 1, 10]} />
          <meshBasicMaterial
            color="#7cffef"
            transparent
            opacity={0.12}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
      <RigidBody
        ref={bodyRef}
        type="kinematicPosition"
        colliders={false}
      >
        <CuboidCollider
          args={[railColliderLength * 0.5, 0.24, 0.42]}
          collisionGroups={PLATFORM_COLLISION}
          friction={1}
          restitution={0.02}
        />
      </RigidBody>
    </>
  );
}

function CoopGoalPicture({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const texture = useLoader(THREE.TextureLoader, pictureEndUrl);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  }, [texture]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.set(
      position[0],
      position[1] + Math.sin(clock.elapsedTime * 1.85) * 0.42,
      position[2],
    );
    ref.current.quaternion.copy(camera.quaternion);
  });

  return (
    <mesh ref={ref} position={position} renderOrder={3}>
      <planeGeometry args={[12, 8]} />
      <meshBasicMaterial
        map={texture}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

export function CoopAdventureCourse({
  playerPositionRef,
  playerBodyRef,
}: {
  playerPositionRef: React.MutableRefObject<THREE.Vector3>;
  playerBodyRef: React.MutableRefObject<RapierRigidBody | null>;
}) {
  const [levelIndex, setLevelIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [activeRails, setActiveRails] = useState<ActiveRail[]>([]);
  const [factNotice, setFactNotice] = useState<FactNotice | null>(null);
  const [tokenFactNotice, setTokenFactNotice] = useState<FactNotice | null>(null);
  const [remoteLoveToast, setRemoteLoveToast] = useState<RemoteLoveToast | null>(null);
  const [collectedLoveTokens, setCollectedLoveTokens] = useState<Set<string>>(
    () => new Set(),
  );
  const [collectedCoins, setCollectedCoins] = useState<Set<string>>(
    () => new Set(),
  );
  const [puzzlesSolved, setPuzzlesSolved] = useState(0);
  const [activePuzzle, setActivePuzzle] = useState<PuzzleState | null>(null);
  const [puzzleInput, setPuzzleInput] = useState('');
  const advanceLock = useRef(0);
  const tokenFactUntil = useRef(0);
  const pendingAdvance = useRef<{
    at: number;
    completeAfter: boolean;
  } | null>(null);
  const queuedFact = useRef<FactNotice | null>(null);
  const shownFactIndexes = useRef<Set<number>>(new Set());
  const factCursor = useRef(Math.floor(Math.random() * BTS_FACTS.length));
  const teleportedLevel = useRef(-1);
  const level = COOP_ADVENTURE_LEVELS[levelIndex]!;
  const remotePlayers = useSyncExternalStore(
    multiplayerStore.subscribe,
    () => multiplayerStore.getState().remotePlayers,
  );
  const coopRails = useSyncExternalStore(
    multiplayerStore.subscribe,
    () => multiplayerStore.getState().coopRails,
  );
  const teamSlot = useSyncExternalStore(
    multiplayerStore.subscribe,
    () => multiplayerStore.getState().teamSlot,
  );

  useEffect(() => {
    teleportedLevel.current = -1;
    pendingAdvance.current = null;
    setFactNotice(null);
    setTokenFactNotice(null);
    setRemoteLoveToast(null);
    setCollectedLoveTokens(new Set());
    setCollectedCoins(new Set());
    setPuzzlesSolved(0);
    setActivePuzzle(null);
    setPuzzleInput('');
    setActiveRails([]);
  }, [levelIndex, teamSlot]);

  useEffect(() => {
    const levelRails = coopRails
      .filter(
        (action) =>
          action.kind === 'railSpawn' &&
          action.levelId === level.id &&
          action.railKey &&
          action.platformId,
      )
      .map((action) => ({
        key: action.railKey!,
        platformId: action.platformId!,
      }));
    if (levelRails.length === 0) return;
    setActiveRails((rails) => {
      let changed = false;
      const next = [...rails];
      for (const rail of levelRails) {
        if (next.some((candidate) => candidate.key === rail.key)) continue;
        next.push(rail);
        changed = true;
      }
      return changed ? next : rails;
    });
  }, [coopRails, level.id]);

  useEffect(() => {
    setCoopAdventureClouds(buildCoopAdventureClouds(level.platforms));
    return () => clearCoopAdventureClouds();
  }, [level.platforms]);

  useEffect(() => {
    setCoopAdventureRails(
      activeRails.flatMap((rail) => {
        const segment = railSegmentForPlatform(level.platforms, rail.platformId);
        if (!segment) return [];
        return [
          {
            key: rail.key,
            start: segment.start,
            end: segment.end,
          },
        ];
      }),
    );
    return () => clearCoopAdventureRails();
  }, [activeRails, level]);

  const pickFact = (seed = 0): string => {
    if (shownFactIndexes.current.size >= BTS_FACTS.length) {
      shownFactIndexes.current.clear();
    }
    let nextIndex = Math.abs((factCursor.current + seed * 7 + 11) % BTS_FACTS.length);
    for (let i = 0; i < BTS_FACTS.length; i += 1) {
      const candidate = (nextIndex + i * 13) % BTS_FACTS.length;
      if (!shownFactIndexes.current.has(candidate)) {
        nextIndex = candidate;
        break;
      }
    }
    shownFactIndexes.current.add(nextIndex);
    factCursor.current = (nextIndex + 17) % BTS_FACTS.length;
    return BTS_FACTS[nextIndex]!;
  };

  const advanceToLevel = (
    nextLevelId: number,
    notice: FactNotice,
    nowSec: number,
  ): void => {
    const nextIndex = THREE.MathUtils.clamp(
      Math.floor(nextLevelId) - 1,
      0,
      COOP_ADVENTURE_LEVELS.length - 1,
    );
    if (nextIndex === levelIndex) return;
    advanceLock.current = 1.4;
    queuedFact.current = notice;
    pendingAdvance.current = null;
    setFactNotice(null);
    setTokenFactNotice(null);
    tokenFactUntil.current = nowSec;
    setActiveRails([]);
    setCollectedLoveTokens(new Set());
    setLevelIndex(nextIndex);
  };

  const submitPuzzleAnswer = (): void => {
    if (!activePuzzle) return;
    const similarity = answerSimilarity(puzzleInput, activePuzzle.answer);
    if (similarity >= 1) {
      setPuzzlesSolved((count) => count + 1);
      setActivePuzzle({ ...activePuzzle, status: 'solved' });
      setTimeout(() => {
        setActivePuzzle(null);
        setPuzzleInput('');
      }, 900);
      return;
    }
    if (similarity >= PUZZLE_CLOSE_THRESHOLD) {
      setActivePuzzle({ ...activePuzzle, status: 'close' });
      return;
    }
    const guesses = activePuzzle.guesses + 1;
    if (guesses >= 2) {
      setActivePuzzle({ ...activePuzzle, guesses, status: 'skipped' });
      setTimeout(() => {
        setActivePuzzle(null);
        setPuzzleInput('');
      }, 1000);
      return;
    }
    setActivePuzzle({ ...activePuzzle, guesses, status: 'wrong' });
  };

  useFrame(({ clock }, dt) => {
    advanceLock.current = Math.max(0, advanceLock.current - dt);
    for (const action of multiplayerStore.drainRemoteCoopRailActions()) {
      if (
        action.kind !== 'railSpawn' ||
        action.levelId !== level.id ||
        !action.railKey ||
        !action.platformId
      ) {
        continue;
      }
      setActiveRails((rails) =>
        rails.some((rail) => rail.key === action.railKey)
          ? rails
          : [...rails, { key: action.railKey!, platformId: action.platformId! }],
      );
    }
    const nowSec = performance.now() / 1000;
    const motionTimeSec = clock.elapsedTime;
    if (activeRails.length > 0) {
      setCoopAdventureRails(
        activeRails.flatMap((rail) => {
          const segment = railSegmentForPlatform(level.platforms, rail.platformId, motionTimeSec);
          if (!segment) return [];
          return [{ key: rail.key, start: segment.start, end: segment.end }];
        }),
      );
    }
    for (const action of multiplayerStore.drainRemoteCoopEventActions()) {
      if (action.kind === 'levelAdvance' && action.levelId) {
        const targetLevel = COOP_ADVENTURE_LEVELS[action.levelId - 1];
        if (!targetLevel) continue;
        advanceToLevel(
          targetLevel.id,
          {
            fact: pickFact(targetLevel.id + levelIndex),
            levelName: targetLevel.name,
            completeAfter: false,
          },
          nowSec,
        );
      } else if (action.kind === 'loveMessage') {
        const player =
          remotePlayers.find((candidate) => candidate.id === action.ownerId) ??
          null;
        setRemoteLoveToast({
          text: action.message === 'more' ? 'Love you more' : 'I love you',
          from: player?.name ?? 'Partner',
          until: nowSec + 2.8,
        });
      }
    }

    const body = playerBodyRef.current;
    if (body && teleportedLevel.current !== levelIndex) {
      const spawn = playerSpawnForLevel(levelIndex, teamSlot);
      body.setTranslation(spawn, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      playerPositionRef.current.copy(spawn);
      teleportedLevel.current = levelIndex;
    }
    if (body && body.translation().y < FALL_RESCUE_Y) {
      const spawn = playerSpawnForLevel(levelIndex, teamSlot);
      body.setTranslation(spawn, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      playerPositionRef.current.copy(spawn);
    }
    const pending = pendingAdvance.current;
    if (pending && pending.at <= nowSec) {
      pendingAdvance.current = null;
      setFactNotice(null);
      if (pending.completeAfter) {
        setCompleted(true);
      }
      return;
    }
    if (tokenFactNotice && tokenFactUntil.current <= nowSec) {
      setTokenFactNotice(null);
    }
    if (remoteLoveToast && remoteLoveToast.until <= nowSec) {
      setRemoteLoveToast(null);
    }

    for (const platform of level.platforms) {
      if (!platform.loveToken) continue;
      const key = `love-${level.id}-${platform.id}`;
      if (collectedLoveTokens.has(key)) continue;
      _tokenPos.set(
        platform.position.x,
        platformTopY(platform) + 1.2 + platformMotionOffset(platform, motionTimeSec),
        platform.position.z,
      );
      if (playerPositionRef.current.distanceTo(_tokenPos) > 3.2) continue;
      setCollectedLoveTokens((previous) => {
        const next = new Set(previous);
        next.add(key);
        return next;
      });
      setTokenFactNotice({
        fact: pickFact(levelIndex + collectedLoveTokens.size + 11),
        levelName: 'Love Token',
        completeAfter: false,
      });
      tokenFactUntil.current = nowSec + 8;
      break;
    }

    if (!activePuzzle) {
      for (let platformIndex = 1; platformIndex < level.platforms.length; platformIndex += 1) {
        const platform = level.platforms[platformIndex]!;
        const coinCount = platform.kind === 'finish' ? 3 : 2;
        for (let coinIndex = 0; coinIndex < coinCount; coinIndex += 1) {
          const key = `coin-${level.id}-${platform.id}-${coinIndex}`;
          if (collectedCoins.has(key)) continue;
          const side = coinIndex % 2 === 0 ? -1 : 1;
          const lane = coinIndex === 2 ? 0 : side;
          _coinPos.set(
            platform.position.x + lane * platform.size.x * 0.22,
            platformTopYAt(platform, motionTimeSec) + 1.45,
            platform.position.z + (coinIndex === 2 ? -platform.size.z * 0.18 : platform.size.z * 0.18),
          );
          if (playerPositionRef.current.distanceTo(_coinPos) > COOP_COIN_RADIUS) continue;
          setCollectedCoins((previous) => {
            const next = new Set(previous);
            next.add(key);
            return next;
          });
          const puzzle = COOP_PUZZLES[(collectedCoins.size + levelIndex) % COOP_PUZZLES.length]!;
          setActivePuzzle({
            id: collectedCoins.size + levelIndex * 10,
            question: puzzle.question,
            answer: puzzle.answer,
            guesses: 0,
            status: 'active',
          });
          setPuzzleInput('');
          document.exitPointerLock?.();
          return;
        }
      }
    }

    if (!pending && queuedFact.current && !factNotice) {
      const localSpawn = playerSpawnForLevel(levelIndex, teamSlot).clone();
      const localAtStart =
        playerPositionRef.current.distanceTo(localSpawn) <= START_READY_RADIUS;
      const remoteAtStart =
        remotePlayers.length > 0 &&
        remotePlayers.every((player) => {
          _remotePos.set(player.position.x, player.position.y, player.position.z);
          _remoteSpawnPos.copy(playerSpawnForLevel(levelIndex, player.teamSlot));
          return _remotePos.distanceTo(_remoteSpawnPos) <= START_READY_RADIUS;
        });
      if (localAtStart && remoteAtStart) {
        const notice = queuedFact.current;
        queuedFact.current = null;
        setFactNotice(notice);
        pendingAdvance.current = {
          at: nowSec + FACT_DISPLAY_SEC,
          completeAfter: false,
        };
        return;
      }
    }

    if (inputManager.consumeInteract() && !completed) {
      const nearest = level.platforms.find((platform) => {
        if (!railSegmentForPlatform(level.platforms, platform.id)) return false;
        const key = railKey(level.id, platform.id);
        if (activeRails.some((rail) => rail.key === key)) return false;
        const p = railButtonPosition(platform);
        const vertical = Math.abs(playerPositionRef.current.y - p.y);
        if (vertical > RAIL_BUTTON_VERTICAL_RADIUS) return false;
        const dx = playerPositionRef.current.x - p.x;
        const dz = playerPositionRef.current.z - p.z;
        return Math.hypot(dx, dz) <= RAIL_BUTTON_RADIUS;
      });
      if (nearest) {
        const key = railKey(level.id, nearest.id);
        setActiveRails((rails) =>
          rails.some((rail) => rail.key === key)
            ? rails
            : [...rails, { key, platformId: nearest.id }],
        );
        multiplayerStore.sendCoopAction({
          kind: 'railSpawn',
          targetId: '',
          railKey: key,
          levelId: level.id,
          platformId: nearest.id,
          position: nearest.position,
          velocity: { x: 0, y: 0, z: 0 },
        });
      }
    }

    if (advanceLock.current > 0 || completed || pendingAdvance.current) return;

    _goalPos.set(level.goal.x, level.goal.y, level.goal.z);
    const localReached = playerPositionRef.current.distanceTo(_goalPos) < GOAL_RADIUS;
    const remoteReached = remotePlayers.some((player) => {
      _remotePos.set(player.position.x, player.position.y, player.position.z);
      return _remotePos.distanceTo(_goalPos) < GOAL_RADIUS;
    });
    if (!localReached || !remoteReached) return;

    advanceLock.current = 1.4;
    const completeAfter = levelIndex >= COOP_ADVENTURE_LEVELS.length - 1;
    const notice = {
      fact: pickFact(levelIndex + level.id),
      levelName: level.name,
      completeAfter,
    };
    if (completeAfter) {
      setFactNotice(notice);
      pendingAdvance.current = {
        at: nowSec + FACT_DISPLAY_SEC,
        completeAfter,
      };
    } else {
      queuedFact.current = notice;
      multiplayerStore.sendCoopAction({
        kind: 'levelAdvance',
        targetId: '',
        levelId: COOP_ADVENTURE_LEVELS[levelIndex + 1]!.id,
        position: {
          x: playerPositionRef.current.x,
          y: playerPositionRef.current.y,
          z: playerPositionRef.current.z,
        },
        velocity: { x: 0, y: 0, z: 0 },
      });
      setLevelIndex((index) =>
        Math.min(COOP_ADVENTURE_LEVELS.length - 1, index + 1),
      );
    }
  });

  return (
    <group>
      <ambientLight color="#b9ddff" intensity={1.35} />
      <hemisphereLight args={['#9ed3ff', '#68a35b', 1.35]} />
      <directionalLight
        color="#fff7df"
        intensity={2.2}
        position={[-28, 56, 34]}
        castShadow
      />
      <CoopClouds platforms={level.platforms} />
      {level.platforms.map((platform) => (
        <CoopPlatform key={platform.id} platform={platform} />
      ))}
      {level.platforms
        .filter((platform) => platform.loveToken)
        .map((platform) => {
          const key = `love-${level.id}-${platform.id}`;
          return (
            <CoopLoveToken
              key={key}
              platform={platform}
              collected={collectedLoveTokens.has(key)}
            />
          );
        })}
      {level.platforms.flatMap((platform, platformIndex) => {
        if (platformIndex === 0) return [];
        const coinCount = platform.kind === 'finish' ? 3 : 2;
        return Array.from({ length: coinCount }, (_, coinIndex) => {
          const key = `coin-${level.id}-${platform.id}-${coinIndex}`;
          return (
            <CoopCoin
              key={key}
              platform={platform}
              index={coinIndex}
              collected={collectedCoins.has(key)}
            />
          );
        });
      })}
      {level.platforms
        .filter((platform) => railSegmentForPlatform(level.platforms, platform.id) !== null)
        .map((platform) => {
          const key = railKey(level.id, platform.id);
          return (
            <CoopRailButton
              key={key}
              platform={platform}
              active={activeRails.some((rail) => rail.key === key)}
            />
          );
        })}
      {activeRails.map((rail) => {
        const targetIndex = level.platforms.findIndex(
          (candidate) => candidate.id === rail.platformId,
        );
        if (targetIndex <= 0) return null;
        const startPlatform = level.platforms[targetIndex - 1]!;
        const endPlatform = level.platforms[targetIndex]!;
        return (
          <CoopSpawnedRail
            key={rail.key}
            startPlatform={startPlatform}
            endPlatform={endPlatform}
          />
        );
      })}
      <group position={[level.goal.x, level.goal.y, level.goal.z]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.15, 0.18, 12, 48]} />
          <meshStandardMaterial
            color="#69f7c8"
            emissive="#31ffb7"
            emissiveIntensity={2.3}
            toneMapped={false}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.75, 0.05, 8, 48]} />
          <meshBasicMaterial color="#d8fff4" transparent opacity={0.42} />
        </mesh>
        <Html center distanceFactor={18} position={[0, 2.8, 0]}>
          <div className="coop-adventure-goal">NEXT</div>
        </Html>
        <Html center distanceFactor={18} position={[0, -2.7, 0]}>
          <div className="coop-finish-stats">
            <strong>{collectedCoins.size}</strong> coins
            <span />
            <strong>{puzzlesSolved}</strong> puzzles
          </div>
        </Html>
      </group>
      <CoopGoalPicture
        position={[level.goal.x, level.goal.y + 6.2, level.goal.z - 6.5]}
      />
      <Html fullscreen>
        <div className="coop-adventure-hud">
          <strong>
            {completed
              ? 'Coop Adventure Complete'
              : `Coop Adventure ${level.id}/${COOP_ADVENTURE_LEVELS.length}: ${level.name}`}
          </strong>
          <span>
            {completed
              ? 'You cleared every sky course. Nice throws.'
              : level.tip}
          </span>
          <em>RMB holds a teammate. LMB throws. E builds a help rail.</em>
        </div>
        {(factNotice ?? tokenFactNotice) && (
          <div className="coop-adventure-fact">
            <strong>
              {(factNotice ?? tokenFactNotice)!.completeAfter
                ? 'Adventure Complete'
                : factNotice
                  ? `${factNotice.levelName} Clear`
                  : 'Love Token'}
            </strong>
            <span>BTS fact</span>
            <p>{(factNotice ?? tokenFactNotice)!.fact}</p>
          </div>
        )}
        {remoteLoveToast && (
          <div className="coop-love-toast coop-love-toast--remote" key={`${remoteLoveToast.from}-${remoteLoveToast.until}`}>
            <span>{remoteLoveToast.from}</span>
            {remoteLoveToast.text}
          </div>
        )}
        {activePuzzle && (
          <form
            className="coop-puzzle-card"
            onPointerDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              submitPuzzleAnswer();
            }}
          >
            <strong>Coin Puzzle</strong>
            <p>{activePuzzle.question}</p>
            <div className="coop-puzzle-row">
              <input
                autoFocus
                value={puzzleInput}
                onChange={(event) => setPuzzleInput(event.target.value)}
                onKeyDown={(event) => event.stopPropagation()}
                aria-label="Puzzle answer"
              />
              <button type="submit">Accept</button>
            </div>
            <span className={`coop-puzzle-status coop-puzzle-status--${activePuzzle.status}`}>
              {activePuzzle.status === 'close'
                ? 'Close - check the spelling.'
                : activePuzzle.status === 'wrong'
                  ? 'Wrong - one more guess.'
                  : activePuzzle.status === 'solved'
                    ? 'Solved.'
                    : activePuzzle.status === 'skipped'
                      ? 'Moving on.'
                      : `${2 - activePuzzle.guesses} guesses left`}
            </span>
          </form>
        )}
      </Html>
    </group>
  );
}
