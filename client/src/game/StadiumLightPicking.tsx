import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { gameStore } from './gameStore';
import { stadiumLightPickRegistry } from './stadiumLightPickRegistry';
import { stadiumLightStore } from './stadiumLightStore';

const CLICK_DRAG_PX = 8;

function isEditorUiTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    !!target.closest('.stadium-light-editor')
  );
}

/** Single-click select / click-empty deselect in U fly mode */
export function StadiumLightPicking() {
  const { camera, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const ndc = useRef(new THREE.Vector2());
  const pointerDown = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      if (!gameStore.getState().debugFreelook || e.button !== 0) return;
      if (isEditorUiTarget(e.target)) return;
      pointerDown.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!gameStore.getState().debugFreelook || e.button !== 0) return;
      if (isEditorUiTarget(e.target)) return;

      const down = pointerDown.current;
      pointerDown.current = null;
      if (!down) return;

      const drag = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (drag > CLICK_DRAG_PX) return;

      const rect = canvas.getBoundingClientRect();
      const w = rect.width || 1;
      const h = rect.height || 1;
      ndc.current.x = ((e.clientX - rect.left) / w) * 2 - 1;
      ndc.current.y = -((e.clientY - rect.top) / h) * 2 + 1;

      raycaster.current.setFromCamera(ndc.current, camera);
      const hits = raycaster.current.intersectObjects(
        [...stadiumLightPickRegistry.getTargets()],
        false,
      );

      if (hits.length > 0) {
        const id = hits[0].object.userData.stadiumLightId as string | undefined;
        if (id) stadiumLightStore.select(id);
        return;
      }
      stadiumLightStore.deselect();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
    };
  }, [camera, gl]);

  return null;
}
