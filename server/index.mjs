import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import RAPIER from '@dimforge/rapier3d-compat';

await RAPIER.init();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'client', 'dist');
const port = Number(process.env.PORT || 3000);
const snapshotHz = Number(process.env.SNAPSHOT_HZ || 60);
const BALL_RADIUS = 1.6;
const BALL_SPAWN = { x: 0, y: 2.05, z: 0 };
const ARENA_HEX_RADIUS = 64;
const ARENA_WALL_HEIGHT = 43.7;
const ARENA_FLOOR_Y = 0;
const ARENA_WALL_THICKNESS = 1.2;
const ARENA_OCTAGON_TOP_RADIUS = 11;
const ARENA_OCTAGON_SLOPE_RADIUS = 28;
const ARENA_OCTAGON_PLATFORM_SIZE_MUL = 0.9;
const ARENA_PLATFORM_TOP_HEIGHT = 4.575;
const ARENA_MID_WALL_OCTAGON_SIZE_SCALE = 2;
const BALL_DROP_CENTER_Y = 42.2;
const BALL_DROP_CUBE_SIZE = 15.6;
const BALL_DROP_SPAWN_INSET = 3.3;
const BALL_DROP_DRUM_SCALE = 0.6;
const BALL_DROP_DRUM_RADIUS = 10.2;
const BALL_DROP_DRUM_HEIGHT = 9.6;
const BALL_DROP_DRUM_OFFSET_FT = 10;
const GOAL_POINTS = { large: 1, medium: 2, small: 5 };
const GOAL_RINGS = {
  baseRadius: 7.6,
  tierScale: 0.7,
  backRingScale: 1.32,
  backRingWallOffsetM: 1.75,
  midTopBackRingWallExtraFt: 0.75,
  topRingWallStandoffFt: 15,
  topRingLitWallPullBackFt: 0,
  topRingExtraHeightFt: 3,
  midRingExtraHeightFt: 3,
  midRingWallStandoffFt: 6,
  midRingBackWallOffsetM: 1.75,
  topRingBackWallOffsetM: 1.75,
  scoringVolumeTopLiftFt: 2,
  bottomRingWallStandoffFt: 15,
  ringTiltBottomDeg: -20,
  ringTiltMidDeg: 0,
  ringTiltTopDeg: 20,
  scoringVolumeRadiusScale: 0.25,
  scoringVolumeWallPullbackFt: 6,
  scoringVolumeWallPullbackBottomExtraFt: 1.5,
  scoringVolumeWallPullbackMidTopExtraFt: 1.5,
  scoringVolumeWallPullbackMidExtraFt: 0.6,
  goalBallSuckStickOutFt: 3,
  scoringVolumeMidTopRadiusMult: 0.4,
  scoringVolumeStickOutM: 0.95,
  scoringVolumeStickOutMidM: 1.95,
  scoringVolumeArenaForwardMidM: 0.5,
  scoringVolumeRadiusScaleMidMult: 2.55,
  scoringVolumeStickOutTopM: 1.85,
  scoringVolumeArenaForwardTopM: 0.4,
  scoringVolumeRadiusScaleTopMult: 2.75,
  scoringVolumeRadiusScaleBottomMult: 2.243,
  centerScoreRadiusScale: 0.74,
  centerScoreRadiusScaleMid: 0.86,
  centerScoreRadiusScaleTop: 0.82,
  midScoringSensorDepth: 3.85,
  ringGap: 0.75,
  floorClearance: 3.75,
  tubeScale: 0.14,
  tubeMin: 0.24,
  torusRadialSegments: 8,
  torusTubularSegments: 8,
  faceInsetFromWall: 1.6,
  sensorDepth: 2.75,
};
const GRAVITY_Y = -11;
const BALL_LINEAR_DAMPING = 0.014;
const BALL_RESTITUTION = 0.58;
const BALL_FRICTION = 0.26;
const BALL_ANGULAR_DAMPING = 0.06;
const BALL_MAX_SPEED = 85;
const BALL_LAUNCH_SPIN_SCALE = 1.56;
const BALL_ROCKET_HIT_SPIN_SCALE = 1.84;
const FT_TO_M = 0.3048;
const ROCKET_BALL_HIT_DELTA_V = 33;
const ROCKET_BALL_SPLASH_MIN_FALLOFF = 0.52;
const ROCKET_BALL_NETWORK_GRACE_RADIUS = 2.6;
const BEAM_RANGE = 42 * 0.6;
const BEAM_PULL_ACCEL = 39;
const TRAMPOLINE_BOUNCE_LAUNCH_HEIGHT_FT = 28;
const TRAMPOLINE_BOUNCE_PAD_RADIUS_M = (7 * FT_TO_M) / 2;
const TRAMPOLINE_BOUNCE_PAD_HEIGHT_M = 2 * FT_TO_M;
const TRAMPOLINE_BOUNCE_PAD_WIDTH_SCALE = 4;
const TRAMPOLINE_BOUNCE_PAD_SIZE_SCALE = 1.575;
const TRAMPOLINE_PAD_PLATFORM_HEIGHT_M = 1.4;
const TRAMPOLINE_PAD_PLATFORM_RAISE_FT = 15;
const TRAMPOLINE_DECK_RAISE_M = 0.25;
const TRAMPOLINE_PILLAR_CLEARANCE_M = 8;
const TRAMPOLINE_MID_WALL_PAD_CENTER_INSET_M = 8 + 15 * FT_TO_M;
const TRAMPOLINE_STRENGTH = 3.5;
const TRAMPOLINE_PAD_XZ_SCALE = 1.08;
const TRAMPOLINE_PAD_MAX_ABOVE_DECK_M = 4.5;
const TRAMPOLINE_BALL_COOLDOWN_MS = 200;
const ARENA_PILLAR_HEX_INSET = 1.8;
const ARENA_PILLAR_COLLIDER_RADIUS = 2.95 * 3;
const GOAL_BALL_HIDE_RESET_MS = 950;
const BALL_DROP_COLLISION_GRACE_MS = 5000;
const SERVER_STEP_MAX = 1 / 30;
const SERVER_PHYSICS_STEP = 1 / 60;
const POST_RELEASE_HOLD_BLOCK_MS = 700;
const GOAL_SCORE_COOLDOWN_MS = 5700;
const ROOM_NAME_MAX = 28;
const MIN_LAUNCHED_BALL_SPEED = 18;
const PLAYER_BALL_CONTACT_RADIUS = BALL_RADIUS + 1.35;
const PLAYER_BALL_CONTACT_VERTICAL = 3.1;
const PLAYER_BALL_CONTACT_PUSH = 3.8;
const PLAYER_BALL_CONTACT_VEL_INHERIT = 0.28;
const PLAYER_BALL_CONTACT_MAX_DELTA_V = 2.2;

const BALL_DROP_CUBE_HALF = BALL_DROP_CUBE_SIZE * 0.5;
const BALL_DROP_DRUM_HEIGHT_M = BALL_DROP_DRUM_HEIGHT * BALL_DROP_DRUM_SCALE;
const BALL_DROP_DRUM_TOP_Y =
  BALL_DROP_CENTER_Y - BALL_DROP_CUBE_HALF + BALL_DROP_DRUM_OFFSET_FT * FT_TO_M;
const BALL_DROP_DRUM_BOTTOM_Y = BALL_DROP_DRUM_TOP_Y - BALL_DROP_DRUM_HEIGHT_M;
const BALL_DROP_SPAWN = {
  x: BALL_SPAWN.x,
  y: BALL_DROP_CENTER_Y + BALL_DROP_CUBE_HALF - BALL_DROP_SPAWN_INSET,
  z: BALL_SPAWN.z,
};
const BALL_DROP_RELEASE = {
  x: BALL_SPAWN.x,
  y: BALL_DROP_DRUM_BOTTOM_Y - BALL_RADIUS - 2.2,
  z: BALL_SPAWN.z,
};

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.flac', 'audio/flac'],
  ['.fbx', 'application/octet-stream'],
]);

const rooms = new Map();
const clients = new Map();

function createServerBall() {
  return {
    position: { ...BALL_SPAWN },
    velocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    visible: true,
    updatedAt: Date.now(),
  };
}

function octagonVertices(radius) {
  const vertices = [];
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI / 4) * i - Math.PI / 8;
    vertices.push({ x: radius * Math.cos(angle), z: radius * Math.sin(angle) });
  }
  return vertices;
}

function hexVertices(radius) {
  const vertices = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    vertices.push({ x: radius * Math.cos(angle), z: radius * Math.sin(angle) });
  }
  return vertices;
}

function buildHexWallSegments(radius, wallThickness) {
  const vertices = hexVertices(radius);
  return vertices.map((a, i) => {
    const b = vertices[(i + 1) % vertices.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    const dirX = dx / length;
    const dirZ = dz / length;
    const midX = (a.x + b.x) / 2;
    const midZ = (a.z + b.z) / 2;
    let nx = dirZ;
    let nz = -dirX;
    if (midX * nx + midZ * nz < 0) {
      nx = -nx;
      nz = -nz;
    }
    const offset = wallThickness / 2 + 0.05;
    return {
      x: midX + nx * offset,
      z: midZ + nz * offset,
      y: ARENA_WALL_HEIGHT / 2,
      yaw: Math.atan2(-dirZ, dirX),
      length,
    };
  });
}

function listOctagonPlatformPlacements() {
  return [
    { x: 0, z: 0, sizeScale: 1 },
    ...hexVertices(ARENA_HEX_RADIUS).map((corner) => ({
      x: corner.x,
      z: corner.z,
      sizeScale:
        Math.abs(corner.x) <= 0.5 ? ARENA_MID_WALL_OCTAGON_SIZE_SCALE : 1,
    })),
  ];
}

function getArenaCornerPillarLayouts() {
  return hexVertices(ARENA_HEX_RADIUS - ARENA_PILLAR_HEX_INSET).map((corner) => ({
    x: corner.x,
    z: corner.z,
  }));
}

function trampolinePlatformTopY() {
  return (
    ARENA_FLOOR_Y +
    TRAMPOLINE_PAD_PLATFORM_HEIGHT_M +
    TRAMPOLINE_PAD_PLATFORM_RAISE_FT * FT_TO_M +
    TRAMPOLINE_DECK_RAISE_M
  );
}

function trampolinePadRadius() {
  return (
    TRAMPOLINE_BOUNCE_PAD_RADIUS_M *
    TRAMPOLINE_BOUNCE_PAD_WIDTH_SCALE *
    TRAMPOLINE_BOUNCE_PAD_SIZE_SCALE
  );
}

function goalFlankPillarPositions(team) {
  const face = goalEndFaceX();
  const pillars = getArenaCornerPillarLayouts()
    .filter((p) => (team === 'red' ? p.x < -20 : p.x > 20))
    .filter((p) => Math.abs(p.z) > 16)
    .sort((a, b) => b.z - a.z);
  const x = team === 'red' ? -face + 10 : face - 10;
  if (pillars.length >= 2) return pillars.map((p) => ({ x, z: p.z }));
  return [
    { x, z: 28 },
    { x, z: -28 },
  ];
}

function getBounceTrampolinePads() {
  const radius = trampolinePadRadius();
  const platformTopY = trampolinePlatformTopY();
  const pads = [];
  for (const team of ['red', 'blue']) {
    for (const p of goalFlankPillarPositions(team)) {
      pads.push({
        x:
          p.x +
          (team === 'red'
            ? TRAMPOLINE_PILLAR_CLEARANCE_M
            : -TRAMPOLINE_PILLAR_CLEARANCE_M),
        z: p.z,
        radius,
        platformTopY,
      });
    }
  }
  for (const p of getArenaCornerPillarLayouts().filter((pillar) => Math.abs(pillar.x) <= 0.5)) {
    const towardCenterZ = -Math.sign(p.z || 1);
    pads.push({
      x: p.x,
      z: p.z + towardCenterZ * TRAMPOLINE_MID_WALL_PAD_CENTER_INSET_M,
      radius,
      platformTopY,
    });
  }
  return pads;
}

const TRAMPOLINE_PADS = getBounceTrampolinePads();

function trampolineDeckSurfaceY(pad) {
  return pad.platformTopY + TRAMPOLINE_BOUNCE_PAD_HEIGHT_M;
}

function trampolineLaunchSpeedY() {
  const height = TRAMPOLINE_BOUNCE_LAUNCH_HEIGHT_FT * FT_TO_M;
  return Math.sqrt(2 * Math.abs(GRAVITY_Y) * height) * TRAMPOLINE_STRENGTH;
}

function buildOctagonPlatformBuffers(topRadius, slopeRadius, topY, bottomY) {
  const top = octagonVertices(topRadius);
  const bottom = octagonVertices(slopeRadius);
  const positions = [];
  const indices = [];
  const addVertex = (x, y, z) => {
    positions.push(x, y, z);
    return positions.length / 3 - 1;
  };
  const centerTop = addVertex(0, topY, 0);
  const topIdx = top.map((v) => addVertex(v.x, topY, v.z));
  const bottomIdx = bottom.map((v) => addVertex(v.x, bottomY, v.z));
  for (let i = 0; i < 8; i += 1) {
    const next = (i + 1) % 8;
    indices.push(centerTop, topIdx[next], topIdx[i]);
    indices.push(topIdx[i], topIdx[next], bottomIdx[next]);
    indices.push(topIdx[i], bottomIdx[next], bottomIdx[i]);
  }
  return {
    vertices: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
}

function ringRadiusForTier(tier) {
  return GOAL_RINGS.baseRadius * GOAL_RINGS.tierScale ** tier;
}

function stackedRingCenters() {
  const r0 = ringRadiusForTier(0);
  const r1 = ringRadiusForTier(1);
  const r2 = ringRadiusForTier(2);
  const gap = GOAL_RINGS.ringGap;
  const bottomY = r0 + GOAL_RINGS.floorClearance;
  const midY = bottomY + r0 + r1 + gap + GOAL_RINGS.midRingExtraHeightFt * FT_TO_M;
  const topY =
    bottomY +
    r0 +
    r1 +
    gap +
    r1 +
    r2 +
    gap +
    GOAL_RINGS.topRingExtraHeightFt * FT_TO_M;
  return { bottomY, midY, topY };
}

function goalEndFaceX() {
  return (ARENA_HEX_RADIUS * Math.sqrt(3)) / 2;
}

function goalWallPositions() {
  const face = goalEndFaceX();
  const inset = GOAL_RINGS.faceInsetFromWall;
  return { red: -face + inset, blue: face - inset };
}

function goalRingWallStandoffM(tier) {
  if (tier === 2) return GOAL_RINGS.topRingWallStandoffFt * FT_TO_M;
  if (tier === 1) return GOAL_RINGS.midRingWallStandoffFt * FT_TO_M;
  return GOAL_RINGS.bottomRingWallStandoffFt * FT_TO_M;
}

function goalRingCenterX(team, wallX, tier) {
  const standoff = goalRingWallStandoffM(tier);
  return team === 'red' ? wallX + standoff : wallX - standoff;
}

function goalRingDisplayX(centerX, team, size) {
  if (size === 'small') {
    const pullBack = GOAL_RINGS.topRingLitWallPullBackFt * FT_TO_M;
    return team === 'red' ? centerX - pullBack : centerX + pullBack;
  }
  return centerX;
}

function buildWallRings(team, wallX) {
  const { bottomY, midY, topY } = stackedRingCenters();
  const tiers = [
    { size: 'large', tier: 0, y: bottomY, points: GOAL_POINTS.large },
    { size: 'medium', tier: 1, y: midY, points: GOAL_POINTS.medium },
    { size: 'small', tier: 2, y: topY, points: GOAL_POINTS.small },
  ];
  return tiers.map((t) => {
    const x = goalRingCenterX(team, wallX, t.tier);
    return {
      id: `${team}-ring-${t.size}`,
      team,
      size: t.size,
      points: t.points,
      center: { x: goalRingDisplayX(x, team, t.size), y: t.y, z: 0 },
      ringRadius: ringRadiusForTier(t.tier),
    };
  });
}

function buildGoals() {
  const { red, blue } = goalWallPositions();
  return [...buildWallRings('red', red), ...buildWallRings('blue', blue)];
}

const ARENA_GOALS = buildGoals();

function ringTube(radius) {
  return Math.max(GOAL_RINGS.tubeMin, radius * GOAL_RINGS.tubeScale);
}

function ringTiltX(team, size) {
  const deg =
    size === 'large'
      ? GOAL_RINGS.ringTiltBottomDeg
      : size === 'medium'
        ? GOAL_RINGS.ringTiltMidDeg
        : GOAL_RINGS.ringTiltTopDeg;
  const rad = (deg * Math.PI) / 180;
  return team === 'red' ? rad : -rad;
}

function goalScoreHoleRadius(ringRadius, size = 'large') {
  const scale =
    size === 'small'
      ? GOAL_RINGS.centerScoreRadiusScaleTop
      : size === 'medium'
        ? GOAL_RINGS.centerScoreRadiusScaleMid
        : GOAL_RINGS.centerScoreRadiusScale;
  return ringRadius * scale;
}

function goalScoringSensorDepth(size) {
  if (size === 'medium') return GOAL_RINGS.midScoringSensorDepth;
  return GOAL_RINGS.sensorDepth;
}

function goalScoringStickOutM(size) {
  if (size === 'medium') return GOAL_RINGS.scoringVolumeStickOutMidM;
  if (size === 'small') return GOAL_RINGS.scoringVolumeStickOutTopM;
  return GOAL_RINGS.scoringVolumeStickOutM;
}

function goalScoringArenaForwardM(size) {
  if (size === 'medium') return GOAL_RINGS.scoringVolumeArenaForwardMidM;
  if (size === 'small') return GOAL_RINGS.scoringVolumeArenaForwardTopM;
  return 0;
}

function goalScoringWallInsetM(size) {
  const half = goalScoringSensorDepth(size) / 2;
  return Math.max(0, half - goalScoringStickOutM(size));
}

function goalScoringWallPullbackM(size) {
  const bottomExtra =
    size === 'large' ? GOAL_RINGS.scoringVolumeWallPullbackBottomExtraFt : 0;
  const midTopExtra =
    size === 'large' ? 0 : GOAL_RINGS.scoringVolumeWallPullbackMidTopExtraFt;
  const midOnlyExtra =
    size === 'medium' ? GOAL_RINGS.scoringVolumeWallPullbackMidExtraFt : 0;
  return (
    (GOAL_RINGS.scoringVolumeWallPullbackFt +
      bottomExtra +
      midTopExtra +
      midOnlyExtra) *
    FT_TO_M
  );
}

function goalScoringCenter(goal) {
  const inset = goalScoringWallInsetM(goal.size);
  const forward = goalScoringArenaForwardM(goal.size);
  const pullBack = goalScoringWallPullbackM(goal.size);
  const towardCourt = goal.team === 'red' ? 1 : -1;
  const yLiftFt = goal.size === 'small' ? GOAL_RINGS.scoringVolumeTopLiftFt : 0;
  return {
    x:
      goal.center.x +
      (goal.team === 'red' ? -inset : inset) +
      towardCourt * (forward - pullBack),
    y: goal.center.y + yLiftFt * FT_TO_M,
    z: goal.center.z,
  };
}

function goalScoringCylinderParams(goal) {
  const holeR = goalScoreHoleRadius(goal.ringRadius, goal.size);
  const pad =
    goal.size === 'small'
      ? BALL_RADIUS * 0.52
      : goal.size === 'medium'
        ? BALL_RADIUS * 0.58
        : BALL_RADIUS * 0.45;
  const baseRadius = holeR + pad;
  const radiusScale =
    goal.size === 'large'
      ? GOAL_RINGS.scoringVolumeRadiusScale *
        GOAL_RINGS.scoringVolumeRadiusScaleBottomMult
      : goal.size === 'medium'
        ? GOAL_RINGS.scoringVolumeRadiusScale *
          GOAL_RINGS.scoringVolumeRadiusScaleMidMult *
          GOAL_RINGS.scoringVolumeMidTopRadiusMult
        : GOAL_RINGS.scoringVolumeRadiusScale *
          GOAL_RINGS.scoringVolumeRadiusScaleTopMult *
          GOAL_RINGS.scoringVolumeMidTopRadiusMult;
  return { radius: baseRadius * radiusScale, halfHeight: goalScoringSensorDepth(goal.size) / 2 };
}

function goalScoringSlack(size, speed = 0) {
  const speedPad = Math.min(BALL_RADIUS * 3.2, speed * 0.032);
  if (size === 'small') return { plane: BALL_RADIUS * 0.85 + speedPad, hole: BALL_RADIUS * 0.95 + speedPad * 0.5 };
  if (size === 'medium') return { plane: BALL_RADIUS * 1.05 + speedPad, hole: BALL_RADIUS * 1.1 + speedPad * 0.65 };
  return { plane: BALL_RADIUS * 0.75 + speedPad, hole: BALL_RADIUS * 0.85 + speedPad * 0.55 };
}

function ballToGoalScoringLocal(ballPos, goal) {
  const c = goalScoringCenter(goal);
  const px = ballPos.x - c.x;
  const py = ballPos.y - c.y;
  const pz = ballPos.z - c.z;
  const tilt = ringTiltX(goal.team, goal.size);
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);
  const lx = pz;
  const ly = py;
  const lz = -px;
  const lyRing = ly * cosT + lz * sinT;
  const lzRing = -ly * sinT + lz * cosT;
  return { lx, lyRing, lzRing };
}

function volumeBounds(goal, speed) {
  const slack = goalScoringSlack(goal.size, speed);
  const { radius, halfHeight } = goalScoringCylinderParams(goal);
  const rScale = GOAL_RINGS.scoringVolumeRadiusScale;
  return {
    radius: radius + (slack.hole + BALL_RADIUS * 0.42) * rScale,
    halfDepth: halfHeight + slack.plane + BALL_RADIUS * 0.35,
  };
}

function pointInsideGoalCylinder(local, radius, halfDepth) {
  return Math.hypot(local.lx, local.lyRing) <= radius && Math.abs(local.lzRing) <= halfDepth;
}

function segmentIntersectsGoalCylinder(a, b, radius, halfDepth) {
  if (pointInsideGoalCylinder(a, radius, halfDepth)) return true;
  if (pointInsideGoalCylinder(b, radius, halfDepth)) return true;
  const dlx = b.lx - a.lx;
  const dly = b.lyRing - a.lyRing;
  const dlz = b.lzRing - a.lzRing;
  for (const lzPlane of [-halfDepth, halfDepth]) {
    if (Math.abs(dlz) < 1e-8) continue;
    const s = (lzPlane - a.lzRing) / dlz;
    if (s < 0 || s > 1) continue;
    const lx = a.lx + dlx * s;
    const ly = a.lyRing + dly * s;
    if (Math.hypot(lx, ly) <= radius) return true;
  }
  const dd = dlx * dlx + dly * dly;
  let s = 0;
  if (dd > 1e-8) s = Math.max(0, Math.min(1, -(a.lx * dlx + a.lyRing * dly) / dd));
  const cx = a.lx + dlx * s;
  const cy = a.lyRing + dly * s;
  const cz = a.lzRing + dlz * s;
  return Math.hypot(cx, cy) <= radius && Math.abs(cz) <= halfDepth;
}

function goalHitFromGoal(goal) {
  const scoringTeam = goal.team === 'red' ? 'blue' : 'red';
  return {
    points: goal.points,
    scoringTeam,
    goalTeam: goal.team,
    goalId: goal.id,
    goalPos: { ...goal.center },
  };
}

function checkGoalScoreSegment(from, to, speed = 0) {
  let best = null;
  for (const goal of ARENA_GOALS) {
    const a = ballToGoalScoringLocal(from, goal);
    const b = ballToGoalScoringLocal(to, goal);
    const { radius, halfDepth } = volumeBounds(goal, speed);
    if (!segmentIntersectsGoalCylinder(a, b, radius, halfDepth)) continue;
    const planeDist = Math.min(Math.abs(a.lzRing), Math.abs(b.lzRing));
    const hit = { ...goalHitFromGoal(goal), planeDist };
    if (!best || hit.planeDist < best.planeDist) best = hit;
  }
  if (!best) return null;
  const { planeDist: _planeDist, ...hit } = best;
  return hit;
}

function multiplyQuat(a, b) {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

function quatFromAxisAngle(axis, angle) {
  const half = angle * 0.5;
  const s = Math.sin(half);
  return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(half) };
}

function buildTorusTrimesh(majorRadius, tubeRadius, radialSegments, tubularSegments) {
  const positions = [];
  const indices = [];
  for (let j = 0; j <= radialSegments; j += 1) {
    for (let i = 0; i <= tubularSegments; i += 1) {
      const u = (i / tubularSegments) * Math.PI * 2;
      const v = (j / radialSegments) * Math.PI * 2;
      positions.push(
        (majorRadius + tubeRadius * Math.cos(v)) * Math.cos(u),
        (majorRadius + tubeRadius * Math.cos(v)) * Math.sin(u),
        tubeRadius * Math.sin(v),
      );
    }
  }
  for (let j = 1; j <= radialSegments; j += 1) {
    for (let i = 1; i <= tubularSegments; i += 1) {
      const a = (tubularSegments + 1) * j + i - 1;
      const b = (tubularSegments + 1) * (j - 1) + i - 1;
      const c = (tubularSegments + 1) * (j - 1) + i;
      const d = (tubularSegments + 1) * j + i;
      indices.push(a, b, d, b, c, d);
    }
  }
  return { vertices: new Float32Array(positions), indices: new Uint32Array(indices) };
}

function addArenaStructureColliders(world) {
  const ballDropColliders = [];
  const topBase = ARENA_OCTAGON_TOP_RADIUS * ARENA_OCTAGON_PLATFORM_SIZE_MUL;
  const slopeBase = ARENA_OCTAGON_SLOPE_RADIUS * ARENA_OCTAGON_PLATFORM_SIZE_MUL;
  for (const placement of listOctagonPlatformPlacements()) {
    const { vertices, indices } = buildOctagonPlatformBuffers(
      topBase * placement.sizeScale,
      slopeBase * placement.sizeScale,
      ARENA_PLATFORM_TOP_HEIGHT,
      ARENA_FLOOR_Y,
    );
    world.createCollider(
      RAPIER.ColliderDesc.trimesh(vertices, indices)
        .setTranslation(placement.x, 0, placement.z)
        .setRestitution(BALL_RESTITUTION * 0.85)
        .setFriction(0.55),
    );
  }

  const ballDropCube = world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      BALL_DROP_CUBE_HALF,
      BALL_DROP_CUBE_HALF,
      BALL_DROP_CUBE_HALF,
    )
      .setTranslation(0, BALL_DROP_CENTER_Y, 0)
      .setRestitution(BALL_RESTITUTION * 0.8)
      .setFriction(BALL_FRICTION),
  );
  ballDropColliders.push(ballDropCube);

  const drumRadius = BALL_DROP_DRUM_RADIUS * BALL_DROP_DRUM_SCALE;
  const drumHeightHalf = BALL_DROP_DRUM_HEIGHT_M * 0.5;
  const drumCenterY = BALL_DROP_DRUM_BOTTOM_Y + drumHeightHalf;
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8;
    const halfAngle = angle * 0.5;
    const drumPanel = world.createCollider(
      RAPIER.ColliderDesc.cuboid(drumRadius * 0.42, drumHeightHalf, 0.35)
        .setTranslation(
          Math.cos(angle) * drumRadius * 0.86,
          drumCenterY,
          Math.sin(angle) * drumRadius * 0.86,
        )
        .setRotation({ x: 0, y: Math.sin(halfAngle), z: 0, w: Math.cos(halfAngle) })
        .setRestitution(BALL_RESTITUTION * 0.8)
        .setFriction(BALL_FRICTION),
    );
    ballDropColliders.push(drumPanel);
  }

  for (const goal of ARENA_GOALS) {
    const { vertices, indices } = buildTorusTrimesh(
      goal.ringRadius,
      ringTube(goal.ringRadius),
      GOAL_RINGS.torusRadialSegments,
      GOAL_RINGS.torusTubularSegments,
    );
    const qY = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2);
    const qX = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, ringTiltX(goal.team, goal.size));
    world.createCollider(
      RAPIER.ColliderDesc.trimesh(vertices, indices)
        .setTranslation(goal.center.x, goal.center.y, goal.center.z)
        .setRotation(multiplyQuat(qY, qX))
        .setRestitution(BALL_RESTITUTION * 1.12)
        .setFriction(0.12),
    );
  }

  for (const pad of TRAMPOLINE_PADS) {
    const stemHeight = Math.max(0.1, pad.platformTopY - ARENA_FLOOR_Y);
    const stemRadius = pad.radius * 1.15 * 1.05;
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(stemHeight * 0.5, stemRadius)
        .setTranslation(pad.x, ARENA_FLOOR_Y + stemHeight * 0.5, pad.z)
        .setRestitution(0.35)
        .setFriction(0.55),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(
        TRAMPOLINE_BOUNCE_PAD_HEIGHT_M * 0.5,
        pad.radius,
      )
        .setTranslation(
          pad.x,
          pad.platformTopY + TRAMPOLINE_BOUNCE_PAD_HEIGHT_M * 0.5,
          pad.z,
        )
        .setRestitution(0.35)
        .setFriction(0.55),
    );
  }

  for (const pillar of getArenaCornerPillarLayouts()) {
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(ARENA_WALL_HEIGHT * 0.5, ARENA_PILLAR_COLLIDER_RADIUS)
        .setTranslation(pillar.x, ARENA_FLOOR_Y + ARENA_WALL_HEIGHT * 0.5, pillar.z)
        .setRestitution(BALL_RESTITUTION)
        .setFriction(BALL_FRICTION),
    );
  }

  return { ballDropColliders };
}

function createRoomPhysics() {
  const world = new RAPIER.World({ x: 0, y: GRAVITY_Y, z: 0 });
  world.integrationParameters.dt = SERVER_PHYSICS_STEP;

  const ballBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(BALL_SPAWN.x, BALL_SPAWN.y, BALL_SPAWN.z)
      .setLinearDamping(BALL_LINEAR_DAMPING)
      .setAngularDamping(BALL_ANGULAR_DAMPING)
      .setCcdEnabled(true),
  );
  world.createCollider(
    RAPIER.ColliderDesc.ball(BALL_RADIUS)
      .setDensity(3.5)
      .setRestitution(BALL_RESTITUTION)
      .setFriction(BALL_FRICTION),
    ballBody,
  );

  const floorThickness = 0.25;
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      ARENA_HEX_RADIUS + 8,
      floorThickness,
      ARENA_HEX_RADIUS + 8,
    )
      .setTranslation(0, ARENA_FLOOR_Y - floorThickness, 0)
      .setRestitution(BALL_RESTITUTION)
      .setFriction(BALL_FRICTION),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      ARENA_HEX_RADIUS + 8,
      floorThickness,
      ARENA_HEX_RADIUS + 8,
    )
      .setTranslation(0, ARENA_WALL_HEIGHT + floorThickness, 0)
      .setRestitution(BALL_RESTITUTION)
      .setFriction(BALL_FRICTION),
  );

  const halfHeight = ARENA_WALL_HEIGHT * 0.5;
  const halfThickness = ARENA_WALL_THICKNESS * 0.5;
  for (const wall of buildHexWallSegments(ARENA_HEX_RADIUS, ARENA_WALL_THICKNESS)) {
    const yaw = wall.yaw;
    const halfYaw = yaw * 0.5;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(wall.length * 0.5, halfHeight, halfThickness)
        .setTranslation(
          wall.x,
          wall.y,
          wall.z,
        )
        .setRotation({ x: 0, y: Math.sin(halfYaw), z: 0, w: Math.cos(halfYaw) })
        .setRestitution(BALL_RESTITUTION)
        .setFriction(BALL_FRICTION),
    );
  }
  const structures = addArenaStructureColliders(world);

  return {
    world,
    ballBody,
    accumulator: 0,
    ballDropColliders: structures.ballDropColliders,
  };
}

function getRoom(roomId) {
  return getOrCreateRoom(roomId);
}

function roomMaxPlayers(mode) {
  return mode === '2v2' ? 4 : 2;
}

function sanitizeRoomMode(mode) {
  return mode === '2v2' ? '2v2' : '1v1';
}

function sanitizeRoomName(name, mode, roomId) {
  if (typeof name === 'string' && name.trim()) {
    return name.trim().slice(0, ROOM_NAME_MAX);
  }
  return `${mode.toUpperCase()} Lobby ${roomId.slice(0, 4)}`;
}

function createRoomRecord(id, options = {}) {
  const mode = sanitizeRoomMode(options.mode);
  return {
    id,
    name: sanitizeRoomName(options.name, mode, id),
    mode,
    maxPlayers: roomMaxPlayers(mode),
    players: new Map(),
    hostId: null,
    ball: createServerBall(),
    match: null,
    physics: createRoomPhysics(),
    lastBallPosition: { ...BALL_SPAWN },
    goalLockedUntil: 0,
    ballHiddenUntil: 0,
    ballPadUntil: 0,
    ballDropCollisionDisabledUntil: 0,
    lastTouch: null,
    createdAt: Date.now(),
  };
}

function getOrCreateRoom(roomId, options = {}) {
  const id = typeof roomId === 'string' && roomId.trim() ? roomId.trim() : 'main';
  let room = rooms.get(id);
  if (!room) {
    room = createRoomRecord(id, options);
    rooms.set(id, room);
  }
  return room;
}

function roomSummary(room) {
  const players = [...room.players.values()];
  const readyCount = players.filter((player) => player.playReady).length;
  return {
    id: room.id,
    name: room.name,
    mode: room.mode,
    maxPlayers: room.maxPlayers,
    playerCount: players.length,
    readyCount,
    inMatch: Boolean(room.match && room.match.phase !== 'menu'),
  };
}

function listRoomSummaries() {
  return [...rooms.values()]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(roomSummary);
}

function assignRoomTeamSlots(room) {
  const counters = { red: 0, blue: 0 };
  for (const player of room.players.values()) {
    player.teamSlot = counters[player.team];
    counters[player.team] += 1;
  }
}

function sendFrame(socket, data) {
  const payload = Buffer.from(data);
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x81, payload.length]);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  try {
    socket.write(Buffer.concat([header, payload]));
  } catch {
    removeClient(socket);
  }
}

function sendJson(socket, msg) {
  if (socket.destroyed) return;
  sendFrame(socket, JSON.stringify(msg));
}

function encodeCloseFrame() {
  return Buffer.from([0x88, 0x00]);
}

function decodeFrames(socket, chunk) {
  socket.wsBuffer = Buffer.concat([socket.wsBuffer ?? Buffer.alloc(0), chunk]);
  const messages = [];
  let buffer = socket.wsBuffer;

  while (buffer.length >= 2) {
    let offset = 0;
    const b0 = buffer[offset++];
    const b1 = buffer[offset++];
    const opcode = b0 & 0x0f;
    const masked = Boolean(b1 & 0x80);
    let length = b1 & 0x7f;

    if (length === 126) {
      if (buffer.length < offset + 2) break;
      length = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (buffer.length < offset + 8) break;
      length = Number(buffer.readBigUInt64BE(offset));
      offset += 8;
    }

    let mask;
    if (masked) {
      if (buffer.length < offset + 4) break;
      mask = buffer.subarray(offset, offset + 4);
      offset += 4;
    }
    if (buffer.length < offset + length) break;

    let payload = buffer.subarray(offset, offset + length);
    buffer = buffer.subarray(offset + length);
    if (masked && mask) {
      payload = Buffer.from(payload.map((value, i) => value ^ mask[i % 4]));
    }

    if (opcode === 0x8) {
      socket.end(encodeCloseFrame());
      continue;
    }
    if (opcode === 0x9) {
      socket.write(Buffer.from([0x8a, 0x00]));
      continue;
    }
    if (opcode === 0x1) {
      messages.push(payload.toString('utf8'));
    }
  }

  socket.wsBuffer = buffer;
  return messages;
}

function removeClient(socket) {
  const client = clients.get(socket);
  if (!client) return;
  clients.delete(socket);
  const room = rooms.get(client.roomId);
  room?.players.delete(client.id);
  if (room?.hostId === client.id) {
    room.hostId = [...room.players.keys()][0] ?? null;
    room.match = null;
  }
  if (room) assignRoomTeamSlots(room);
  if (room && room.players.size === 0) rooms.delete(room.id);
}

function sanitizeProfile(profile = {}) {
  const name =
    typeof profile.name === 'string' && profile.name.trim()
      ? profile.name.trim().slice(0, 18)
      : 'Player';
  const jerseyNumber = Number.isFinite(profile.jerseyNumber)
    ? Math.max(0, Math.min(99, Math.floor(profile.jerseyNumber)))
    : 0;
  return { name, jerseyNumber };
}

function sanitizeTeam(team, room) {
  let red = 0;
  let blue = 0;
  for (const player of room.players.values()) {
    if (player.team === 'red') red += 1;
    if (player.team === 'blue') blue += 1;
  }
  const maxTeamPlayers = Math.max(1, Math.floor(room.maxPlayers / 2));
  if (team === 'red' && red < maxTeamPlayers) return 'red';
  if (team === 'blue' && blue < maxTeamPlayers) return 'blue';
  if (red >= maxTeamPlayers) return 'blue';
  if (blue >= maxTeamPlayers) return 'red';
  return red <= blue ? 'red' : 'blue';
}

function sanitizeVec3(value, fallback = { x: 0, y: 0, z: 0 }) {
  return {
    x: Number.isFinite(value?.x) ? value.x : fallback.x,
    y: Number.isFinite(value?.y) ? value.y : fallback.y,
    z: Number.isFinite(value?.z) ? value.z : fallback.z,
  };
}

function sanitizeMatchState(match = {}) {
  return {
    phase:
      ['intro', 'loading', 'playing', 'paused', 'countdown'].includes(match.phase)
        ? match.phase
        : 'playing',
    score: {
      red: Number.isFinite(match.score?.red)
        ? Math.max(0, Math.floor(match.score.red))
        : 0,
      blue: Number.isFinite(match.score?.blue)
        ? Math.max(0, Math.floor(match.score.blue))
        : 0,
    },
    timeLeft: Number.isFinite(match.timeLeft)
      ? Math.max(0, Math.ceil(match.timeLeft))
      : 0,
    countdown: Number.isFinite(match.countdown)
      ? Math.max(0, Math.ceil(match.countdown))
      : 0,
    arenaSettleCountdown: Number.isFinite(match.arenaSettleCountdown)
      ? Math.max(0, Math.ceil(match.arenaSettleCountdown))
      : 0,
    loadCountdown: Number.isFinite(match.loadCountdown)
      ? Math.max(0, Math.ceil(match.loadCountdown))
      : 0,
    ballFrozen: Boolean(match.ballFrozen),
  };
}

function playerAimDirection(player) {
  const yaw = Number.isFinite(player.rotation?.yaw) ? player.rotation.yaw : 0;
  const pitch = Number.isFinite(player.rotation?.pitch) ? player.rotation.pitch : 0;
  const cp = Math.cos(pitch);
  return {
    x: -Math.sin(yaw) * cp,
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * cp,
  };
}

function ensureLaunchVelocity(player, velocity, ballState) {
  const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
  if (ballState !== 'launched' || speed >= MIN_LAUNCHED_BALL_SPEED) {
    return velocity;
  }
  const aim = playerAimDirection(player);
  const scale =
    speed > 0.001
      ? MIN_LAUNCHED_BALL_SPEED / speed
      : 0;
  if (scale > 0) {
    return {
      x: velocity.x * scale,
      y: velocity.y * scale,
      z: velocity.z * scale,
    };
  }
  return {
    x: aim.x * MIN_LAUNCHED_BALL_SPEED,
    y: aim.y * MIN_LAUNCHED_BALL_SPEED + 3,
    z: aim.z * MIN_LAUNCHED_BALL_SPEED,
  };
}

function clampBallSpeed(ball) {
  const speed = Math.hypot(ball.velocity.x, ball.velocity.y, ball.velocity.z);
  if (speed <= BALL_MAX_SPEED || speed <= 0.0001) return;
  const scale = BALL_MAX_SPEED / speed;
  ball.velocity.x *= scale;
  ball.velocity.y *= scale;
  ball.velocity.z *= scale;
}

function markRoomLastTouch(room, player, position) {
  if (!player) return;
  room.lastTouch = {
    playerId: player.id,
    playerName: player.name,
    team: player.team,
    position: sanitizeVec3(position, player.position),
    updatedAt: Date.now(),
  };
}

function setPhysicsBall(room, position, velocity, angularVelocity = null) {
  if (!room.physics) room.physics = createRoomPhysics();
  const body = room.physics.ballBody;
  body.setTranslation(position, true);
  body.setLinvel(velocity, true);
  body.setAngvel(
    angularVelocity ?? {
      x: (velocity.z / BALL_RADIUS) * BALL_LAUNCH_SPIN_SCALE,
      y: 0,
      z: (-velocity.x / BALL_RADIUS) * BALL_LAUNCH_SPIN_SCALE,
    },
    true,
  );
}

function syncBallFromPhysics(room, now) {
  if (!room.physics) room.physics = createRoomPhysics();
  const body = room.physics.ballBody;
  const t = body.translation();
  const v = body.linvel();
  const av = body.angvel();
  room.ball = {
    position: { x: t.x, y: t.y, z: t.z },
    velocity: { x: v.x, y: v.y, z: v.z },
    angularVelocity: { x: av.x, y: av.y, z: av.z },
    visible: now >= (room.ballHiddenUntil ?? 0),
    updatedAt: now,
  };
}

function setBallDropCollisionEnabled(room, enabled) {
  if (!room.physics) room.physics = createRoomPhysics();
  for (const collider of room.physics.ballDropColliders ?? []) {
    if (typeof collider.setEnabled === 'function') collider.setEnabled(enabled);
  }
}

function disableBallDropCollisionForRelease(room, now) {
  room.ballDropCollisionDisabledUntil = now + BALL_DROP_COLLISION_GRACE_MS;
  setBallDropCollisionEnabled(room, false);
}

function updateBallDropCollisionGate(room, now) {
  if (!room.ballDropCollisionDisabledUntil) return;
  if (now < room.ballDropCollisionDisabledUntil) return;
  room.ballDropCollisionDisabledUntil = 0;
  setBallDropCollisionEnabled(room, true);
}

function findServerTrampolinePad(x, z) {
  for (const pad of TRAMPOLINE_PADS) {
    if (Math.hypot(x - pad.x, z - pad.z) <= pad.radius * TRAMPOLINE_PAD_XZ_SCALE) {
      return pad;
    }
  }
  return null;
}

function applyServerTrampolinePads(room, now) {
  if (!room.physics || now < (room.ballPadUntil ?? 0)) return;
  const body = room.physics.ballBody;
  const t = body.translation();
  const pad = findServerTrampolinePad(t.x, t.z);
  if (!pad) return;

  const deckY = trampolineDeckSurfaceY(pad);
  if (t.y > deckY + TRAMPOLINE_PAD_MAX_ABOVE_DECK_M) return;
  if (t.y < pad.platformTopY - 2.5) return;

  const v = body.linvel();
  const launchVy = trampolineLaunchSpeedY();
  body.setTranslation(
    { x: t.x, y: Math.max(t.y, deckY + BALL_RADIUS + 0.1), z: t.z },
    true,
  );
  body.setLinvel({ x: v.x, y: Math.max(v.y, launchVy), z: v.z }, true);
  room.ballPadUntil = now + TRAMPOLINE_BALL_COOLDOWN_MS;
}

function broadcastRoom(room, msg) {
  const packet = JSON.stringify(msg);
  for (const [socket, client] of clients) {
    if (client.roomId === room.id) sendFrame(socket, packet);
  }
}

function clampPhysicsBallSpeed(room) {
  const body = room.physics.ballBody;
  const v = body.linvel();
  const speed = Math.hypot(v.x, v.y, v.z);
  if (speed <= BALL_MAX_SPEED || speed <= 0.0001) return;
  const scale = BALL_MAX_SPEED / speed;
  body.setLinvel({ x: v.x * scale, y: v.y * scale, z: v.z * scale }, true);
}

function normalizeVec3(value, fallback = { x: 0, y: 1, z: 0 }) {
  const v = sanitizeVec3(value, fallback);
  const length = Math.hypot(v.x, v.y, v.z);
  if (length <= 0.0001) return { ...fallback };
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function rocketKnockDirection(ballPosition, impact) {
  if (impact.rocketVelocity) {
    return normalizeVec3(impact.rocketVelocity);
  }
  const dx = ballPosition.x - impact.position.x;
  const dy = ballPosition.y - impact.position.y;
  const dz = ballPosition.z - impact.position.z;
  return normalizeVec3({ x: dx, y: dy, z: dz });
}

function rocketHitAngularVelocity(body, normal, deltaV, falloff) {
  const av = body.angvel();
  return {
    x:
      av.x +
      normal.z * deltaV * falloff * BALL_ROCKET_HIT_SPIN_SCALE,
    y: av.y,
    z:
      av.z -
      normal.x * deltaV * falloff * BALL_ROCKET_HIT_SPIN_SCALE,
  };
}

function applyRocketImpactToServerBall(room, impact, now) {
  if (!room.physics) room.physics = createRoomPhysics();
  const body = room.physics.ballBody;
  const ballPosition = body.translation();
  const dx = ballPosition.x - impact.position.x;
  const dy = ballPosition.y - impact.position.y;
  const dz = ballPosition.z - impact.position.z;
  const dist = Math.hypot(dx, dy, dz);
  const effectiveRadius = impact.radius + ROCKET_BALL_NETWORK_GRACE_RADIUS;
  if (dist > effectiveRadius) return false;

  const falloff = Math.max(
    ROCKET_BALL_SPLASH_MIN_FALLOFF,
    1 - dist / Math.max(effectiveRadius, 0.001),
  );
  const deltaV = ROCKET_BALL_HIT_DELTA_V;
  const direction = rocketKnockDirection(ballPosition, impact);
  const velocity = body.linvel();
  body.setLinvel(
    {
      x: velocity.x + direction.x * deltaV * falloff,
      y: velocity.y + direction.y * deltaV * falloff,
      z: velocity.z + direction.z * deltaV * falloff,
    },
    true,
  );

  const normal = normalizeVec3(impact.ballImpactNormal, direction);
  body.setAngvel(rocketHitAngularVelocity(body, normal, deltaV, falloff), true);
  clampPhysicsBallSpeed(room);
  syncBallFromPhysics(room, now);
  return true;
}

function applyPlayerContactToServerBall(room, dt, now) {
  if (!room.physics || !room.ball || room.match?.ballFrozen) return;
  const body = room.physics.ballBody;
  const ballPosition = body.translation();
  const ballVelocity = body.linvel();
  let vx = ballVelocity.x;
  let vy = ballVelocity.y;
  let vz = ballVelocity.z;
  let touchedBy = null;

  for (const player of room.players.values()) {
    if (
      player.isHoldingBall ||
      (player.releasedBallUntil && now < player.releasedBallUntil)
    ) {
      continue;
    }
    const px = player.position.x;
    const py = player.position.y + 0.75;
    const pz = player.position.z;
    if (Math.abs(ballPosition.y - py) > PLAYER_BALL_CONTACT_VERTICAL) continue;

    let dx = ballPosition.x - px;
    let dz = ballPosition.z - pz;
    let dist = Math.hypot(dx, dz);
    if (dist >= PLAYER_BALL_CONTACT_RADIUS) continue;
    if (dist < 0.001) {
      const pvLen = Math.hypot(player.velocity.x, player.velocity.z);
      if (pvLen > 0.001) {
        dx = player.velocity.x / pvLen;
        dz = player.velocity.z / pvLen;
        dist = 1;
      } else {
        dx = 1;
        dz = 0;
        dist = 1;
      }
    }
    const nx = dx / dist;
    const nz = dz / dist;
    const playerTowardBall = Math.max(
      0,
      player.velocity.x * nx + player.velocity.z * nz,
    );
    const overlap = PLAYER_BALL_CONTACT_RADIUS - dist;
    if (playerTowardBall < 0.15 && overlap < 0.18) continue;

    const frameScale = Math.min(1.25, Math.max(0.35, dt * 60));
    const deltaV = Math.min(
      PLAYER_BALL_CONTACT_MAX_DELTA_V,
      (overlap * PLAYER_BALL_CONTACT_PUSH +
        playerTowardBall * PLAYER_BALL_CONTACT_VEL_INHERIT) *
        frameScale,
    );
    vx += nx * deltaV;
    vz += nz * deltaV;

    const fallingOntoBall =
      player.velocity.y < -2.2 &&
      ballPosition.y < player.position.y + 0.4 &&
      dist < BALL_RADIUS * 0.95;
    if (fallingOntoBall) {
      vy -= Math.min(6, Math.abs(player.velocity.y) * 0.45);
      vx += player.velocity.x * 0.12;
      vz += player.velocity.z * 0.12;
    }
    touchedBy = player;
  }

  if (!touchedBy) return;
  body.setLinvel({ x: vx, y: vy, z: vz }, true);
  markRoomLastTouch(room, touchedBy, ballPosition);
}

function tickRoomBall(room, dt, now) {
  if (!room.ball) room.ball = createServerBall();
  if (!room.physics) room.physics = createRoomPhysics();
  updateBallDropCollisionGate(room, now);
  const match = room.match;

  if (match?.ballFrozen) {
    const frozenPosition = { ...room.ball.position };
    if (match.countdown > 0 || match.arenaSettleCountdown > 0 || match.loadCountdown > 0) {
      frozenPosition.x = BALL_DROP_SPAWN.x;
      frozenPosition.y = BALL_DROP_SPAWN.y;
      frozenPosition.z = BALL_DROP_SPAWN.z;
    }
    setPhysicsBall(
      room,
      frozenPosition,
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    );
    syncBallFromPhysics(room, now);
    return;
  }

  const holder = [...room.players.values()].find(
    (player) =>
      player.isHoldingBall &&
      player.holdPosition &&
      (!player.releasedBallUntil || now >= player.releasedBallUntil),
  );
  if (holder) {
    markRoomLastTouch(room, holder, holder.holdPosition ?? holder.position);
    setPhysicsBall(
      room,
      sanitizeVec3(holder.holdPosition, room.ball.position),
      sanitizeVec3(holder.velocity, room.ball.velocity),
      { x: 0, y: 0, z: 0 },
    );
    syncBallFromPhysics(room, now);
    return;
  }

  for (const player of room.players.values()) {
    if (!player.isBeaming) continue;
    const body = room.physics.ballBody;
    const ballPosition = body.translation();
    const ballVelocity = body.linvel();
    const chest = {
      x: player.position.x,
      y: player.position.y + 1.2,
      z: player.position.z,
    };
    const dx = chest.x - ballPosition.x;
    const dy = chest.y - ballPosition.y;
    const dz = chest.z - ballPosition.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist <= 0.001 || dist > BEAM_RANGE) continue;
    const closeBoost = 1 + Math.max(0, 1 - dist / BEAM_RANGE) * 0.9;
    const accel = BEAM_PULL_ACCEL * closeBoost;
    body.setLinvel(
      {
        x: ballVelocity.x + (dx / dist) * accel * dt,
        y: ballVelocity.y + (dy / dist) * accel * dt,
        z: ballVelocity.z + (dz / dist) * accel * dt,
      },
      true,
    );
  }

  applyPlayerContactToServerBall(room, dt, now);

  room.physics.accumulator = Math.min(0.1, room.physics.accumulator + dt);
  while (room.physics.accumulator >= SERVER_PHYSICS_STEP) {
    room.physics.world.step();
    applyServerTrampolinePads(room, now);
    room.physics.accumulator -= SERVER_PHYSICS_STEP;
  }
  clampPhysicsBallSpeed(room);
  const t = room.physics.ballBody.translation();
  const v = room.physics.ballBody.linvel();
  const speed = Math.hypot(v.x, v.y, v.z);
  const hit =
    now >= (room.goalLockedUntil ?? 0) &&
    !room.match?.ballFrozen &&
    room.match?.phase !== 'intro' &&
    room.match?.phase !== 'loading'
      ? checkGoalScoreSegment(
          room.lastBallPosition ?? { x: t.x, y: t.y, z: t.z },
          { x: t.x, y: t.y, z: t.z },
          speed,
        )
      : null;
  syncBallFromPhysics(room, now);
  room.lastBallPosition = { ...room.ball.position };
  if (hit) registerServerGoal(room, hit, now);
}

function registerServerGoal(room, hit, now) {
  const score = {
    red: room.match?.score?.red ?? 0,
    blue: room.match?.score?.blue ?? 0,
  };
  score[hit.scoringTeam] += hit.points;
  room.goalLockedUntil = now + GOAL_SCORE_COOLDOWN_MS;
  room.ballHiddenUntil = now + GOAL_BALL_HIDE_RESET_MS;
  const scorer = room.lastTouch;
  const shotDistanceM = scorer
    ? Math.hypot(
        scorer.position.x - hit.goalPos.x,
        scorer.position.y - hit.goalPos.y,
        scorer.position.z - hit.goalPos.z,
      )
    : null;
  room.match = {
    ...(room.match ?? {
      phase: 'playing',
      timeLeft: 0,
      countdown: 0,
      arenaSettleCountdown: 0,
      loadCountdown: 0,
    }),
    score,
    ballFrozen: true,
  };
  setPhysicsBall(
    room,
    BALL_DROP_SPAWN,
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  );
  syncBallFromPhysics(room, now);
  room.lastBallPosition = { ...room.ball.position };
  broadcastRoom(room, {
    type: 'goalScored',
    serverTime: now,
    goal: {
      id: crypto.randomUUID(),
      points: hit.points,
      scoringTeam: hit.scoringTeam,
      goalTeam: hit.goalTeam,
      goalId: hit.goalId,
      goalPos: hit.goalPos,
      score,
      scorerId: scorer?.playerId ?? null,
      scorerName: scorer?.playerName ?? null,
      shotDistanceM,
    },
  });
}

function handleClientMessage(socket, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  if (msg.type === 'hello') {
    const room =
      rooms.get(msg.roomId) ??
      (msg.roomId === 'main'
        ? getOrCreateRoom('main', { mode: '1v1', name: 'Main Lobby' })
        : null);
    if (!room) {
      sendJson(socket, { type: 'joinError', message: 'That lobby no longer exists.' });
      return;
    }
    if (room.players.size >= room.maxPlayers) {
      sendJson(socket, { type: 'joinError', message: 'That lobby is already full.' });
      return;
    }
    const id = crypto.randomUUID();
    const profile = sanitizeProfile(msg.profile);
    const team = sanitizeTeam(msg.team, room);
    const player = {
      id,
      name: profile.name,
      jerseyNumber: profile.jerseyNumber,
      team,
      teamSlot: 0,
      position: { x: 0, y: 2, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: { yaw: 0, pitch: 0 },
      energy: 100,
      isBeaming: false,
      isHoldingBall: false,
      holdPosition: null,
      playReady: false,
      loadReady: false,
      updatedAt: Date.now(),
    };
    clients.set(socket, { id, roomId: room.id });
    room.players.set(id, player);
    assignRoomTeamSlots(room);
    if (!room.hostId) room.hostId = id;
    sendJson(socket, {
      type: 'welcome',
      id,
      roomId: room.id,
      team,
      teamSlot: player.teamSlot,
      hostId: room.hostId,
      room: roomSummary(room),
    });
    return;
  }

  const client = clients.get(socket);
  if (!client) return;
  const room = rooms.get(client.roomId);
  const player = room?.players.get(client.id);
  if (!player) return;

  if (msg.type === 'playerUpdate') {
    player.position = sanitizeVec3(msg.position, player.position);
    player.velocity = sanitizeVec3(msg.velocity, player.velocity);
    player.rotation = {
      yaw: Number.isFinite(msg.rotation?.yaw) ? msg.rotation.yaw : player.rotation.yaw,
      pitch: Number.isFinite(msg.rotation?.pitch) ? msg.rotation.pitch : player.rotation.pitch,
    };
    player.energy = Number.isFinite(msg.energy)
      ? Math.max(0, Math.min(100, msg.energy))
      : player.energy;
    const otherHolder = [...room.players.values()].find(
      (other) => other.id !== player.id && other.isHoldingBall,
    );
    const wantsHold = Boolean(msg.isHoldingBall);
    player.isHoldingBall =
      wantsHold &&
      !otherHolder &&
      (!player.releasedBallUntil || Date.now() >= player.releasedBallUntil);
    player.isBeaming =
      Boolean(msg.isBeaming) && !player.isHoldingBall && !otherHolder;
    player.holdPosition = player.isHoldingBall && msg.holdPosition
      ? sanitizeVec3(msg.holdPosition, player.position)
      : null;
    if (
      !player.isHoldingBall &&
      player.releasedBallUntil &&
      Date.now() >= player.releasedBallUntil
    ) {
      player.releasedBallUntil = 0;
    }
    player.updatedAt = Date.now();
    return;
  }

  if (msg.type === 'loadReady') {
    player.loadReady = player.playReady && Boolean(msg.ready);
    player.updatedAt = Date.now();
    return;
  }

  if (msg.type === 'playReady') {
    player.playReady = Boolean(msg.ready);
    player.loadReady = false;
    player.updatedAt = Date.now();
    return;
  }

  if (msg.type === 'hostState' && client.id === room.hostId) {
    if (!room.ball) room.ball = createServerBall();
    const players = [...room.players.values()];
    if (players.length < room.maxPlayers || players.some((p) => !p.playReady)) return;
    const previousFrozen = room.match?.ballFrozen;
    const nextMatch = sanitizeMatchState(msg.match);
    if (Date.now() < (room.goalLockedUntil ?? 0) && room.match) {
      nextMatch.score = room.match.score;
      nextMatch.ballFrozen = true;
    }
    room.match = nextMatch;
    if (!previousFrozen && nextMatch.ballFrozen) {
      setPhysicsBall(
        room,
        BALL_DROP_SPAWN,
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      );
      syncBallFromPhysics(room, Date.now());
    } else if (previousFrozen && !nextMatch.ballFrozen) {
      const now = Date.now();
      disableBallDropCollisionForRelease(room, now);
      setPhysicsBall(
        room,
        BALL_DROP_RELEASE,
        { x: 0, y: -0.2, z: 0 },
        { x: 0, y: 0, z: 0 },
      );
      syncBallFromPhysics(room, now);
    }
    return;
  }

  if (msg.type === 'rocketFire') {
    const rocket = {
      id: typeof msg.rocket?.id === 'string' ? msg.rocket.id.slice(0, 64) : crypto.randomUUID(),
      ownerId: client.id,
      position: sanitizeVec3(msg.rocket?.position),
      velocity: sanitizeVec3(msg.rocket?.velocity),
      spawnPos: sanitizeVec3(msg.rocket?.spawnPos),
      segmentStart: sanitizeVec3(msg.rocket?.segmentStart),
      spawnTime: Number.isFinite(msg.rocket?.spawnTime) ? msg.rocket.spawnTime : 0,
      bouncesLeft: Number.isFinite(msg.rocket?.bouncesLeft)
        ? Math.max(0, Math.floor(msg.rocket.bouncesLeft))
        : 0,
      explosive: Boolean(msg.rocket?.explosive),
    };
    const packet = {
      type: 'rocketFire',
      serverTime: Date.now(),
      rocket,
    };
    for (const [peerSocket, peerClient] of clients) {
      if (peerSocket !== socket && peerClient.roomId === room.id) {
        sendJson(peerSocket, packet);
      }
    }
    return;
  }

  if (msg.type === 'rocketImpact') {
    const impact = {
      position: sanitizeVec3(msg.impact?.position),
      radius: Number.isFinite(msg.impact?.radius)
        ? Math.max(0.5, Math.min(18, msg.impact.radius))
        : 7,
      rocketVelocity: msg.impact?.rocketVelocity
        ? sanitizeVec3(msg.impact.rocketVelocity)
        : null,
      ballImpactNormal: msg.impact?.ballImpactNormal
        ? sanitizeVec3(msg.impact.ballImpactNormal)
        : null,
    };
    markRoomLastTouch(room, player, impact.position);
    const now = Date.now();
    if (applyRocketImpactToServerBall(room, impact, now)) {
      const packet = {
        type: 'ballImpulse',
        serverTime: now,
        ball: room.ball,
      };
      for (const [peerSocket, peerClient] of clients) {
        if (peerClient.roomId === room.id) {
          sendJson(peerSocket, packet);
        }
      }
    }
    return;
  }

  if (msg.type === 'ballAction') {
    if (!room.ball) room.ball = createServerBall();
    const action = {
      id:
        typeof msg.action?.id === 'string'
          ? msg.action.id.slice(0, 64)
          : crypto.randomUUID(),
      ownerId: client.id,
      kind: 'release',
      position: sanitizeVec3(msg.action?.position),
      velocity: ensureLaunchVelocity(
        player,
        sanitizeVec3(msg.action?.velocity),
        msg.action?.ballState === 'loose' ? 'loose' : 'launched',
      ),
      angularVelocity: msg.action?.angularVelocity
        ? sanitizeVec3(msg.action.angularVelocity)
        : null,
      ballState: msg.action?.ballState === 'loose' ? 'loose' : 'launched',
    };
    player.isHoldingBall = false;
    player.holdPosition = null;
    player.releasedBallUntil = Date.now() + POST_RELEASE_HOLD_BLOCK_MS;
    markRoomLastTouch(room, player, action.position);
    room.ball.position = action.position;
    room.ball.velocity = action.velocity;
    room.ball.angularVelocity =
      action.angularVelocity ?? {
        x: (action.velocity.z / BALL_RADIUS) * BALL_LAUNCH_SPIN_SCALE,
        y: 0,
        z: (-action.velocity.x / BALL_RADIUS) * BALL_LAUNCH_SPIN_SCALE,
      };
    clampBallSpeed(room.ball);
    room.ball.updatedAt = Date.now();
    setPhysicsBall(room, room.ball.position, room.ball.velocity, room.ball.angularVelocity);
    const now = Date.now();
    const ballPacket = {
      type: 'ballImpulse',
      serverTime: now,
      ball: room.ball,
    };
    for (const [peerSocket, peerClient] of clients) {
      if (peerClient.roomId === room.id) {
        sendJson(peerSocket, ballPacket);
      }
    }
    const packet = {
      type: 'ballAction',
      serverTime: now,
      action,
    };
    for (const [peerSocket, peerClient] of clients) {
      if (peerSocket !== socket && peerClient.roomId === room.id) {
        sendJson(peerSocket, packet);
      }
    }
  }
}

function broadcastSnapshots() {
  const now = Date.now();
  for (const room of rooms.values()) {
    const players = [...room.players.values()];
    const packet = JSON.stringify({
      type: 'snapshot',
      serverTime: now,
      hostId: room.hostId,
      ball: room.ball,
      match: room.match,
      room: roomSummary(room),
      players,
    });
    for (const [socket, client] of clients) {
      if (client.roomId === room.id) sendFrame(socket, packet);
    }
  }
}

let lastServerStepAt = Date.now();
function tickServer() {
  const now = Date.now();
  const dt = Math.min(SERVER_STEP_MAX, Math.max(0, (now - lastServerStepAt) / 1000));
  lastServerStepAt = now;
  for (const room of rooms.values()) tickRoomBall(room, dt, now);
  broadcastSnapshots();
}

function sendApiJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(JSON.stringify(payload));
}

function readRequestJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

async function maybeHandleApi(req, res) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  if (url.pathname !== '/api/rooms') return false;

  if (req.method === 'OPTIONS') {
    sendApiJson(res, 204, {});
    return true;
  }

  if (req.method === 'GET') {
    sendApiJson(res, 200, { rooms: listRoomSummaries() });
    return true;
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = await readRequestJson(req);
    } catch {
      sendApiJson(res, 400, { error: 'Invalid room payload.' });
      return true;
    }
    const id = crypto.randomUUID().slice(0, 8);
    const room = createRoomRecord(id, {
      mode: body?.mode,
      name: body?.name,
    });
    rooms.set(room.id, room);
    sendApiJson(res, 201, { room: roomSummary(room) });
    return true;
  }

  sendApiJson(res, 405, { error: 'Method not allowed.' });
  return true;
}

async function serveStatic(req, res) {
  if (await maybeHandleApi(req, res)) return;
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const relativePath =
    url.pathname === '/'
      ? 'index.html'
      : path.normalize(decodeURIComponent(url.pathname).replace(/^[/\\]+/, ''));
  const requested = path.resolve(distDir, relativePath);
  const filePath = requested.startsWith(distDir) && fs.existsSync(requested)
    ? requested
    : path.join(distDir, 'index.html');

  if (!fs.existsSync(filePath)) {
    res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('RocccitBall build not found. Run npm run build first.');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'content-type': mimeTypes.get(ext) ?? 'application/octet-stream',
    'cache-control': filePath.endsWith('index.html')
      ? 'no-cache'
      : 'public, max-age=31536000, immutable',
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(serveStatic);

server.on('upgrade', (req, socket) => {
  if (req.url !== '/ws') {
    socket.destroy();
    return;
  }
  const key = req.headers['sec-websocket-key'];
  if (typeof key !== 'string') {
    socket.destroy();
    return;
  }
  const accept = crypto
    .createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  socket.on('data', (chunk) => {
    for (const message of decodeFrames(socket, chunk)) {
      handleClientMessage(socket, message);
    }
  });
  socket.on('close', () => removeClient(socket));
  socket.on('error', () => removeClient(socket));
});

setInterval(tickServer, Math.max(16, Math.round(1000 / snapshotHz)));

server.listen(port, () => {
  console.log(`RocccitBall server listening on ${port}`);
});
