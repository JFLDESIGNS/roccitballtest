import type { RapierRigidBody } from '@react-three/rapier';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import { MOVEMENT } from '../shared/Constants';
import { getForwardFlipPitchX } from './forwardFlipEmote';
import { getRocketRecoilPitch } from './rocketRecoil';

/** Team markers / billboards above characters */
export const CHARACTER_INDICATOR_RENDER_ORDER = 160;

const BOB_MAX_Y = 0.085;
const BOB_SPEED_BASE = 9;
const PITCH_VISUAL_SCALE = 1;
const PITCH_VISUAL_CLAMP = 1.05;
const PITCH_SMOOTH = 16;

const _uprightQ = new THREE.Quaternion();
const _uprightEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _worldUp = new THREE.Vector3();
const _axisY = new THREE.Vector3(0, 1, 0);
const _yawQ = new THREE.Quaternion();
export type KnockVisualTumbleState = {
  rollX: number;
  rollZ: number;
  pitch: number;
};

export function createKnockVisualTumbleState(): KnockVisualTumbleState {
  return { rollX: 0, rollZ: 0, pitch: 0 };
}

export function impulseKnockVisualTumble(
  state: KnockVisualTumbleState,
  strength = 1,
): void {
  state.rollX += (Math.random() - 0.5) * 0.95 * strength;
  state.rollZ += (Math.random() - 0.5) * 0.95 * strength;
  state.pitch += (Math.random() - 0.5) * 0.45 * strength;
}

export function tickKnockVisualTumble(
  state: KnockVisualTumbleState,
  dt: number,
): void {
  const k = Math.exp(-9 * dt);
  state.rollX *= k;
  state.rollZ *= k;
  state.pitch *= k;
}

export function clearKnockVisualTumble(state: KnockVisualTumbleState): void {
  state.rollX = 0;
  state.rollZ = 0;
  state.pitch = 0;
}

/** Counter-rotate mesh hierarchy so the avatar stays world-upright while the capsule may tumble */
export function alignCharacterVisualUpright(
  body: RapierRigidBody,
  refs: CharacterVisualRefs,
  yaw: number,
  tumble: KnockVisualTumbleState | null = null,
  aimPitch = 0,
): void {
  if (refs.visual) {
    const r = body.rotation();
    _uprightQ.set(r.x, r.y, r.z, r.w);
    _worldUp.set(0, 1, 0).applyQuaternion(_uprightQ);
    if (_worldUp.y >= 0.92) {
      refs.visual.quaternion.identity();
      refs.visual.rotation.set(0, yaw, 0);
    } else {
      _uprightQ.invert();
      _yawQ.setFromAxisAngle(_axisY, yaw);
      refs.visual.quaternion.copy(_uprightQ).multiply(_yawQ);
    }
  }

  const tumblePitch = tumble?.pitch ?? 0;
  const rollX = tumble?.rollX ?? 0;
  const rollZ = tumble?.rollZ ?? 0;
  const targetPitch = THREE.MathUtils.clamp(
    aimPitch * PITCH_VISUAL_SCALE + tumblePitch,
    -PITCH_VISUAL_CLAMP,
    PITCH_VISUAL_CLAMP,
  );

  if (refs.tilt) {
    refs.tilt.rotation.order = 'XYZ';
    refs.tilt.rotation.x = targetPitch;
    refs.tilt.rotation.y = rollZ;
    refs.tilt.rotation.z = rollX;
    refs.tilt.quaternion.setFromEuler(refs.tilt.rotation);
  }
}

export function teamAccentColor(team: 'red' | 'blue'): string {
  return team === 'red' ? '#ff5544' : '#55aaff';
}

export {
  applyDroneTeamMaterial,
  DRONE_EMISSIVE_INTENSITY,
  DRONE_TEAM_COLORS,
} from './droneMaterials';

export type CharacterVisualRefs = {
  visual: THREE.Group | null;
  tilt: THREE.Group | null;
  bob: THREE.Group | null;
  pitchSmooth: MutableRefObject<number>;
  bobPhase: MutableRefObject<number>;
};

function characterAimPitchWithRecoil(
  actorId: string | undefined,
  aimPitch: number,
): number {
  const recoil = actorId ? getRocketRecoilPitch(actorId) : 0;
  return aimPitch + recoil;
}

function applyForwardFlipOnTilt(
  refs: CharacterVisualRefs,
  actorId: string | undefined,
): void {
  if (!refs.tilt || !actorId) return;
  const flip = getForwardFlipPitchX(actorId);
  if (flip === 0) return;
  refs.tilt.rotation.x += flip;
  refs.tilt.quaternion.setFromEuler(refs.tilt.rotation);
}

/** Yaw on root, pitch on tilt group, vertical bob on bob group — physics unchanged */
export function syncCharacterVisualPresentation(
  body: RapierRigidBody,
  refs: CharacterVisualRefs,
  yaw: number,
  aimPitch: number,
  moveSpeed: number,
  dt: number,
  actorId?: string,
) {
  const targetPitch = THREE.MathUtils.clamp(
    aimPitch * PITCH_VISUAL_SCALE,
    -PITCH_VISUAL_CLAMP,
    PITCH_VISUAL_CLAMP,
  );
  const ps = 1 - Math.exp(-PITCH_SMOOTH * dt);
  refs.pitchSmooth.current = THREE.MathUtils.lerp(
    refs.pitchSmooth.current,
    targetPitch,
    ps,
  );
  alignCharacterVisualUpright(
    body,
    refs,
    yaw,
    null,
    characterAimPitchWithRecoil(actorId, refs.pitchSmooth.current),
  );
  applyForwardFlipOnTilt(refs, actorId);

  const bobFactor = Math.min(1, moveSpeed / 4.5);
  if (bobFactor > 0.02) {
    refs.bobPhase.current += dt * (BOB_SPEED_BASE + moveSpeed * 0.85);
  }
  const bobY = Math.sin(refs.bobPhase.current) * BOB_MAX_Y * bobFactor;
  const bobScale = 1 + Math.sin(refs.bobPhase.current * 2) * 0.018 * bobFactor;
  if (refs.bob) {
    refs.bob.position.y = bobY;
    refs.bob.scale.setScalar(bobScale);
  }
}

export type VisualRecoveryState = {
  secLeft: number;
};

export function createVisualRecoveryState(): VisualRecoveryState {
  return { secLeft: 0 };
}

/** Clear child rotations (euler + quaternion) */
export function resetCharacterVisualGroups(refs: CharacterVisualRefs): void {
  if (refs.visual) {
    refs.visual.rotation.set(0, 0, 0);
    refs.visual.quaternion.identity();
  }
  if (refs.tilt) {
    refs.tilt.rotation.set(0, 0, 0);
    refs.tilt.quaternion.identity();
  }
  if (refs.bob) {
    refs.bob.position.y = 0;
    refs.bob.scale.setScalar(1);
    refs.bob.rotation.set(0, 0, 0);
    refs.bob.quaternion.identity();
  }
}

/** True when the physics capsule is roughly upright (not stuck on its side) */
export function isRigidBodyUpright(
  body: RapierRigidBody,
  minUpY = 0.9,
): boolean {
  const r = body.rotation();
  _uprightQ.set(r.x, r.y, r.z, r.w);
  _worldUp.set(0, 1, 0).applyQuaternion(_uprightQ);
  return _worldUp.y >= minUpY;
}

/** Snap physics upright, keep horizontal facing, lock rotations */
export function snapRigidBodyUpright(body: RapierRigidBody): number {
  const r = body.rotation();
  _uprightQ.set(r.x, r.y, r.z, r.w);
  _uprightEuler.setFromQuaternion(_uprightQ, 'YXZ');
  const yaw = _uprightEuler.y;

  body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  _uprightQ.setFromAxisAngle(_axisY, yaw);
  body.setRotation(
    { x: _uprightQ.x, y: _uprightQ.y, z: _uprightQ.z, w: _uprightQ.w },
    true,
  );
  body.setEnabledRotations(false, false, false, false);
  return yaw;
}

export function forceCharacterUpright(
  body: RapierRigidBody,
  refs: CharacterVisualRefs,
  visualRecovery?: VisualRecoveryState,
  tumble?: KnockVisualTumbleState | null,
): number {
  const yaw = snapRigidBodyUpright(body);
  if (tumble) clearKnockVisualTumble(tumble);
  resetCharacterVisualGroups(refs);
  refs.pitchSmooth.current = 0;
  alignCharacterVisualUpright(body, refs, yaw, null, 0);
  if (visualRecovery) {
    visualRecovery.secLeft = MOVEMENT.visualRecoverySec;
  }
  return yaw;
}

export function beginCharacterVisualRecovery(
  state: VisualRecoveryState,
  refs: CharacterVisualRefs,
  durationSec = MOVEMENT.visualRecoverySec,
): void {
  resetCharacterVisualGroups(refs);
  refs.pitchSmooth.current = 0;
  state.secLeft = durationSec;
}

/** Returns true while recovery is still running */
export function tickCharacterVisualRecovery(
  body: RapierRigidBody,
  state: VisualRecoveryState,
  refs: CharacterVisualRefs,
  yaw: number,
  aimPitch: number,
  moveSpeed: number,
  dt: number,
  actorId?: string,
): boolean {
  if (state.secLeft <= 0) return false;
  state.secLeft = Math.max(0, state.secLeft - dt);
  const targetPitch = THREE.MathUtils.clamp(
    aimPitch * PITCH_VISUAL_SCALE,
    -PITCH_VISUAL_CLAMP,
    PITCH_VISUAL_CLAMP,
  );
  refs.pitchSmooth.current = THREE.MathUtils.lerp(
    refs.pitchSmooth.current,
    targetPitch,
    1 - Math.exp(-PITCH_SMOOTH * dt * 2.4),
  );
  alignCharacterVisualUpright(
    body,
    refs,
    yaw,
    null,
    characterAimPitchWithRecoil(actorId, refs.pitchSmooth.current),
  );
  applyForwardFlipOnTilt(refs, actorId);
  void moveSpeed;
  return state.secLeft > 0;
}
