import { ARENA } from '../shared/Constants';
import { arenaBlackMetalMaterial } from './arenaMaterials';

/** Thick black cap along the top edge of perimeter walls */
export const WALL_TOP_TRIM_HEIGHT = 1.18;
const WALL_TOP_TRIM_LENGTH_PAD = 0.22;
const WALL_TOP_TRIM_THICKNESS_PAD = 0.2;

type WallTopTrimProps = {
  length: number;
  thickness?: number;
  /** Local Y of trim center (default: flush on full-height wall) */
  centerY?: number;
};

export function WallTopTrim({
  length,
  thickness = ARENA.wallThickness,
  centerY,
}: WallTopTrimProps) {
  const y =
    centerY ??
    ARENA.wallHeight / 2 + WALL_TOP_TRIM_HEIGHT / 2;

  return (
    <mesh
      position={[0, y, 0]}
      castShadow={false}
      receiveShadow={false}
      material={arenaBlackMetalMaterial}
    >
      <boxGeometry
        args={[
          length + WALL_TOP_TRIM_LENGTH_PAD * 2,
          WALL_TOP_TRIM_HEIGHT,
          thickness + WALL_TOP_TRIM_THICKNESS_PAD,
        ]}
      />
    </mesh>
  );
}
