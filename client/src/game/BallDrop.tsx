import { useFrame } from '@react-three/fiber';
import {
  CuboidCollider,
  interactionGroups,
  RigidBody,
  TrimeshCollider,
} from '@react-three/rapier';
import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type RefObject,
} from 'react';
import { useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { ARENA, BALL } from '../shared/Constants';
import { gameStore } from './gameStore';
import { RocccitLogoStamp } from './RocccitLogoStamp';
import {
  bufferGeometryToTrimesh,
  buildFacetedDrumWallGeometry,
  buildRadialDropSlice,
  drumFaceAngles,
} from './ballDropDrum';
import { BallDropSquareLights } from './BallDropSquareLights';
import { BallDropSpotlightCones } from './BallDropSpotlightCones';
import { triggerKickoffBallRelease } from './kickoffDrop';

const FRAME = '#141a28';
const DRUM = '#0c1018';
const TILT = (ARENA.ballDropScreenTiltDeg * Math.PI) / 180;
const DOOR_COUNT = ARENA.ballDropDoorCount;
const FT = 0.3048;
const DRUM_SCALE = ARENA.ballDropDrumScale;
const SCREEN_FACE_OFFSET = ARENA.ballDropScreenFaceOffsetFt * FT + 0.12;
const SCREEN_LOWER_Y = -ARENA.ballDropScreenLowerFt * FT;

const HOLD_SEC = ARENA.ballDropFlapHoldSec;
const OPEN_SEC = ARENA.ballDropFlapOpenSec;
const CLOSE_SEC = ARENA.ballDropFlapCloseSec;

const SLICE_CLOSED = new THREE.Color('#06080c');
const SLICE_OPEN = new THREE.Color('#141820');
const SLICE_BASE = new THREE.Color('#080a0e');

/** Ball-drop colliders — group 4; never collide with ball (group 1) */
const DROP_COLLISION = interactionGroups(4, [0, 1]);
const DROP_FRICTION = 0.4;
const DROP_RESTITUTION = BALL.restitution * 0.5;

const drumMat = new THREE.MeshStandardMaterial({
  color: DRUM,
  emissive: '#111a2a',
  emissiveIntensity: 0.25,
  metalness: 0.7,
  roughness: 0.35,
  flatShading: true,
  side: THREE.DoubleSide,
});

const _swingQuat = new THREE.Quaternion();

type FlapPhase = 'idle' | 'hold' | 'opening' | 'closing' | 'done';

const DoorOpenRefContext = createContext<RefObject<number> | null>(null);

function BottomDropSlice({
  index,
  radius,
  bottomY,
}: {
  index: number;
  radius: number;
  bottomY: number;
}) {
  const doorOpenRef = useContext(DoorOpenRefContext);
  const swingRef = useRef<THREE.Group>(null);
  const { a0, a1 } = drumFaceAngles(index, DOOR_COUNT);

  const slice = useMemo(
    () => buildRadialDropSlice(a0, a1, radius),
    [a0, a1, radius],
  );

  const { vertices, indices } = useMemo(
    () => bufferGeometryToTrimesh(slice.geometry),
    [slice.geometry],
  );

  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: SLICE_BASE,
        emissive: SLICE_CLOSED.clone(),
        emissiveIntensity: 0.12,
        metalness: 0.45,
        roughness: 0.4,
        flatShading: true,
        side: THREE.DoubleSide,
      }),
    [],
  );

  useFrame(() => {
    const openT = doorOpenRef?.current ?? 0;
    if (swingRef.current) {
      _swingQuat.setFromAxisAngle(slice.chordAxis, openT * (Math.PI / 2));
      swingRef.current.quaternion.copy(_swingQuat);
    }
    mat.emissive.copy(SLICE_CLOSED).lerp(SLICE_OPEN, openT * 0.4);
    mat.emissiveIntensity = 0.1 + openT * 0.22;
    mat.color.copy(SLICE_BASE);
  });

  return (
    <group position={[0, bottomY, 0]}>
      <group ref={swingRef} position={[slice.mx, 0, slice.mz]}>
        <RigidBody
          type="fixed"
          colliders={false}
          friction={DROP_FRICTION}
          restitution={DROP_RESTITUTION}
        >
          <TrimeshCollider
            args={[vertices, indices]}
            friction={DROP_FRICTION}
            restitution={DROP_RESTITUTION}
            collisionGroups={DROP_COLLISION}
          />
          <mesh
            geometry={slice.geometry}
            material={mat}
            castShadow
            receiveShadow
          />
        </RigidBody>
      </group>
    </group>
  );
}

/** Cube jumbotron kickoff tower with hinged bottom slices */
export function BallDrop() {
  const cubeHalf = ARENA.ballDropCubeSize * 0.5;
  const screenW = ARENA.ballDropScreenWidthM;
  const screenH = ARENA.ballDropScreenHeightM;
  const drumR = ARENA.ballDropDrumRadius * DRUM_SCALE;
  const drumH = ARENA.ballDropDrumHeight * DRUM_SCALE;

  const cubeBottomLocal = -cubeHalf;
  const drumCenterLocal = cubeBottomLocal - drumH * 0.5;
  const drumBottomLocal = cubeBottomLocal - drumH;
  const logoPadW = screenW * 0.72;
  const logoPadH = screenH * 0.72;

  const drumWallGeometry = useMemo(
    () => buildFacetedDrumWallGeometry(drumR, drumH, DOOR_COUNT),
    [drumR, drumH],
  );
  const drumTrimesh = useMemo(
    () => bufferGeometryToTrimesh(drumWallGeometry),
    [drumWallGeometry],
  );
  const drumMaterial = useMemo(() => drumMat.clone(), []);

  const phase = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().phase,
  );
  const countdown = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().countdown,
  );

  const doorOpenRef = useRef(0);
  const flapPhase = useRef<FlapPhase>('idle');
  const phaseTimer = useRef(0);
  const inCountdown = useRef(false);
  const ballReleased = useRef(false);

  useFrame((_, dt) => {
    const kickoff = phase === 'playing' && countdown > 0;

    if (kickoff) {
      inCountdown.current = true;
      flapPhase.current = 'idle';
      phaseTimer.current = 0;
      doorOpenRef.current = 0;
      ballReleased.current = false;
      return;
    }

    if (inCountdown.current) {
      inCountdown.current = false;
      flapPhase.current = HOLD_SEC > 0 ? 'hold' : 'opening';
      phaseTimer.current = HOLD_SEC;
      doorOpenRef.current = 0;
      ballReleased.current = false;
    }

    switch (flapPhase.current) {
      case 'hold':
        doorOpenRef.current = 0;
        phaseTimer.current -= dt;
        if (phaseTimer.current <= 0) {
          flapPhase.current = 'opening';
          phaseTimer.current = 0;
        }
        break;
      case 'opening': {
        phaseTimer.current += dt;
        doorOpenRef.current = Math.min(1, phaseTimer.current / OPEN_SEC);
        if (doorOpenRef.current >= 1 && !ballReleased.current) {
          ballReleased.current = true;
          triggerKickoffBallRelease();
          flapPhase.current = 'closing';
          phaseTimer.current = 0;
        }
        break;
      }
      case 'closing':
        phaseTimer.current += dt;
        doorOpenRef.current = Math.max(0, 1 - phaseTimer.current / CLOSE_SEC);
        if (doorOpenRef.current <= 0) {
          flapPhase.current = 'done';
        }
        break;
      case 'idle':
      case 'done':
        doorOpenRef.current = 0;
        break;
      default:
        break;
    }
  });

  const screenYaw = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  const screenOffset = cubeHalf + SCREEN_FACE_OFFSET;

  return (
    <DoorOpenRefContext.Provider value={doorOpenRef}>
      <group position={[0, ARENA.ballDropCenterY, 0]}>
        <RigidBody
          type="fixed"
          colliders={false}
          friction={DROP_FRICTION}
          restitution={DROP_RESTITUTION}
        >
          <CuboidCollider
            args={[cubeHalf, cubeHalf, cubeHalf]}
            friction={DROP_FRICTION}
            restitution={DROP_RESTITUTION}
            collisionGroups={DROP_COLLISION}
          />

          <group position={[0, drumCenterLocal, 0]}>
            <TrimeshCollider
              args={[drumTrimesh.vertices, drumTrimesh.indices]}
              friction={DROP_FRICTION}
              restitution={DROP_RESTITUTION}
              collisionGroups={DROP_COLLISION}
            />
          </group>

          {screenYaw.map((yaw, i) => (
            <group
              key={`screen-col-${i}`}
              position={[
                Math.sin(yaw) * screenOffset,
                SCREEN_LOWER_Y,
                Math.cos(yaw) * screenOffset,
              ]}
              rotation={[0, yaw, 0]}
            >
              <group rotation={[TILT, 0, 0]} position={[0, 0, 0.22]}>
                <CuboidCollider
                  args={[screenW * 0.5, screenH * 0.5, 0.06]}
                  position={[0, 0, -0.04]}
                  friction={DROP_FRICTION}
                  restitution={DROP_RESTITUTION}
                  collisionGroups={DROP_COLLISION}
                />
                <CuboidCollider
                  args={[logoPadW * 0.5, logoPadH * 0.5, 0.04]}
                  position={[0, 0, 0.06]}
                  friction={DROP_FRICTION}
                  restitution={DROP_RESTITUTION}
                  collisionGroups={DROP_COLLISION}
                />
              </group>
            </group>
          ))}

          <BallDropSquareLights cubeHalf={cubeHalf} withColliders />
          <BallDropSpotlightCones cubeHalf={cubeHalf} />

          <mesh position={[0, 0, 0]}>
            <boxGeometry
              args={[
                ARENA.ballDropCubeSize,
                ARENA.ballDropCubeSize,
                ARENA.ballDropCubeSize,
              ]}
            />
            <meshStandardMaterial
              color={FRAME}
              emissive="#1a2238"
              emissiveIntensity={0.4}
              metalness={0.65}
              roughness={0.32}
            />
          </mesh>

          <mesh
            position={[0, drumCenterLocal, 0]}
            geometry={drumWallGeometry}
            material={drumMaterial}
          />
        </RigidBody>

        {screenYaw.map((yaw, i) => (
          <group
            key={`screen-${i}`}
            position={[
              Math.sin(yaw) * screenOffset,
              SCREEN_LOWER_Y,
              Math.cos(yaw) * screenOffset,
            ]}
            rotation={[0, yaw, 0]}
          >
            <group rotation={[TILT, 0, 0]} position={[0, 0, 0.22]}>
              <mesh position={[0, 0, -0.04]}>
                <boxGeometry args={[screenW, screenH, 0.1]} />
                <meshStandardMaterial
                  color="#080c14"
                  metalness={0.5}
                  roughness={0.4}
                />
              </mesh>
              <group position={[0, 0, 0.06]}>
                <RocccitLogoStamp
                  size={Math.min(logoPadW, logoPadH)}
                  maxWidth={logoPadW}
                  maxHeight={logoPadH}
                />
              </group>
            </group>
          </group>
        ))}

        {Array.from({ length: DOOR_COUNT }, (_, i) => (
          <BottomDropSlice
            key={`slice-${i}`}
            index={i}
            radius={drumR}
            bottomY={drumBottomLocal}
          />
        ))}

        <pointLight
          position={[0, cubeHalf * 0.45, 0]}
          color="#b8e8ff"
          intensity={85}
          distance={48}
          decay={1.6}
        />
        <pointLight
          position={[0, 0, cubeHalf * 0.6]}
          color="#a8ddff"
          intensity={55}
          distance={40}
          decay={1.8}
        />
      </group>
    </DoorOpenRefContext.Provider>
  );
}
