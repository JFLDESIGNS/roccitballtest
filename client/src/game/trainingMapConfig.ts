const FT = 0.3048;

export const TRAINING = {
  defenseStand: { x: -10, z: 8, half: 6.5 },
  defenseLaunchers: [
    { x: -57, y: 3.7, z: -2, yaw: Math.PI / 2 },
    { x: -60, y: 5.6, z: 8, yaw: Math.PI / 2 },
    { x: -56, y: 4.4, z: 18, yaw: Math.PI / 2 },
    { x: -43, y: 7.1, z: 25, yaw: Math.PI * 0.72 },
    { x: -43, y: 3.5, z: -10, yaw: Math.PI * 0.28 },
  ],
  drivingStand: { x: 30, z: 50, halfX: 48, halfZ: 22 },
  drivingRange: {
    x: 30,
    startZ: 39,
    width: 72,
    length: 900 * FT,
    markerStep: 50 * FT,
  },
  ballPit: { x: -38, z: 55, radius: 7.5 },
  warehouse: {
    x: 4,
    z: -88,
    width: 150,
    length: 340,
    wallHeight: 54,
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
