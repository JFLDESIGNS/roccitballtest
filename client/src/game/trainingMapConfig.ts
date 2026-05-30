const FT = 0.3048;

export const TRAINING = {
  defenseStand: { x: -34, z: 8, half: 5.5 },
  defenseLauncher: { x: -55, y: 4.6, z: 8 },
  drivingStand: { x: 30, z: 48, halfX: 5.5, halfZ: 4.5 },
  drivingRange: {
    x: 30,
    startZ: 39,
    width: 18,
    length: 300 * FT,
    markerStep: 10 * FT,
  },
} as const;

export function isTrainingDefenseStand(x: number, z: number): boolean {
  return (
    Math.abs(x - TRAINING.defenseStand.x) <= TRAINING.defenseStand.half &&
    Math.abs(z - TRAINING.defenseStand.z) <= TRAINING.defenseStand.half
  );
}

export function isTrainingDrivingRangeStand(x: number, z: number): boolean {
  return (
    Math.abs(x - TRAINING.drivingStand.x) <= TRAINING.drivingStand.halfX &&
    Math.abs(z - TRAINING.drivingStand.z) <= TRAINING.drivingStand.halfZ
  );
}
