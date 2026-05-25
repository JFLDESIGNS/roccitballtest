import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { DEBUG_FREELOOK } from '../shared/Constants';
import { getCameraBasis } from './CameraController';
import { gameStore } from './gameStore';
import { inputManager } from './InputManager';

const _lookTarget = new THREE.Vector3();

/** U-key fly camera — pauses match sim; U again to resume playing */
export function DebugFreelook() {
  const active = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().debugFreelook,
  );
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3());
  const wasActive = useRef(false);

  useEffect(() => {
    if (!active) {
      wasActive.current = false;
      return;
    }
    pos.current.copy(camera.position);
    wasActive.current = true;
    try {
      document.exitPointerLock();
    } catch {
      /* ignore */
    }
    gameStore.setPointerLocked(false);
    inputManager.onGameplayResume();
  }, [active]);

  /** Run after Player so third-person camera does not overwrite fly cam */
  useFrame((_, dt) => {
    if (!gameStore.getState().debugFreelook) return;

    if (!wasActive.current) {
      pos.current.copy(camera.position);
      wasActive.current = true;
    }

    const frameDt = dt > 0 ? dt : 1 / 60;
    const rot = inputManager.getRotation();
    const { forward, right } = getCameraBasis(rot.yaw);
    const move = inputManager.getMoveVector();
    const speed =
      DEBUG_FREELOOK.flySpeed *
      (inputManager.isSprint() ? DEBUG_FREELOOK.sprintMult : 1) *
      frameDt;

    if (move.y !== 0) pos.current.addScaledVector(forward, move.y * speed);
    if (move.x !== 0) pos.current.addScaledVector(right, -move.x * speed);

    const vert = inputManager.getFlyVertical();
    if (vert !== 0) pos.current.y += vert * speed;

    camera.position.copy(pos.current);
    const lookDir = inputManager.getLookDirection();
    _lookTarget.copy(pos.current).add(lookDir);
    camera.lookAt(_lookTarget);
    camera.updateMatrixWorld();
  }, 1);

  return null;
}
