import {
  CuboidCollider,
  CylinderCollider,
  interactionGroups,
  RigidBody,
} from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ARENA, ARENA_PADS, BALL } from '../shared/Constants';
import type { WallMount, FloorPad } from './arenaPadLayout';
import { getBillboardMounts, getBounceTrampolinePads } from './arenaPadLayout';
import { RocccitLogoStamp } from './RocccitLogoStamp';
import {
  arenaPadStoneMaterial,
  arenaJumpPadTopMaterial,
} from './arenaMaterials';
import { jumpPadEmissiveIntensity } from './jumpPadGlow';
import { billboardShakeKey, getVisualShake } from './visualShake';

const BILLBOARD_FRAME = '#08090c';
const BILLBOARD_SCREEN = '#0a1520';
const ENV_COLLISION = interactionGroups(2, [0, 1, 2]);
const BILLBOARD_FRICTION = 0.35;
const BILLBOARD_RESTITUTION = BALL.restitution * 0.45;

function BillboardPanel({ mount }: { mount: WallMount }) {
  const w = ARENA_PADS.billboardWidthM;
  const h = ARENA_PADS.billboardHeightM;
  const logoSize = Math.min(w, h) * 0.8;
  const frameDepth = 0.14;
  const screenW = w * 0.94;
  const screenH = h * 0.94;
  const visualRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const visual = visualRef.current;
    if (!visual) return;
    const { tiltX, tiltY, tiltZ } = getVisualShake(
      billboardShakeKey(mount.x, mount.y, mount.z),
      mount.x + mount.z,
    );
    visual.rotation.set(tiltX, tiltY, tiltZ);
  });

  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={[mount.x, mount.y, mount.z]}
      rotation={[0, mount.yaw, 0]}
      friction={BILLBOARD_FRICTION}
      restitution={BILLBOARD_RESTITUTION}
    >
      <CuboidCollider
        args={[(w + 0.35) * 0.5, (h + 0.35) * 0.5, frameDepth * 0.5]}
        position={[0, 0, -frameDepth * 0.5]}
        friction={BILLBOARD_FRICTION}
        restitution={BILLBOARD_RESTITUTION}
        collisionGroups={ENV_COLLISION}
      />
      <CuboidCollider
        args={[screenW * 0.5, screenH * 0.5, 0.05]}
        position={[0, 0, frameDepth * 0.5 + 0.1]}
        friction={BILLBOARD_FRICTION}
        restitution={BILLBOARD_RESTITUTION}
        collisionGroups={ENV_COLLISION}
      />
      <CuboidCollider
        args={[screenW * 0.44, screenH * 0.44, 0.03]}
        position={[0, 0, frameDepth * 0.5 + 0.12]}
        friction={BILLBOARD_FRICTION}
        restitution={BILLBOARD_RESTITUTION}
        collisionGroups={ENV_COLLISION}
      />

      <group ref={visualRef}>
        <mesh position={[0, 0, -frameDepth * 0.5]}>
          <boxGeometry args={[w + 0.35, h + 0.35, frameDepth]} />
          <meshStandardMaterial
            color={BILLBOARD_FRAME}
            metalness={0.02}
            roughness={0.96}
          />
        </mesh>
        <group position={[0, 0, frameDepth * 0.5 + 0.1]}>
          <mesh>
            <planeGeometry args={[screenW, screenH]} />
            <meshStandardMaterial
              color={BILLBOARD_SCREEN}
              emissive="#0a1824"
              emissiveIntensity={0.22}
              metalness={0.04}
              roughness={0.88}
              toneMapped={true}
            />
          </mesh>
          <pointLight
            position={[0, 0, 0.85]}
            color="#335566"
            intensity={6}
            distance={h * 1.1}
            decay={2}
          />
          <group position={[0, 0, 0.02]}>
            <RocccitLogoStamp
              size={logoSize}
              maxWidth={screenW * 0.88}
              maxHeight={screenH * 0.88}
            />
          </group>
        </group>
      </group>
    </RigidBody>
  );
}

function BounceTrampolineMesh({ pad }: { pad: FloorPad }) {
  const deckMat = useMemo(
    () => arenaJumpPadTopMaterial.clone(),
    [],
  );
  useFrame(() => {
    deckMat.emissiveIntensity = jumpPadEmissiveIntensity(pad);
  });

  const deckH = ARENA_PADS.bouncePadHeightM;
  const r = pad.radius;
  const stoneTopY = pad.platformTopY;
  const floorY = ARENA.floorY;
  const stemH = stoneTopY - floorY;
  const stemCenterY = floorY + stemH * 0.5;
  const stemTopR = r * 1.15;
  const stemBotR = r * 1.22;
  const colliderHalfH = stemH * 0.5;
  const colliderCenterY = floorY + colliderHalfH;
  const colliderR = stemTopR * 1.05;

  return (
    <group position={[pad.x, 0, pad.z]}>
      <mesh
        position={[0, stemCenterY, 0]}
        receiveShadow
        castShadow={false}
        material={arenaPadStoneMaterial}
      >
        <cylinderGeometry args={[stemTopR, stemBotR, stemH, 8]} />
      </mesh>
      <RigidBody
        type="fixed"
        colliders={false}
        position={[0, colliderCenterY, 0]}
        friction={0.55}
        restitution={0.35}
      >
        <CylinderCollider
          args={[colliderHalfH, colliderR]}
          friction={0.55}
          restitution={0.35}
          collisionGroups={interactionGroups(2, [0, 1, 2])}
        />
      </RigidBody>
      <mesh
        position={[0, stoneTopY + deckH * 0.5, 0]}
        castShadow
        receiveShadow
        material={deckMat}
      >
        <cylinderGeometry args={[r, r, deckH, 32]} />
      </mesh>
    </group>
  );
}

export function ArenaInteractables() {
  const billboards = useMemo(() => getBillboardMounts(), []);
  const trampolines = useMemo(() => getBounceTrampolinePads(), []);

  return (
    <>
      {billboards.map((mount, i) => (
        <BillboardPanel key={`billboard-${i}`} mount={mount} />
      ))}
      {trampolines.map((pad, i) => (
        <BounceTrampolineMesh key={`trampoline-${i}`} pad={pad} />
      ))}
    </>
  );
}
