import type { OrbitControls } from 'three-stdlib';
import type { RefObject } from 'react';

let orbitRef: RefObject<OrbitControls | null> | null = null;
let dragLockCount = 0;

export function registerEditorOrbitControls(
  ref: RefObject<OrbitControls | null>,
): void {
  orbitRef = ref;
  applyOrbitEnabled();
}

export function setEditorOrbitDragLock(locked: boolean): void {
  if (locked) dragLockCount += 1;
  else dragLockCount = Math.max(0, dragLockCount - 1);
  applyOrbitEnabled();
}

export function forceUnlockEditorOrbit(): void {
  dragLockCount = 0;
  applyOrbitEnabled();
}

function applyOrbitEnabled(): void {
  const controls = orbitRef?.current;
  if (!controls) return;
  controls.enabled = dragLockCount === 0;
}
