import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { BALL } from '../shared/Constants';
import {
  BALL_OUTLINE_RENDER_ORDER,
  createBallOutlineMaterial,
} from './ballOutlineMaterial';

/** White screen-space rim on the ball silhouette; visible through geometry. */
export function BallOutlineRing() {
  const geometry = useMemo(
    () => new THREE.SphereGeometry(BALL.radius * 1.045, 48, 36),
    [],
  );
  const material = useMemo(() => createBallOutlineMaterial(2, 2, 2), []);

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
