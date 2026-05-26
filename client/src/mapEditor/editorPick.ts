import type { ThreeEvent } from '@react-three/fiber';
import type { Raycaster, Intersection } from 'three';
import { mapEditorStore } from './mapEditorStore';

/** No-op raycast — mesh stays visible but cannot be picked (gizmo gets the click). */
export function editorDisabledRaycast(): void {}

export function shouldEditorAcceptPick(): boolean {
  return !mapEditorStore.shouldBlockScenePick();
}

export function editorPickHandler(targetId: string) {
  return (e: ThreeEvent<PointerEvent>) => {
    if (!shouldEditorAcceptPick()) return;
    e.stopPropagation();
    mapEditorStore.select(targetId);
  };
}

/** Scene pick that runs a custom select handler (e.g. resolves id in the callback). */
export function editorPickCallback(onSelect: () => void) {
  return (e: ThreeEvent<PointerEvent>) => {
    if (!shouldEditorAcceptPick()) return;
    e.stopPropagation();
    onSelect();
  };
}

export function editorPickRaycast(
  pickEnabled: boolean,
): ((raycaster: Raycaster, intersects: Intersection[]) => void) | undefined {
  return pickEnabled ? undefined : editorDisabledRaycast;
}
