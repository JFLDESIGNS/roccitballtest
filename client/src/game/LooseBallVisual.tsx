import { useFrame } from '@react-three/fiber';
import { useRef, useSyncExternalStore } from 'react';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { BALL } from '../shared/Constants';
import { getBallMaxSpeed } from './ballRuntime';
import { BallOutlineRing } from './BallOutlineRing';
import { EightBallVisual } from './EightBallVisual';
import { getPremium8Ball, subscribePremium8Ball } from './premiumBall';
import {
  getHeldBallReleaseBlend,
  heldBallVisualBridge,
  smoothstep01,
} from './heldBallVisualBridge';
import { gameStore, type BallHolderId } from './gameStore';
import { tuningStore } from './tuningStore';

type LooseBallVisualProps = {
  bodyRef: React.RefObject<RapierRigidBody | null>;
  hidden: boolean;
  surfaceMap: THREE.Texture;
  matRef?: React.RefObject<THREE.MeshStandardMaterial | null>;
  meshRef?: React.RefObject<THREE.Group | null>;
};

const _targetPos = new THREE.Vector3();
const _targetQuat = new THREE.Quaternion();
const _filteredPos = new THREE.Vector3();
const _displayPos = new THREE.Vector3();
const _displayQuat = new THREE.Quaternion();
const _followPos = new THREE.Vector3();

function isBotHolder(holderId: BallHolderId): boolean {
  return holderId !== null && holderId !== 'local';
}

/**
 * Display-only mesh: follows physics pose with optional position filtering.
 * Does not simulate or drive the rigid body.
 */
export function LooseBallVisual({
  bodyRef,
  hidden,
  surfaceMap,
  matRef,
  meshRef: meshRefProp,
}: LooseBallVisualProps) {
  const internalGroupRef = useRef<THREE.Group>(null);
  const meshRef = meshRefProp ?? internalGroupRef;
  const premium8Ball = useSyncExternalStore(
    subscribePremium8Ball,
    getPremium8Ball,
  );
  const displayReadyRef = useRef(false);
  const wasLocalHeldHiddenRef = useRef(true);

  const posSmooth = useSyncExternalStore(
    tuningStore.subscribe,
    () => tuningStore.getState().looseVisualPosSmooth,
  );
  const targetSmooth = useSyncExternalStore(
    tuningStore.subscribe,
    () => tuningStore.getState().looseVisualTargetSmooth,
  );
  const rotSmooth = useSyncExternalStore(
    tuningStore.subscribe,
    () => tuningStore.getState().looseVisualRotSmooth,
  );
  const maxLagM = useSyncExternalStore(
    tuningStore.subscribe,
    () => tuningStore.getState().looseVisualMaxLagM,
  );
  const speedBoostMax = useSyncExternalStore(
    tuningStore.subscribe,
    () => tuningStore.getState().looseVisualSpeedBoostMax,
  );

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dtClamped = Math.min(Math.max(dt, 1 / 240), 0.05);

    if (hidden) {
      mesh.visible = false;
      wasLocalHeldHiddenRef.current = true;
      return;
    }

    if (wasLocalHeldHiddenRef.current) {
      displayReadyRef.current = false;
      wasLocalHeldHiddenRef.current = false;
    }

    const body = bodyRef.current;
    if (!body) {
      mesh.visible = false;
      return;
    }

    const t = body.translation();
    const r = body.rotation();
    _targetPos.set(t.x, t.y, t.z);
    _targetQuat.set(r.x, r.y, r.z, r.w);

    const release = heldBallVisualBridge.release;
    if (release.active) {
      const blend = getHeldBallReleaseBlend(performance.now() / 1000);
      const ease = smoothstep01(blend);
      if (!displayReadyRef.current) {
        _displayPos.copy(release.from);
        _filteredPos.copy(release.from);
        _displayQuat.copy(release.fromQuat);
        displayReadyRef.current = true;
      }
      _displayPos.lerpVectors(release.from, _targetPos, ease);
      _filteredPos.copy(_displayPos);
      _displayQuat.copy(release.fromQuat).slerp(_targetQuat, ease);
      mesh.position.copy(_displayPos);
      mesh.quaternion.copy(_displayQuat);
      mesh.visible = true;
      return;
    }

    const holderId = gameStore.getState().ballHolderId;
    const botHeld = isBotHolder(holderId);

    const targetAlpha = 1 - Math.exp(-targetSmooth * dtClamped);
    if (!displayReadyRef.current) {
      _filteredPos.copy(_targetPos);
      _displayPos.copy(_targetPos);
      _displayQuat.copy(_targetQuat);
      displayReadyRef.current = true;
    } else if (_displayPos.distanceTo(_targetPos) > maxLagM * 4) {
      _filteredPos.copy(_targetPos);
      _displayPos.copy(_targetPos);
      _displayQuat.copy(_targetQuat);
    } else {
      _filteredPos.lerp(_targetPos, targetAlpha);
    }

    if (botHeld) {
      const carryAlpha = 1 - Math.exp(-72 * dtClamped);
      _displayPos.lerp(_filteredPos, carryAlpha);
      const rotAlpha = 1 - Math.exp(-80 * dtClamped);
      _displayQuat.slerp(_targetQuat, rotAlpha);
    } else {
      const linvel = body.linvel();
      const speed = Math.hypot(linvel.x, linvel.y, linvel.z);
      const speedCap = getBallMaxSpeed();
      const speedBoost =
        1 +
        THREE.MathUtils.clamp(speed / (speedCap * 0.155), 0, speedBoostMax);
      let posAlpha = 1 - Math.exp(-posSmooth * speedBoost * dtClamped);
      const lagToFiltered = _displayPos.distanceTo(_filteredPos);
      const lagToPhysics = _displayPos.distanceTo(_targetPos);
      if (lagToFiltered > maxLagM || lagToPhysics > maxLagM * 1.15) {
        const overflow =
          Math.max(lagToFiltered, lagToPhysics * 0.92) / Math.max(maxLagM, 1e-4);
        const catchT = THREE.MathUtils.clamp((overflow - 1) * 0.35, 0, 0.72);
        _followPos.lerpVectors(_filteredPos, _targetPos, catchT);
      } else {
        _followPos.copy(_filteredPos);
      }
      _displayPos.lerp(_followPos, posAlpha);
      const rotAlpha = 1 - Math.exp(-rotSmooth * dtClamped);
      _displayQuat.slerp(_targetQuat, rotAlpha);
    }

    mesh.position.copy(_displayPos);
    mesh.quaternion.copy(_displayQuat);
    mesh.visible = true;
  }, -1);

  return (
    <group ref={meshRef} visible={false} frustumCulled={false}>
      {premium8Ball ? (
        <EightBallVisual />
      ) : (
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[BALL.radius, 16, 14]} />
          <meshStandardMaterial
            ref={matRef}
            map={surfaceMap}
            color="#c8d8ec"
            emissive="#5ec8ff"
            emissiveIntensity={0.22}
            metalness={0.52}
            roughness={0.32}
          />
        </mesh>
      )}
      <BallOutlineRing />
    </group>
  );
}
