import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { DEBUG_FREELOOK } from '../shared/Constants';
import { getCameraBasis, writeLookDirection } from './CameraController';
import { gameStore } from './gameStore';
import { inputManager } from './InputManager';
import { stadiumLightStore } from './stadiumLightStore';

const _worldUp = new THREE.Vector3(0, 1, 0);
const _flyRight = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _lookDir = new THREE.Vector3();

/** U-key fly camera — match keeps running; only local player body is parked */
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
      inputManager.exitDebugFlyMode();
      return;
    }
    pos.current.copy(camera.position);
    wasActive.current = true;
    inputManager.enterDebugFlyMode();
  }, [active, camera]);

  /** Run after Player so third-person camera does not overwrite fly cam */
  useFrame((_, dt) => {
    if (!gameStore.getState().debugFreelook) return;

    if (!wasActive.current) {
      pos.current.copy(camera.position);
      wasActive.current = true;
    }

    stadiumLightStore.setFlyCameraPosition([
      camera.position.x,
      camera.position.y,
      camera.position.z,
    ]);
    writeLookDirection(
      inputManager.getRotation().yaw,
      inputManager.getRotation().pitch,
      _lookDir,
    );
    stadiumLightStore.setFlyCameraLook([_lookDir.x, _lookDir.y, _lookDir.z]);

    if (stadiumLightStore.getState().gizmoDragging) {
      writeLookDirection(
        inputManager.getRotation().yaw,
        inputManager.getRotation().pitch,
        _lookDir,
      );
      _lookTarget.copy(pos.current).add(_lookDir);
      camera.lookAt(_lookTarget);
      return;
    }

    const frameDt = dt > 0 ? dt : 1 / 60;
    const rot = inputManager.getRotation();
    const move = inputManager.getMoveVector();
    const speed =
      DEBUG_FREELOOK.flySpeed *
      (inputManager.isSprint() ? DEBUG_FREELOOK.sprintMult : 1) *
      frameDt;

    writeLookDirection(rot.yaw, rot.pitch, _lookDir);
    _flyRight.crossVectors(_worldUp, _lookDir);
    if (_flyRight.lengthSq() < 1e-6) {
      _flyRight.copy(getCameraBasis(rot.yaw).right);
    } else {
      _flyRight.normalize();
    }

    if (move.y !== 0) pos.current.addScaledVector(_lookDir, move.y * speed);
    if (move.x !== 0) pos.current.addScaledVector(_flyRight, -move.x * speed);

    camera.position.copy(pos.current);
    writeLookDirection(rot.yaw, rot.pitch, _lookDir);
    _lookTarget.copy(pos.current).add(_lookDir);
    camera.lookAt(_lookTarget);
    camera.updateMatrixWorld();
  }, 999);

  return null;
}
