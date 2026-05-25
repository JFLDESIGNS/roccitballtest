import { useMemo } from 'react';
import * as THREE from 'three';
import { ARENA } from '../shared/Constants';

export const EDITOR_MOVE_GRID = {
  cellM: 4,
  extentM: ARENA.hexRadius * 1.05,
  y: 0.06,
} as const;

export function snapToMoveGrid(
  value: number,
  cell = EDITOR_MOVE_GRID.cellM,
): number {
  return Math.round(value / cell) * cell;
}

export function snapPositionToMoveGrid(
  pos: [number, number, number],
  cell = EDITOR_MOVE_GRID.cellM,
): [number, number, number] {
  return [
    snapToMoveGrid(pos[0], cell),
    pos[1],
    snapToMoveGrid(pos[2], cell),
  ];
}

/** Floor grid for map-editor translate / move spacing */
export function EditorMoveGrid({ visible }: { visible: boolean }) {
  const geo = useMemo(() => {
    const { cellM, extentM } = EDITOR_MOVE_GRID;
    const verts: number[] = [];
    const min = -extentM;
    const max = extentM;
    for (let x = min; x <= max; x += cellM) {
      verts.push(x, 0, min, x, 0, max);
    }
    for (let z = min; z <= max; z += cellM) {
      verts.push(min, 0, z, max, 0, z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(verts, 3),
    );
    return geometry;
  }, []);

  if (!visible) return null;

  return (
    <lineSegments
      geometry={geo}
      position={[0, EDITOR_MOVE_GRID.y, 0]}
      frustumCulled={false}
    >
      <lineBasicMaterial
        color="#7eb8e8"
        transparent
        opacity={0.42}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}
