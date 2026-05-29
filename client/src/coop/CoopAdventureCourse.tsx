import { Html } from '@react-three/drei';
import { CuboidCollider, interactionGroups, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import pictureEndUrl from '../assets/images/ui/pictureend.png';
import { inputManager } from '../game/InputManager';
import { multiplayerStore } from '../multiplayer/multiplayerStore';
import { COOP_ADVENTURE_LEVELS, type CoopAdventurePlatform } from './coopAdventureLevels';
import { BTS_FACTS } from './btsFacts';

const PLATFORM_COLLISION = interactionGroups(2, [0, 1, 2]);
const FALL_RESCUE_Y = -28;
const GOAL_RADIUS = 4.4;
const RAIL_BUTTON_RADIUS = 4.2;
const RAIL_BUTTON_VERTICAL_RADIUS = 4.6;
const FACT_DISPLAY_SEC = 6;

const _goalPos = new THREE.Vector3();
const _remotePos = new THREE.Vector3();
const _spawnPos = new THREE.Vector3();
const _buttonPos = new THREE.Vector3();
const _railStart = new THREE.Vector3();
const _railEnd = new THREE.Vector3();

type CloudSpec = {
  position: [number, number, number];
  scale: [number, number, number];
};

type ActiveRail = {
  key: string;
  platformId: string;
};

type FactNotice = {
  fact: string;
  levelName: string;
  completeAfter: boolean;
};

const COURSE_CLOUDS: CloudSpec[] = [
  { position: [-38, 20, 12], scale: [12, 5, 8] },
  { position: [-50, 27, -28], scale: [18, 6, 10] },
  { position: [42, 23, -8], scale: [14, 5, 9] },
  { position: [55, 32, -54], scale: [20, 7, 11] },
  { position: [-36, 42, -76], scale: [16, 6, 10] },
  { position: [34, 48, -92], scale: [15, 5, 9] },
  { position: [0, 52, -116], scale: [22, 7, 12] },
  { position: [-62, 16, 58], scale: [17, 6, 10] },
  { position: [64, 18, 52], scale: [18, 6, 10] },
];

function playerSpawnForLevel(levelIndex: number, teamSlot: number): THREE.Vector3 {
  const level = COOP_ADVENTURE_LEVELS[levelIndex]!;
  const side = teamSlot % 2 === 0 ? -1 : 1;
  return _spawnPos.set(
    level.spawn.x + side * 2.7,
    level.spawn.y,
    level.spawn.z + (teamSlot > 1 ? -2.4 : 0),
  );
}

function CoopClouds() {
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
      {COURSE_CLOUDS.map((cloud, i) => (
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

function CoopPlatform({ platform }: { platform: CoopAdventurePlatform }) {
  const topY = platform.position.y + platform.size.y * 0.5 + 0.035;
  const trimColor =
    platform.kind === 'finish'
      ? '#6fffd2'
      : platform.kind === 'start'
        ? '#74bbff'
        : '#d8f08a';

  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider
        args={[platform.size.x / 2, platform.size.y / 2, platform.size.z / 2]}
        position={[platform.position.x, platform.position.y, platform.position.z]}
        collisionGroups={PLATFORM_COLLISION}
        friction={1}
        restitution={0.03}
      />
      <group position={[platform.position.x, platform.position.y, platform.position.z]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[platform.size.x, platform.size.y, platform.size.z]} />
          <meshStandardMaterial
            color={platform.side}
            roughness={0.75}
            metalness={0}
          />
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
        <mesh position={[0, platform.size.y * 0.5 + 0.13, 0]}>
          <boxGeometry args={[platform.size.x + 0.38, 0.08, 0.28]} />
          <meshStandardMaterial
            color={trimColor}
            emissive={trimColor}
            emissiveIntensity={platform.kind === 'finish' ? 1.1 : 0.25}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, platform.size.y * 0.5 + 0.14, 0]}>
          <boxGeometry args={[0.28, 0.08, platform.size.z + 0.38]} />
          <meshStandardMaterial
            color={trimColor}
            emissive={trimColor}
            emissiveIntensity={platform.kind === 'finish' ? 1.1 : 0.25}
            toneMapped={false}
          />
        </mesh>
      </group>
      {platform.kind === 'finish' && (
        <pointLight
          color="#63ffd0"
          intensity={2.2}
          distance={18}
          position={[platform.position.x, topY + 2, platform.position.z]}
        />
      )}
    </RigidBody>
  );
}

function platformTopY(platform: CoopAdventurePlatform): number {
  return platform.position.y + platform.size.y * 0.5;
}

function railButtonPosition(platform: CoopAdventurePlatform): THREE.Vector3 {
  return _buttonPos.set(
    platform.position.x,
    platformTopY(platform) + 0.42,
    platform.position.z + platform.size.z * 0.28,
  );
}

function railEndpoint(platform: CoopAdventurePlatform): THREE.Vector3 {
  return new THREE.Vector3(
    platform.position.x,
    platformTopY(platform) + 1.08,
    platform.position.z,
  );
}

function railKey(levelId: number, platformId: string): string {
  return `coop-rail-${levelId}-${platformId}`;
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
  start,
  end,
}: {
  start: THREE.Vector3;
  end: THREE.Vector3;
}) {
  const points = useMemo(
    () => [
      start.clone(),
      start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 1.35, 0)),
      end.clone(),
    ],
    [start, end],
  );
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    return new THREE.TubeGeometry(curve, 48, 0.26, 14, false);
  }, [points]);
  const colliderPoints = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const length = start.distanceTo(end);
    const count = Math.max(8, Math.ceil(length / 2.1));
    return Array.from({ length: count }, (_, i) =>
      curve.getPoint(count <= 1 ? 0 : i / (count - 1)),
    );
  }, [end, points, start]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial
          color="#07090d"
          emissive="#0d635c"
          emissiveIntensity={0.22}
          metalness={0.42}
          roughness={0.24}
        />
      </mesh>
      {colliderPoints.map((point, i) => (
        <RigidBody key={i} type="fixed" colliders={false}>
          <CuboidCollider
            args={[0.82, 0.16, 0.58]}
            position={[point.x, point.y, point.z]}
            collisionGroups={PLATFORM_COLLISION}
            friction={1}
            restitution={0.02}
          />
        </RigidBody>
      ))}
    </group>
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

  useFrame(() => {
    if (!ref.current) return;
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
  const advanceLock = useRef(0);
  const pendingAdvance = useRef<{
    at: number;
    completeAfter: boolean;
  } | null>(null);
  const teleportedLevel = useRef(-1);
  const level = COOP_ADVENTURE_LEVELS[levelIndex]!;
  const remotePlayers = useSyncExternalStore(
    multiplayerStore.subscribe,
    () => multiplayerStore.getState().remotePlayers,
  );
  const teamSlot = useSyncExternalStore(
    multiplayerStore.subscribe,
    () => multiplayerStore.getState().teamSlot,
  );

  useEffect(() => {
    teleportedLevel.current = -1;
    pendingAdvance.current = null;
    setFactNotice(null);
    setActiveRails([]);
  }, [levelIndex, teamSlot]);

  useFrame((_, dt) => {
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
    if (pending && pending.at <= performance.now() / 1000) {
      pendingAdvance.current = null;
      setFactNotice(null);
      if (pending.completeAfter || levelIndex >= COOP_ADVENTURE_LEVELS.length - 1) {
        setCompleted(true);
      } else {
        setLevelIndex((index) =>
          Math.min(COOP_ADVENTURE_LEVELS.length - 1, index + 1),
        );
      }
      return;
    }

    if (inputManager.consumeInteract() && !completed) {
      const nearest = level.platforms.find((platform) => {
        if (platform.kind === 'start') return false;
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
    if (!localReached && !remoteReached) return;

    advanceLock.current = 1.4;
    const completeAfter = levelIndex >= COOP_ADVENTURE_LEVELS.length - 1;
    const factIndex = (levelIndex * 3) % BTS_FACTS.length;
    setFactNotice({
      fact: BTS_FACTS[factIndex]!,
      levelName: level.name,
      completeAfter,
    });
    pendingAdvance.current = {
      at: performance.now() / 1000 + FACT_DISPLAY_SEC,
      completeAfter,
    };
  });

  const railStartPlatform = level.platforms[0]!;

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
      <CoopClouds />
      {level.platforms.map((platform) => (
        <CoopPlatform key={platform.id} platform={platform} />
      ))}
      {level.platforms
        .filter((platform) => platform.kind !== 'start')
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
        const platform = level.platforms.find((candidate) => candidate.id === rail.platformId);
        if (!platform) return null;
        _railStart.copy(railEndpoint(railStartPlatform));
        _railEnd.copy(railEndpoint(platform));
        return (
          <CoopSpawnedRail
            key={rail.key}
            start={_railStart.clone()}
            end={_railEnd.clone()}
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
          <em>RMB attracts a teammate in this mode. Release to throw.</em>
        </div>
        {factNotice && (
          <div className="coop-adventure-fact">
            <strong>
              {factNotice.completeAfter ? 'Adventure Complete' : `${factNotice.levelName} Clear`}
            </strong>
            <span>BTS fact</span>
            <p>{factNotice.fact}</p>
          </div>
        )}
      </Html>
    </group>
  );
}
