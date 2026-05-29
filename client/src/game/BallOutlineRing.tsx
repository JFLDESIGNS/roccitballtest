import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { BALL } from '../shared/Constants';
import {
  BALL_OUTLINE_RENDER_ORDER,
  createBallOutlineMaterial,
} from './ballOutlineMaterial';

/** Soft screen-space rim inset from the ball silhouette; visible through geometry. */
export function BallOutlineRing() {
  const geometry = useMemo(
    () => new THREE.SphereGeometry(BALL.radius * 0.88, 48, 36),
    [],
  );
  const material = useMemo(() => createBallOutlineMaterial(2.35, 2.35, 2.5), []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return (
    <mesh
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={BALL_OUTLINE_RENDER_ORDER}
    />
  );
}
