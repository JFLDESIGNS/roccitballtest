import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { BALL, RENDER } from '../shared/Constants';
import { BallOutlineRing } from './BallOutlineRing';
import { EightBallVisual } from './EightBallVisual';
import { applyEightBallAuraGlow } from './eightBallAuraMaterial';
import { createBallPolkaTexture } from './ballPolkaTexture';
import { getPremium8Ball, subscribePremium8Ball } from './premiumBall';
import { gameStore } from './gameStore';
import { tuningStore } from './tuningStore';
import { isHoldImmunityActive } from './ballHoldImmunity';
import { heldBallVisualBridge } from './heldBallVisualBridge';
import type { Team } from '../shared/Types';

type LocalHeldBallVisualProps = {
  socketRef: React.RefObject<THREE.Vector3>;
  chestRef: React.RefObject<THREE.Vector3>;
};

const _visualTarget = new THREE.Vector3();
const _reachDir = new THREE.Vector3();

function holderGlowTeam(localTeam: Team): Team {
  return localTeam;
}

/** Smooth carry proxy — decoupled from jittery kinematic physics body */
export function LocalHeldBallVisual({
  socketRef,
  chestRef,
}: LocalHeldBallVisualProps) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const premium8Ball = useSyncExternalStore(
    subscribePremium8Ball,
    getPremium8Ball,
  );
  const displayPos = useRef(new THREE.Vector3());
  const displayQuat = useRef(new THREE.Quaternion());
  const displayReady = useRef(false);

  const isLocalHeld = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().ballHolderId === 'local',
  );
  const localTeam = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().localTeam,
  );
  const holdExtraReach = useSyncExternalStore(
    tuningStore.subscribe,
    () => tuningStore.getState().holdVisualExtraReachM,
  );
  const holdLagSmooth = useSyncExternalStore(
    tuningStore.subscribe,
    () => tuningStore.getState().holdVisualLagSmooth,
  );

  const surfaceMap = useMemo(
    () => createBallPolkaTexture(RENDER.ballPolkaTextureSize, 'original'),
    [],
  );

  useEffect(() => () => surfaceMap.dispose(), [surfaceMap]);

  useFrame(({ clock }, dt) => {
    const mesh = groupRef.current;
    if (!mesh) return;
    const mat = matRef.current;

    const releasing = heldBallVisualBridge.release.active;
    if (!isLocalHeld || releasing) {
      mesh.visible = false;
      displayReady.current = false;
      return;
    }

    const socket = socketRef.current;
    const chest = chestRef.current;
    if (!socket || !chest) {
      mesh.visible = false;
      return;
    }

    _reachDir.subVectors(socket, chest);
    const reachLen = _reachDir.length();
    if (reachLen > 1e-4) {
      _reachDir.multiplyScalar(1 / reachLen);
      _visualTarget
        .copy(socket)
        .addScaledVector(_reachDir, holdExtraReach);
    } else {
      _visualTarget.copy(socket);
    }

    const alpha =
      1 - Math.exp(-holdLagSmooth * Math.max(dt, 1 / 120));

    if (!displayReady.current) {
      displayPos.current.copy(heldBallVisualBridge.smoothPos);
      displayQuat.current.copy(heldBallVisualBridge.carryQuat);
      displayReady.current = true;
    } else {
      displayPos.current.lerp(_visualTarget, alpha);
    }

    heldBallVisualBridge.smoothPos.copy(displayPos.current);
    heldBallVisualBridge.carryQuat.copy(displayQuat.current);
    mesh.position.copy(displayPos.current);
    mesh.quaternion.copy(displayQuat.current);
    mesh.visible = true;

    if (mat) {
      const t = clock.getElapsedTime();
      const immune = isHoldImmunityActive();
      const pulse = immune
        ? 1.18 + Math.sin(t * 7) * 0.24
        : 0.78 + Math.sin(t * 5) * 0.18;
      mat.emissiveIntensity = pulse;
      const ht = holderGlowTeam(localTeam);
      if (ht === 'red') mat.emissive.set(immune ? '#ff8877' : '#ff5544');
      else mat.emissive.set(immune ? '#88ccff' : '#55aaff');
    } else if (premium8Ball) {
      const t = clock.getElapsedTime();
      const immune = isHoldImmunityActive();
      const pulse = immune
        ? 1.18 + Math.sin(t * 7) * 0.24
        : 0.78 + Math.sin(t * 5) * 0.18;
      applyEightBallAuraGlow(mesh, {
        held: true,
        holderTeam: holderGlowTeam(localTeam),
        immunity: immune,
        pulse,
        beamContested: false,
        beamColor: new THREE.Color(0xffffff),
      });
    }
  });

  return (
    <group ref={groupRef} visible={false} frustumCulled={false}>
      {premium8Ball ? (
        <EightBallVisual />
      ) : (
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[BALL.radius, 14, 12]} />
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
