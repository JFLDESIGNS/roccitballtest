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
import { arenaRoofStore } from './arenaRoofStore';
import { gameStore } from './gameStore';
import { tuningStore } from './tuningStore';
import { stadiumLightStore } from './stadiumLightStore';
import { stadiumRectLightDebugStore } from './stadiumRectLightDebugStore';
import { getLookDirection } from './CameraController';
import { triggerThrowFlipEmotes } from './forwardFlipEmote';
import { shouldIgnoreGameplayKeys } from './uiFocus';

type Keys = Record<string, boolean>;

const GAMEPAD_DEADZONE = 0.16;
const GAMEPAD_TRIGGER_THRESHOLD = 0.35;
const GAMEPAD_MAX_DT = 1 / 20;
const GAMEPAD_LOOK_YAW_SPEED = 3.2;
const GAMEPAD_LOOK_PITCH_SPEED = 2.45;

class InputManager {
  private keys: Keys = {};
  private mouseButtons = { left: false, right: false };
  private controllerFireDown = false;
  private controllerBeamDown = false;
  private controllerSprintDown = false;
  private controllerMove = { x: 0, y: 0 };
  private controllerButtons: boolean[] = [];
  private lastGamepadPollAt = 0;
  private yaw = 0;
  private aimPitch: number = AIM.defaultPitch;
  private pendingMouseLookX = 0;
  private pendingMouseLookY = 0;
  private throwQueued = false;
  private ePropelQueued = false;
  private fireQueued = false;
  private jumpQueued = false;
  private grappleQueued = false;
  private jumpBufferUntil = 0;
  private lastForwardTapAt = 0;
  private lastDownTapAt = 0;
  private dashBoostQueued = false;
  private downSmashQueued = false;
  private spawnBallQueued = false;
  private ballRespawnQueued = false;
  private bound = false;
  private fireEdge = false;
  private fireReleaseEdge = false;
  private canvas: HTMLElement | null = null;
  /** Dropped when the WebGL canvas remounts (play again, intro → load). */
  private canvasListenerAbort: AbortController | null = null;
  private lookWarmupUntil = 0;
  private pointerLocked = false;
  private pointerCaptureId: number | null = null;
  private lastClientX = 0;
  private lastClientY = 0;
  private hasLastClient = false;

  private canApplyFallbackLook(): boolean {
    if (tuningStore.getState().showMenu) return false;
    if (gameStore.getState().debugFreelook) {
      return (
        this.mouseButtons.right || this.pointerCaptureId !== null
      );
    }
    const phase = gameStore.getState().phase;
    return phase === 'playing' || phase === 'countdown';
  }

  private syncPointerLockState(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    const locked = document.pointerLockElement === canvas;
    if (locked) {
      this.releasePointerCaptureFallback();
      if (!this.pointerLocked) {
        this.lookWarmupUntil = performance.now() + CAMERA.lockWarmupMs;
      }
    }
    if (locked === this.pointerLocked) return;
    this.pointerLocked = locked;
    gameStore.setPointerLocked(locked);
  }

  private releasePointerCaptureFallback(): void {
    const canvas = this.canvas;
    if (!canvas || this.pointerCaptureId === null) return;
    try {
      canvas.releasePointerCapture(this.pointerCaptureId);
    } catch {
      /* already released */
    }
    this.pointerCaptureId = null;
    this.hasLastClient = false;
  }

  private flushPendingMouseLook(): void {
    this.pendingMouseLookX = 0;
    this.pendingMouseLookY = 0;
  }

  private beginPointerCaptureFallback(e: PointerEvent): void {
    const canvas = this.canvas;
    if (!canvas || document.pointerLockElement === canvas) return;
    try {
      canvas.setPointerCapture(e.pointerId);
      this.pointerCaptureId = e.pointerId;
      this.lastClientX = e.clientX;
      this.lastClientY = e.clientY;
      this.hasLastClient = true;
    } catch {
      /* unsupported */
    }
  }

  private handleMouseLook(e: MouseEvent): void {
    const canvas = this.canvas;
    if (!canvas) return;

    if (document.pointerLockElement === canvas) {
      this.applyMouseLook(e.movementX, e.movementY);
      return;
    }

    if (gameStore.getState().debugFreelook) {
      if (!this.mouseButtons.right && this.pointerCaptureId === null) {
        return;
      }
      let dx = e.movementX;
      let dy = e.movementY;
      if (dx === 0 && dy === 0 && this.hasLastClient) {
        dx = e.clientX - this.lastClientX;
        dy = e.clientY - this.lastClientY;
      }
      this.lastClientX = e.clientX;
      this.lastClientY = e.clientY;
      this.hasLastClient = true;
      if (dx !== 0 || dy !== 0) this.applyMouseLook(dx, dy);
      return;
    }

    if (!this.canApplyFallbackLook()) return;

    const captureActive = this.pointerCaptureId !== null;
    const buttonsHeld = this.mouseButtons.left || this.mouseButtons.right;
    if (!captureActive && !buttonsHeld) {
      this.hasLastClient = false;
      return;
    }

    let dx = e.movementX;
    let dy = e.movementY;
    if (dx === 0 && dy === 0 && this.hasLastClient) {
      dx = e.clientX - this.lastClientX;
      dy = e.clientY - this.lastClientY;
    }
    this.lastClientX = e.clientX;
    this.lastClientY = e.clientY;
    this.hasLastClient = true;

    if (dx !== 0 || dy !== 0) {
      this.applyMouseLook(dx, dy);
    }
  }

  /** Release lock so the OS cursor works for the light editor panel */
  exitPointerLock(): void {
    this.releasePointerCaptureFallback();
    this.flushPendingMouseLook();
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.pointerLocked = false;
    gameStore.setPointerLocked(false);
  }

  /** Enter U-mode — free cursor; hold RMB on arena to look around */
  enterDebugFlyMode(): void {
    this.exitPointerLock();
    this.flushFireInput();
    this.mouseButtons.left = false;
    this.mouseButtons.right = false;
  }

  exitDebugFlyMode(): void {
    this.exitPointerLock();
    this.mouseButtons.right = false;
    this.hasLastClient = false;
    this.flushPendingMouseLook();
  }

  /** After tuning menu or alt-tab — sync lock state; next click re-captures mouse */
  onGameplayResume(): void {
    this.syncPointerLockState();
    this.releasePointerCaptureFallback();
    this.flushPendingMouseLook();
    this.lookWarmupUntil = 0;
    const canvas = this.canvas;
    if (canvas && typeof canvas.focus === 'function') {
      canvas.focus({ preventScroll: true });
    }
  }

  private detachCanvasListeners(): void {
    this.canvasListenerAbort?.abort();
    this.canvasListenerAbort = null;
    this.releasePointerCaptureFallback();
    this.hasLastClient = false;
    this.flushPendingMouseLook();
    this.canvas = null;
  }

  bind(canvas: HTMLElement) {
    if (this.canvas === canvas) return;
    if (this.canvas) this.detachCanvasListeners();

    if (!this.bound) {
      this.bound = true;
      this.registerGlobalListeners();
    }

    this.canvas = canvas;
    this.canvasListenerAbort = new AbortController();
    const signal = this.canvasListenerAbort.signal;

    const onMouseDown = (e: MouseEvent) => {
      const activeCanvas = this.canvas;
      if (!activeCanvas) return;
      if (gameStore.getState().debugFreelook) {
        if (e.button === 2) {
          this.mouseButtons.right = true;
          this.beginPointerCaptureFallback(e as PointerEvent);
        }
        return;
      }
      if (e.button === 0) this.setFireDown(true);
      if (e.button === 2) this.mouseButtons.right = true;
      if (
        document.pointerLockElement !== activeCanvas &&
        this.canApplyFallbackLook()
      ) {
        this.requestPointerLock(activeCanvas);
        this.beginPointerCaptureFallback(e as PointerEvent);
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (gameStore.getState().debugFreelook) {
        if (e.button === 2) {
          this.mouseButtons.right = false;
          this.releasePointerCaptureFallback();
          this.hasLastClient = false;
        }
        return;
      }
      if (e.button === 0) this.setFireDown(false);
      if (e.button === 2) this.mouseButtons.right = false;
      if (
        this.pointerCaptureId !== null &&
        (e as PointerEvent).pointerId === this.pointerCaptureId
      ) {
        this.releasePointerCaptureFallback();
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      this.handleMouseLook(e);
    };
    const onContextMenu = (e: Event) => e.preventDefault();
    const onLostPointerCapture = () => {
      this.pointerCaptureId = null;
      this.hasLastClient = false;
    };

    canvas.addEventListener('mousedown', onMouseDown, { signal });
    canvas.addEventListener('mouseup', onMouseUp, { signal });
    canvas.addEventListener('mousemove', onMouseMove, { signal });
    canvas.addEventListener('contextmenu', onContextMenu, { signal });
    canvas.addEventListener('lostpointercapture', onLostPointerCapture, {
      signal,
    });
  }

  private registerGlobalListeners(): void {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && gameStore.getState().debugFreelook) {
        stadiumLightStore.deselect();
      }
      if (shouldIgnoreGameplayKeys()) return;

      this.keys[e.code] = true;
      if (e.code === 'KeyW' && !e.repeat && tuningStore.getState().wwDashEnabled) {
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
      if ((e.code === 'KeyS' || e.code === 'ArrowDown') && !e.repeat) {
        const nowSec = performance.now() / 1000;
        if (
          this.lastDownTapAt > 0 &&
          nowSec - this.lastDownTapAt <=
            tuningStore.getState().groundSmashDoubleTapWindowSec
        ) {
          this.downSmashQueued = true;
          this.lastDownTapAt = 0;
        } else {
          this.lastDownTapAt = nowSec;
        }
      }
      if (e.code === 'KeyE' && !e.repeat && !gameStore.getState().debugFreelook) {
        this.throwQueued = true;
        this.ePropelQueued = true;
        triggerThrowFlipEmotes();
      }
      if (e.code === 'KeyF') this.spawnBallQueued = true;
      if (e.code === 'KeyT') this.spawnBallQueued = true;
      if (e.code === 'KeyR' && !e.repeat) {
        if (tuningStore.getState().showMenu) return;
        const phase = gameStore.getState().phase;
        if (phase === 'playing' || phase === 'countdown') {
          arenaRoofStore.toggleTarget();
        }
      }
      if (e.code === 'KeyG' && !e.repeat) {
        if (tuningStore.getState().showMenu) return;
        const phase = gameStore.getState().phase;
        if (phase === 'playing' || phase === 'countdown') {
          gameStore.toggleColliderDebug();
        }
      }
      if (e.code === 'KeyH' && !e.repeat) {
        if (tuningStore.getState().showMenu) return;
        const phase = gameStore.getState().phase;
        if (phase === 'playing' || phase === 'countdown') {
          stadiumRectLightDebugStore.toggleWireframe();
        }
      }
      if (e.code === 'Digit1') {
        e.preventDefault();
        tuningStore.toggleMenu();
      }
      if (e.code === 'Digit2') {
        gameStore.toggleShowPhysicsBall();
      }
      if (e.code === 'Digit4') {
        gameStore.togglePlayerVisualProxy();
      }
      if (e.code === 'KeyU' && !e.repeat) {
        if (tuningStore.getState().showMenu) return;
        const gs = gameStore.getState();
        if (gs.debugFreelook) {
          gameStore.toggleDebugFreelook();
          return;
        }
        if (gs.phase === 'playing' || gs.phase === 'countdown') {
          gameStore.toggleDebugFreelook();
        }
      }
      if (e.code === 'Space') {
        e.preventDefault();
        this.jumpQueued = true;
        this.jumpBufferUntil =
          performance.now() / 1000 + BALL.jumpBufferSec;
      }
      if (e.code === 'KeyQ' && !e.repeat) {
        this.grappleQueued = true;
      }
      if (e.code === 'Tab') {
        e.preventDefault();
        if (gameStore.getState().debugFreelook) {
          if (!e.repeat) this.ballRespawnQueued = true;
          return;
        }
        gameStore.setShowScoreboard(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (shouldIgnoreGameplayKeys()) return;
      this.keys[e.code] = false;
      if (e.code === 'Tab') {
        if (!gameStore.getState().debugFreelook) {
          gameStore.setShowScoreboard(false);
        }
      }
    };
    const onWindowMouseUp = (e: MouseEvent) => {
      if (e.button === 0) this.setFireDown(false);
      if (e.button === 2) this.mouseButtons.right = false;
    };
    const onBlur = () => {
      if (this.mouseButtons.left) this.setFireDown(false);
      this.mouseButtons.right = false;
      this.releasePointerCaptureFallback();
      this.flushPendingMouseLook();
      this.syncPointerLockState();
    };
    const onWindowMouseMove = (e: MouseEvent) => {
      const activeCanvas = this.canvas;
      if (!activeCanvas || document.pointerLockElement === activeCanvas) {
        return;
      }
      if (
        !gameStore.getState().debugFreelook &&
        !this.mouseButtons.left &&
        !this.mouseButtons.right
      ) {
        return;
      }
      this.handleMouseLook(e);
    };
    const onPointerLockChange = () => {
      this.syncPointerLockState();
    };
    const onPointerLockError = () => {
      this.pointerLocked = false;
      gameStore.setPointerLocked(false);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        this.syncPointerLockState();
      } else {
        this.releasePointerCaptureFallback();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mouseup', onWindowMouseUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', () => this.syncPointerLockState());
    window.addEventListener('mousemove', onWindowMouseMove);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('pointerlockerror', onPointerLockError);
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  private shapeGamepadAxis(value: number): number {
    const abs = Math.abs(value);
    if (abs <= GAMEPAD_DEADZONE) return 0;
    const scaled = (abs - GAMEPAD_DEADZONE) / (1 - GAMEPAD_DEADZONE);
    return Math.sign(value) * scaled * scaled;
  }

  private isGamepadButtonDown(
    gamepad: Gamepad,
    index: number,
    threshold = 0.5,
  ): boolean {
    const button = gamepad.buttons[index];
    return !!button && (button.pressed || button.value >= threshold);
  }

  private consumeGamepadButton(
    index: number,
    down: boolean,
    onPress: () => void,
    onRelease?: () => void,
  ): void {
    const wasDown = this.controllerButtons[index] ?? false;
    if (down && !wasDown) onPress();
    if (!down && wasDown) onRelease?.();
    this.controllerButtons[index] = down;
  }

  private setControllerFireDown(down: boolean): void {
    const wasAnyFireDown = this.isAnyFireDown();
    this.controllerFireDown = down;
    const isAnyFireDown = this.isAnyFireDown();
    if (isAnyFireDown && !wasAnyFireDown) {
      this.fireEdge = true;
      this.fireQueued = true;
    }
    if (!isAnyFireDown && wasAnyFireDown) {
      this.fireReleaseEdge = true;
    }
  }

  private pollGamepad(): void {
    const now = performance.now();
    if (now - this.lastGamepadPollAt < 1) return;
    const dt = this.lastGamepadPollAt
      ? THREE.MathUtils.clamp(
          (now - this.lastGamepadPollAt) / 1000,
          0,
          GAMEPAD_MAX_DT,
        )
      : 1 / 60;
    this.lastGamepadPollAt = now;

    const gamepads = navigator.getGamepads?.();
    const gamepad = gamepads
      ? Array.from(gamepads).find((pad) => pad?.connected)
      : null;

    if (!gamepad) {
      this.controllerMove.x = 0;
      this.controllerMove.y = 0;
      this.controllerSprintDown = false;
      this.controllerBeamDown = false;
      if (this.controllerFireDown) this.setControllerFireDown(false);
      this.controllerButtons = [];
      return;
    }

    this.controllerMove.x = this.shapeGamepadAxis(gamepad.axes[0] ?? 0);
    this.controllerMove.y = -this.shapeGamepadAxis(gamepad.axes[1] ?? 0);

    if (!tuningStore.getState().showMenu) {
      const lookX = this.shapeGamepadAxis(gamepad.axes[2] ?? 0);
      const lookY = this.shapeGamepadAxis(gamepad.axes[3] ?? 0);
      if (lookX !== 0 || lookY !== 0) {
        const sens = tuningStore.getState().mouseSensitivity;
        this.yaw -= lookX * GAMEPAD_LOOK_YAW_SPEED * sens * dt;
        this.aimPitch -= lookY * GAMEPAD_LOOK_PITCH_SPEED * sens * dt;
        this.aimPitch = THREE.MathUtils.clamp(
          this.aimPitch,
          AIM.pitchMin,
          AIM.pitchMax,
        );
      }
    }

    this.setControllerFireDown(
      this.isGamepadButtonDown(gamepad, 7, GAMEPAD_TRIGGER_THRESHOLD),
    );
    this.controllerBeamDown = this.isGamepadButtonDown(
      gamepad,
      6,
      GAMEPAD_TRIGGER_THRESHOLD,
    );
    this.controllerSprintDown =
      this.isGamepadButtonDown(gamepad, 4) ||
      this.isGamepadButtonDown(gamepad, 10);

    this.consumeGamepadButton(0, this.isGamepadButtonDown(gamepad, 0), () => {
      this.jumpQueued = true;
      this.jumpBufferUntil = performance.now() / 1000 + BALL.jumpBufferSec;
    });
    this.consumeGamepadButton(1, this.isGamepadButtonDown(gamepad, 1), () => {
      if (gameStore.getState().debugFreelook) return;
      this.throwQueued = true;
      this.ePropelQueued = true;
      triggerThrowFlipEmotes();
    });
    this.consumeGamepadButton(2, this.isGamepadButtonDown(gamepad, 2), () => {
      this.spawnBallQueued = true;
    });
    this.consumeGamepadButton(5, this.isGamepadButtonDown(gamepad, 5), () => {
      this.grappleQueued = true;
    });
    this.consumeGamepadButton(13, this.isGamepadButtonDown(gamepad, 13), () => {
      this.downSmashQueued = true;
    });
  }

  private isAnyFireDown(): boolean {
    return this.mouseButtons.left || this.controllerFireDown;
  }

  private syncLookInput(): void {
    this.applyPendingMouseLook();
    this.pollGamepad();
  }

  private setFireDown(down: boolean) {
    const wasAnyFireDown = this.isAnyFireDown();
    this.mouseButtons.left = down;
    const isAnyFireDown = this.isAnyFireDown();
    if (isAnyFireDown && !wasAnyFireDown) {
      this.fireEdge = true;
      this.fireQueued = true;
    }
    if (!isAnyFireDown && wasAnyFireDown) {
      this.fireReleaseEdge = true;
    }
  }

  private applyMouseLook(movementX: number, movementY: number) {
    if (
      !gameStore.getState().debugFreelook &&
      performance.now() < this.lookWarmupUntil
    ) {
      return;
    }

    const cap = CAMERA.maxMouseDelta;
    this.pendingMouseLookX += THREE.MathUtils.clamp(movementX, -cap, cap);
    this.pendingMouseLookY += THREE.MathUtils.clamp(movementY, -cap, cap);
  }

  private applyPendingMouseLook(): void {
    if (this.pendingMouseLookX === 0 && this.pendingMouseLookY === 0) return;
    if (
      !gameStore.getState().debugFreelook &&
      performance.now() < this.lookWarmupUntil
    ) {
      this.flushPendingMouseLook();
      return;
    }

    const mx = this.pendingMouseLookX;
    const my = this.pendingMouseLookY;
    this.flushPendingMouseLook();

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

  /** Sync store + internal flag from document (alt-tab, visibility, menu close). */
  refreshPointerLockState(): void {
    this.syncPointerLockState();
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
      const promise = el.requestPointerLock();
      void promise?.catch?.(() => {});
    } catch {
      try {
        const promise = el.requestPointerLock({
          unadjustedMovement: true,
        });
        void promise?.catch?.(() => {});
      } catch {
        /* blocked by browser, Game Bar overlay, etc. */
      }
    }
  }

  getMoveVector(): { x: number; y: number } {
    this.syncLookInput();
    let x = 0;
    let y = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) y += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) y -= 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;
    x += this.controllerMove.x;
    y += this.controllerMove.y;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  consumeThrow(): boolean {
    this.syncLookInput();
    if (!this.throwQueued) return false;
    this.throwQueued = false;
    return true;
  }

  consumeEPropel(): boolean {
    this.syncLookInput();
    if (!this.ePropelQueued) return false;
    this.ePropelQueued = false;
    return true;
  }

  consumeFireEdge(): boolean {
    this.syncLookInput();
    if (!this.fireEdge) return false;
    this.fireEdge = false;
    this.fireQueued = false;
    return true;
  }

  consumeFireRelease(): boolean {
    this.syncLookInput();
    if (!this.fireReleaseEdge) return false;
    this.fireReleaseEdge = false;
    return true;
  }

  consumeFire(): boolean {
    this.syncLookInput();
    if (!this.fireQueued) return false;
    this.fireQueued = false;
    return true;
  }

  isFireDown(): boolean {
    this.syncLookInput();
    return this.isAnyFireDown();
  }

  flushFireInput(): void {
    this.mouseButtons.left = false;
    this.controllerFireDown = false;
    this.fireEdge = false;
    this.fireReleaseEdge = false;
    this.fireQueued = false;
  }

  consumeSpawnBall(): boolean {
    this.syncLookInput();
    if (!this.spawnBallQueued) return false;
    this.spawnBallQueued = false;
    return true;
  }

  consumeBallRespawn(): boolean {
    this.syncLookInput();
    if (!this.ballRespawnQueued) return false;
    this.ballRespawnQueued = false;
    return true;
  }

  wantsJump(): boolean {
    this.syncLookInput();
    return this.jumpQueued;
  }

  consumeJump(): boolean {
    this.syncLookInput();
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

  consumeGrapple(): boolean {
    this.syncLookInput();
    if (!this.grappleQueued) return false;
    this.grappleQueued = false;
    return true;
  }

  consumeDashBoost(): boolean {
    this.syncLookInput();
    if (!this.dashBoostQueued) return false;
    this.dashBoostQueued = false;
    return true;
  }

  consumeDownSmash(): boolean {
    this.syncLookInput();
    if (!this.downSmashQueued) return false;
    this.downSmashQueued = false;
    return true;
  }

  isSprint(): boolean {
    this.syncLookInput();
    return (
      !!this.keys['ShiftLeft'] ||
      !!this.keys['ShiftRight'] ||
      this.controllerSprintDown
    );
  }

  isBeam(): boolean {
    this.syncLookInput();
    return this.mouseButtons.right || this.controllerBeamDown;
  }

  isEscape(): boolean {
    return !!this.keys['Escape'];
  }

  getRotation() {
    this.syncLookInput();
    return { yaw: this.yaw, pitch: this.aimPitch };
  }

  getAimPitch() {
    this.syncLookInput();
    return this.aimPitch;
  }

  getLookDirection(): THREE.Vector3 {
    this.syncLookInput();
    return getLookDirection(this.yaw, this.aimPitch);
  }
}

export const inputManager = new InputManager();
