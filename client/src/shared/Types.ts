export type Team = 'red' | 'blue';

export type Vec3 = { x: number; y: number; z: number };

export type BallStateKind =
  | 'loose'
  | 'pulled'
  | 'held'
  | 'launched'
  | 'scored'
  | 'resetting';

export type PlayerState = {
  id: string;
  name: string;
  team: Team;
  position: Vec3;
  rotation: { yaw: number; pitch: number };
  velocity: Vec3;
  energy: number;
  isSprinting: boolean;
  isBeaming: boolean;
  isHoldingBall: boolean;
};

export type BallState = {
  position: Vec3;
  velocity: Vec3;
  state: BallStateKind;
  holderId: string | null;
  lastTouchPlayerId: string | null;
  lastTouchTeam: Team | null;
};

export type RocketState = {
  id: string;
  ownerId: string;
  position: Vec3;
  direction: Vec3;
  velocity: Vec3;
  spawnTime: number;
};

export type GoalSize = 'large' | 'medium' | 'small';

export type GoalDef = {
  id: string;
  team: Team;
  size: GoalSize;
  points: number;
  center: Vec3;
  ringRadius: number;
};

export type MatchScore = { red: number; blue: number };
