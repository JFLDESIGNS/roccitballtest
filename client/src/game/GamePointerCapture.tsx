import { useCallback, useSyncExternalStore } from 'react';
import { gameStore } from './gameStore';
import { inputManager } from './InputManager';
import { resumeAudio, warmAudio } from './audio';
import { tuningStore } from './tuningStore';

/** Full-screen click target when the mouse is not locked (works with Xbox Game Bar capture). */
export function GamePointerCapture() {
  const phase = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().phase,
  );
  const pointerLocked = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().pointerLocked,
  );
  const showMenu = useSyncExternalStore(
    tuningStore.subscribe,
    () => tuningStore.getState().showMenu,
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (showMenu) return;
      e.preventDefault();
      const canvas =
        document.querySelector<HTMLCanvasElement>('.game-canvas canvas') ??
        inputManager.getCanvas();
      if (!canvas) return;
      resumeAudio();
      warmAudio();
      inputManager.requestPointerLock(canvas);
    },
    [showMenu],
  );

  if (showMenu || pointerLocked || phase !== 'playing') {
    return null;
  }

  return (
    <div
      className="game-pointer-capture"
      onPointerDown={onPointerDown}
      role="button"
      tabIndex={0}
      aria-label="Click to capture mouse for gameplay"
    />
  );
}
