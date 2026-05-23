import * as THREE from 'three';
import {
  AIM,
  BALL,
  BALL_SPAWN,
  CAMERA,
  MOVEMENT,
  TEAM_SPAWN,
} from '../shared/Constants';
import type { Team } from '../shared/Types';
import { tuningStore } from './tuningStore';
import { getLookDirection } from './CameraController';

type Keys = Record<string, boolean>;

class InputManager {
  private keys: Keys = {};
  private mouseButtons = { left: false, right: false };
  private yaw = 0;
  private aimPitch: number = AIM.defaultPitch;
  private throwQueued = false;
  private fireQueued = false;
  private jumpQueued = false;
  private jumpBufferUntil = 0;
  private lastForwardTapAt = 0;
  private dashBoostQueued = false;
  private spawnBallQueued = false;
  private bound = false;
  private fireEdge = false;
  private fireReleaseEdge = false;
  private canvas: HTMLElement | null = null;
  private lookWarmupUntil = 0;
  private pointerLocked = false;

  bind(canvas: HTMLElement) {
    if (this.bound) return;
    this.bound = true;
    this.canvas = canvas;

    const onKeyDown = (e: KeyboardEvent) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyW' && !e.repeat) {
        const nowSec = performance.now() / 1000;
        if (
          this.lastForwardTapAt > 0 &&
          nowSec - this.lastForwardTapAt <= MOVEMENT.dashDoubleTapWindowSec
        ) {
          this.dashBoostQueued = true;
          this.lastForwardTapAt = 0;
        } else {
          this.lastForwardTapAt = nowSec;
        }
      }
      if (e.code === 'KeyE') this.throwQueued = true;
      if (e.code === 'KeyF') this.spawnBallQueued = true;
      if (e.code === 'KeyG') {
        import('./gameStore').then(({ gameStore }) =>
          gameStore.toggleColliderDebug(),
        );
      }
      if (e.code === 'Digit1') {
        e.preventDefault();
        import('./tuningStore').then(({ tuningStore }) => tuningStore.toggleMenu());
      }
      if (e.code === 'Space') {
        e.preventDefault();
        this.jumpQueued = true;
        this.jumpBufferUntil =
          performance.now() / 1000 + BALL.jumpBufferSec;
      }
      if (e.code === 'Tab') {
        e.preventDefault();
        import('./gameStore').then(({ gameStore }) =>
          gameStore.setShowScoreboard(true),
        );
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      this.keys[e.code] = false;
      if (e.code === 'Tab') {
        import('./gameStore').then(({ gameStore }) =>
          gameStore.setShowScoreboard(false),
        );
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) this.setFireDown(true);
      if (e.button === 2) this.mouseButtons.right = true;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) this.setFireDown(false);
      if (e.button === 2) this.mouseButtons.right = false;
    };
    const onWindowMouseUp = (e: MouseEvent) => {
      if (e.button === 0) this.setFireDown(false);
      if (e.button === 2) this.mouseButtons.right = false;
    };
    const onBlur = () => {
      if (this.mouseButtons.left) this.setFireDown(false);
      this.mouseButtons.right = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      this.applyMouseLook(e.movementX, e.movementY);
    };
    const onContextMenu = (e: Event) => e.preventDefault();
    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      this.pointerLocked = locked;
      if (locked) {
        this.lookWarmupUntil = performance.now() + CAMERA.lockWarmupMs;
      }
      import('./gameStore').then(({ gameStore }) =>
        gameStore.setPointerLocked(locked),
      );
    };
    const onPointerLockError = () => {
      this.pointerLocked = false;
      import('./gameStore').then(({ gameStore }) =>
        gameStore.setPointerLocked(false),
      );
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mouseup', onWindowMouseUp);
    window.addEventListener('blur', onBlur);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('pointerlockerror', onPointerLockError);
  }

  private setFireDown(down: boolean) {
    if (down && !this.mouseButtons.left) {
      this.fireEdge = true;
      this.fireQueued = true;
    }
    if (!down && this.mouseButtons.left) {
      this.fireReleaseEdge = true;
    }
    this.mouseButtons.left = down;
  }

  private applyMouseLook(movementX: number, movementY: number) {
    if (performance.now() < this.lookWarmupUntil) return;

    const cap = CAMERA.maxMouseDelta;
    const mx = THREE.MathUtils.clamp(movementX, -cap, cap);
    const my = THREE.MathUtils.clamp(movementY, -cap, cap);

    const sens = tuningStore.getState().mouseSensitivity;
    this.yaw -= mx * CAMERA.mouseSensitivityX * sens;
    this.aimPitch -= my * CAMERA.mouseSensitivityY * sens;
    this.aimPitch = THREE.MathUtils.clamp(
      this.aimPitch,
      AIM.pitchMin,
      AIM.pitchMax,
    );
  }

  /** Face toward center ball at match start */
  resetLookForTeam(team: Team) {
    const spawn = TEAM_SPAWN[team];
    this.resetLookFromPosition(spawn.x, spawn.z);
  }

  resetLookFromPosition(fromX: number, fromZ: number) {
    const dx = BALL_SPAWN.x - fromX;
    const dz = BALL_SPAWN.z - fromZ;
    this.yaw = Math.atan2(-dx, -dz);
    this.aimPitch = AIM.defaultPitch;
  }

  isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  getCanvas(): HTMLElement | null {
    return this.canvas;
  }

  /** Must run from a user gesture (click / pointerdown). */
  requestPointerLock(canvas?: HTMLElement) {
    const el = canvas ?? this.canvas;
    if (!el || document.pointerLockElement === el) return;

    if (typeof (el as HTMLElement).focus === 'function') {
      (el as HTMLElement).focus({ preventScroll: true });
    }

    try {
      const promise = el.requestPointerLock({
        unadjustedMovement: true,
      });
      void promise?.catch?.(() => {});
    } catch {
      try {
        const promise = el.requestPointerLock();
        void promise?.catch?.(() => {});
      } catch {
        /* blocked by browser, Game Bar overlay, etc. */
      }
    }
  }

  getMoveVector(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) y += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) y -= 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  consumeThrow(): boolean {
    if (!this.throwQueued) return false;
    this.throwQueued = false;
    return true;
  }

  consumeFireEdge(): boolean {
    if (!this.fireEdge) return false;
    this.fireEdge = false;
    this.fireQueued = false;
    return true;
  }

  consumeFireRelease(): boolean {
    if (!this.fireReleaseEdge) return false;
    this.fireReleaseEdge = false;
    return true;
  }

  consumeFire(): boolean {
    if (!this.fireQueued) return false;
    this.fireQueued = false;
    return true;
  }

  isFireDown(): boolean {
    return this.mouseButtons.left;
  }

  flushFireInput(): void {
    this.mouseButtons.left = false;
    this.fireEdge = false;
    this.fireReleaseEdge = false;
    this.fireQueued = false;
  }

  consumeSpawnBall(): boolean {
    if (!this.spawnBallQueued) return false;
    this.spawnBallQueued = false;
    return true;
  }

  wantsJump(): boolean {
    return this.jumpQueued;
  }

  consumeJump(): boolean {
    if (!this.jumpQueued) return false;
    const nowSec = performance.now() / 1000;
    if (this.jumpBufferUntil > 0 && nowSec > this.jumpBufferUntil) {
      this.jumpQueued = false;
      this.jumpBufferUntil = 0;
      return false;
    }
    this.jumpQueued = false;
    this.jumpBufferUntil = 0;
    return true;
  }

  consumeDashBoost(): boolean {
    if (!this.dashBoostQueued) return false;
    this.dashBoostQueued = false;
    return true;
  }

  isSprint(): boolean {
    return !!this.keys['ShiftLeft'] || !!this.keys['ShiftRight'];
  }

  isBeam(): boolean {
    return this.mouseButtons.right;
  }

  isEscape(): boolean {
    return !!this.keys['Escape'];
  }

  getRotation() {
    return { yaw: this.yaw, pitch: this.aimPitch };
  }

  getAimPitch() {
    return this.aimPitch;
  }

  getLookDirection(): THREE.Vector3 {
    return getLookDirection(this.yaw, this.aimPitch);
  }
}

export const inputManager = new InputManager();
