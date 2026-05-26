import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { gameStore } from './gameStore';
import { inputManager } from './InputManager';
import { resumeAudio, warmAudio } from './audio';
import { tuningStore } from './tuningStore';
import { isMatchOver } from './matchEnd';

function isPointerCapturePhase(phase: string): boolean {
  return phase === 'playing' || phase === 'countdown' || phase === 'paused';
}

function requestArenaPointerLock(): void {
  const canvas =
    document.querySelector<HTMLCanvasElement>('.game-canvas canvas') ??
    inputManager.getCanvas();
  if (!canvas) return;
  resumeAudio();
  warmAudio();
  inputManager.onGameplayResume();
  inputManager.requestPointerLock(canvas);
}

/** Full-screen click target when the mouse is not locked (alt-tab, menu, tuning). */
export function GamePointerCapture() {
  const phase = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().phase,
  );
  const pointerLocked = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().pointerLocked,
  );
  const matchOver = useSyncExternalStore(gameStore.subscribe, () =>
    isMatchOver(gameStore.getState()),
  );
  const showMenu = useSyncExternalStore(
    tuningStore.subscribe,
    () => tuningStore.getState().showMenu,
  );
  const debugFreelook = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().debugFreelook,
  );

  useEffect(() => {
    const refresh = () => inputManager.refreshPointerLockState();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (showMenu || debugFreelook) return;
      e.preventDefault();
      e.stopPropagation();
      requestArenaPointerLock();
    },
    [showMenu, debugFreelook],
  );

  const showCapture =
    isPointerCapturePhase(phase) &&
    !matchOver &&
    !showMenu &&
    !debugFreelook &&
    !pointerLocked;

  if (!showCapture) return null;

  return (
    <div
      className="game-pointer-capture"
      onPointerDown={onPointerDown}
      onClick={(e) => {
        e.preventDefault();
        requestArenaPointerLock();
      }}
      role="button"
      tabIndex={-1}
      aria-label="Click to capture mouse for gameplay"
    />
  );
}
