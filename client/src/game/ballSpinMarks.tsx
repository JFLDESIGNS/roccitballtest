import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

function circlePositions(radius: number, segments: number): Float32Array {
  const positions = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    positions[i * 3] = Math.cos(a) * radius;
    positions[i * 3 + 1] = Math.sin(a) * radius;
    positions[i * 3 + 2] = 0;
  }
  return positions;
}

type BallSpinMarksProps = {
  radius: number;
  color?: string;
};

/** Three orthogonal great circles — makes ball rotation easy to read. */
export function BallSpinMarks({ radius, color = '#ffffff' }: BallSpinMarksProps) {
  const markGroup = useMemo(() => {
    const r = radius * 1.003;
    const segments = 72;
    const positions = circlePositions(r, segments);
    const rotations: [number, number, number][] = [
      [0, 0, 0],
      [Math.PI / 2, 0, 0],
      [0, Math.PI / 2, 0],
    ];
    const group = new THREE.Group();
    for (const rot of rotations) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(positions.slice(), 3),
      );
      const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      const line = new THREE.Line(geometry, material);
      line.rotation.set(rot[0], rot[1], rot[2]);
      group.add(line);
    }
    return group;
  }, [radius, color]);

  useEffect(
    () => () => {
      markGroup.traverse((obj) => {
        const line = obj as THREE.Line;
        line.geometry?.dispose();
        const mat = line.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
    },
    [markGroup],
  );

  return <primitive object={markGroup} />;
}
