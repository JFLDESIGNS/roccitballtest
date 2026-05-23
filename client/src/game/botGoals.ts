import * as THREE from 'three';
import { BEAM, BOT, ROCKET } from '../shared/Constants';
import { getBotPressureScalars } from './botTuning';
import { ARENA_GOALS } from './goals';
import type { Team } from '../shared/Types';
import { isBotHolderId, type BallHolderId } from './gameStore';

const _target = new THREE.Vector3();
const _zero = new THREE.Vector3();

/** Aim at opposite wall: red shoots blue (+X) rings, blue shoots red (−X) rings */
export function getEnemyGoalTarget(team: Team, out = _target): THREE.Vector3 {
  const defendTeam: Team = team === 'red' ? 'blue' : 'red';
  const goals = ARENA_GOALS.filter((g) => g.team === defendTeam);
  const medium = goals.find((g) => g.size === 'medium') ?? goals[0];
  return out.set(medium.center.x, medium.center.y, medium.center.z);
}

export function aimAnglesToward(
  from: THREE.Vector3,
  to: THREE.Vector3,
): { yaw: number; pitch: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const horiz = Math.hypot(dx, dz);
  const yaw = Math.atan2(-dx, -dz);
  const pitch = Math.atan2(dy, Math.max(horiz, 0.01));
  return {
    yaw,
    pitch: Math.max(-0.35, Math.min(1.22, pitch)),
  };
}

export function getGoalShootTarget(team: Team, out = _target): THREE.Vector3 {
  return getEnemyGoalTarget(team, out);
}

export function leadPlayerTarget(
  from: THREE.Vector3,
  playerChest: THREE.Vector3,
  playerVel: THREE.Vector3,
  out = _target,
): THREE.Vector3 {
  const dist = from.distanceTo(playerChest);
  const horizSpd = Math.hypot(playerVel.x, playerVel.z);
  const rocketSpd = ROCKET.speed * BOT.rocketSpeedScale;
  const flightSec = Math.min(2, Math.max(0.35, dist / (rocketSpd * 0.82)));
  const leadT = horizSpd >= 2 ? flightSec * 0.85 : flightSec * 0.3;
  out.copy(playerChest);
  out.x += playerVel.x * leadT;
  out.y += playerVel.y * leadT * 0.2;
  out.z += playerVel.z * leadT;
  out.y = Math.max(0.85, Math.min(out.y, 4.8));
  return out;
}

/** Revenge rockets — horizontal lead, aim at torso (no extra pitch offset) */
export function pickRetaliationAimTarget(
  from: THREE.Vector3,
  attackerChest: THREE.Vector3,
  attackerVel: THREE.Vector3,
  out = _target,
): THREE.Vector3 {
  const dist = from.distanceTo(attackerChest);
  const horizSpd = Math.hypot(attackerVel.x, attackerVel.z);
  const rocketSpd = ROCKET.speed * BOT.rocketSpeedScale;
  const flightSec = Math.min(2, Math.max(0.35, dist / (rocketSpd * 0.82)));
  const leadT = horizSpd >= 2 ? flightSec * 0.88 : flightSec * 0.35;
  out.set(
    attackerChest.x + attackerVel.x * leadT,
    attackerChest.y + attackerVel.y * leadT * 0.82,
    attackerChest.z + attackerVel.z * leadT,
  );
  if (attackerChest.y < BEAM.chestHeight + 1.4) {
    out.y -= BOT.retaliateAimDropM;
  }
  out.y = THREE.MathUtils.clamp(
    out.y,
    attackerChest.y - 0.35,
    attackerChest.y + 2.2,
  );
  return out;
}

/** Bot carrying — aim at enemy ring centers (bullseye), vary height by distance tier */
export function pickBotGoalLaunchTarget(
  team: Team,
  shotIndex: number,
  out = _target,
  fromChest?: THREE.Vector3,
): THREE.Vector3 {
  const defendTeam: Team = team === 'red' ? 'blue' : 'red';
  const rings = ARENA_GOALS.filter((g) => g.team === defendTeam);
  const order = ['medium', 'large', 'small'] as const;
  const size = order[shotIndex % order.length];
  const ring =
    rings.find((g) => g.size === size) ?? rings[1] ?? rings[0];
  /** Nudge into the defended wall from the field side */
  const towardNet = team === 'red' ? 0.85 : -0.85;
  out.set(ring.center.x + towardNet, ring.center.y, ring.center.z);
  const lane = shotIndex % 3 === 0 ? 0 : shotIndex % 3 === 1 ? 1.4 : -1.4;
  out.z += lane;
  if (fromChest) {
    const dist = fromChest.distanceTo(out);
    if (dist > 28) out.y += 2.4;
    else if (dist > 16) out.y += 1.1;
    else out.y += 0.45;
  }
  return out;
}

/** High arc toward the rings when shooting from distance */
export function pickBotLoftLaunchTarget(
  team: Team,
  shotIndex: number,
  out = _target,
  fromChest?: THREE.Vector3,
): THREE.Vector3 {
  pickBotGoalLaunchTarget(team, shotIndex, out, fromChest);
  out.y += BOT.loftLaunchExtraLiftY;
  if (fromChest) {
    const dist = fromChest.distanceTo(out);
    if (dist > 32) out.y += 1.6;
    else if (dist > 22) out.y += 0.9;
  }
  return out;
}

/** Ally save — lead the loose ball after an opponent shot */
export function pickAllySaveBallTarget(
  ballPos: THREE.Vector3,
  ballVel: THREE.Vector3,
  out = _target,
): THREE.Vector3 {
  const leadT = 0.38;
  out.copy(ballPos);
  out.x += ballVel.x * leadT;
  out.y += ballVel.y * leadT + 0.2;
  out.z += ballVel.z * leadT;
  out.y = Math.max(out.y, 0.95);
  return applyRocketAimError(out, out);
}

/** Widen bot throws so fewer perfect catches / saves */
export function applyBotLaunchAimError(
  chest: THREE.Vector3,
  target: THREE.Vector3,
  out = _target,
): THREE.Vector3 {
  out.copy(target);
  const spread = getBotPressureScalars().ballLaunchAimErrorM;
  out.x += (Math.random() - 0.5) * spread * 1.1;
  out.y += (Math.random() - 0.5) * spread * 0.75;
  out.z += (Math.random() - 0.5) * spread * 1.35;
  out.y = Math.max(0.7, Math.min(out.y, 12));
  const dist = chest.distanceTo(out);
  if (dist < 6) {
    out.sub(chest).normalize().multiplyScalar(6).add(chest);
  }
  return out;
}

/** Carried ball: ~80% goal/ball; pressure player when they hold the ball */
export function pickBotLaunchTarget(
  team: Team,
  chest: THREE.Vector3,
  playerChest: THREE.Vector3,
  playerVel: THREE.Vector3,
  ballPos: THREE.Vector3,
  ballHolder: BallHolderId,
  shotIndex: number,
  out = _target,
): THREE.Vector3 {
  const playerHasBall = ballHolder === 'local';
  const { playerCarrierShotBias } = getBotPressureScalars();
  const slot = shotIndex % 5;
  if (!playerHasBall) {
    if (slot === 0 || slot === 1) return getGoalShootTarget(team, out);
    if (slot === 2 || slot === 3) return out.copy(ballPos);
    if (isBotHolderId(ballHolder)) {
      return getGoalShootTarget(team, out);
    }
    return leadPlayerTarget(chest, playerChest, playerVel, out);
  }
  if (Math.random() < playerCarrierShotBias) {
    return leadPlayerTarget(chest, playerChest, playerVel, out);
  }
  if (slot === 3 || Math.random() < 0.45) return out.copy(ballPos);
  return getGoalShootTarget(team, out);
}

const _aimJitter = new THREE.Vector3();
const _followDir = new THREE.Vector3();
const _followOff = new THREE.Vector3();

/** Follow-player mode — 1%–10% displacement from the lead target */
export function applyFollowPlayerAimError(
  chest: THREE.Vector3,
  target: THREE.Vector3,
  out = _target,
): THREE.Vector3 {
  out.copy(target);
  _followDir.subVectors(target, chest);
  const dist = _followDir.length();
  if (dist < 0.5) return out;

  const aim = getBotPressureScalars();
  const pct =
    aim.followPlayerAimErrorMinPct +
    Math.random() *
      (aim.followPlayerAimErrorMaxPct - aim.followPlayerAimErrorMinPct);
  const offsetLen = dist * pct;

  _followOff.set(
    Math.random() - 0.5,
    (Math.random() - 0.5) * 0.65,
    Math.random() - 0.5,
  );
  if (_followOff.lengthSq() < 1e-6) _followOff.set(1, 0, 0);
  _followOff.normalize().multiplyScalar(offsetLen);
  out.add(_followOff);
  out.y = Math.max(0.65, Math.min(out.y, 12));
  return out;
}

export function pickFollowPlayerProjectileTarget(
  chest: THREE.Vector3,
  playerChest: THREE.Vector3,
  playerVel: THREE.Vector3,
  out = _target,
): THREE.Vector3 {
  return applyFollowPlayerAimError(
    chest,
    leadPlayerTarget(chest, playerChest, playerVel, out),
    out,
  );
}

/** Spread rocket aim so fewer direct hits on player / ball */
export function applyRocketAimError(
  target: THREE.Vector3,
  out = _target,
): THREE.Vector3 {
  out.copy(target);
  const spread = getBotPressureScalars().rocketAimErrorM;
  _aimJitter.set(
    (Math.random() - 0.5) * spread * 2.2,
    (Math.random() - 0.5) * spread * 1.5,
    (Math.random() - 0.5) * spread * 2.2,
  );
  out.add(_aimJitter);
  out.y = Math.max(0.6, out.y);
  return out;
}

/** Pass toward a same-team bot or the local player */
export function pickTeammatePassTarget(
  chest: THREE.Vector3,
  teammateChest: THREE.Vector3,
  teammateVel: THREE.Vector3,
  out = _target,
): THREE.Vector3 {
  leadPlayerTarget(chest, teammateChest, teammateVel, out);
  const dist = chest.distanceTo(out);
  const lift = BOT.passLoftYOffset + dist * BOT.passLoftPerMeter;
  out.y = Math.max(out.y, chest.y + lift, teammateChest.y + 1.2);
  return out;
}

/** Ally bot — pressure enemy carriers, rarely the loose ball */
export function pickAllyProjectileTarget(
  chest: THREE.Vector3,
  enemyChest: THREE.Vector3 | null,
  enemyVel: THREE.Vector3,
  ballPos: THREE.Vector3,
  out = _target,
): THREE.Vector3 {
  if (enemyChest && Math.random() < 0.8) {
    return applyRocketAimError(
      leadPlayerTarget(chest, enemyChest, enemyVel, out),
      out,
    );
  }
  if (Math.random() < BOT.periodicProjectileBallBias) {
    out.copy(ballPos);
    out.y = Math.max(out.y, 0.9);
    return applyRocketAimError(out, out);
  }
  out.copy(ballPos);
  out.x += (Math.random() - 0.5) * 8;
  out.z += (Math.random() - 0.5) * 8;
  out.y = Math.max(out.y, 1.2);
  return applyRocketAimError(out, out);
}

/** Enemy volley — player if they carry, else ball or player */
export function pickEnemyVolleyRocketTarget(
  playerChest: THREE.Vector3,
  playerVel: THREE.Vector3,
  ballPos: THREE.Vector3,
  chest: THREE.Vector3,
  ballHolder: BallHolderId,
  out = _target,
  opponentBotChest: THREE.Vector3 | null = null,
  opponentBotVel: THREE.Vector3 = _zero,
): THREE.Vector3 {
  if (
    !ballHolder &&
    opponentBotChest &&
    Math.random() < BOT.enemyVolleyAtBotChance
  ) {
    return applyRocketAimError(
      leadPlayerTarget(chest, opponentBotChest, opponentBotVel, out),
      out,
    );
  }
  if (ballHolder === 'local') {
    return applyRocketAimError(
      leadPlayerTarget(chest, playerChest, playerVel, out),
      out,
    );
  }
  if (Math.random() < 0.5) {
    return applyRocketAimError(
      leadPlayerTarget(chest, playerChest, playerVel, out),
      out,
    );
  }
  out.copy(ballPos);
  out.y = Math.max(out.y, 1.1);
  return applyRocketAimError(out, out);
}

/** Ally / legacy periodic target picker */
export function pickPeriodicProjectileTarget(
  playerChest: THREE.Vector3,
  playerVel: THREE.Vector3,
  ballPos: THREE.Vector3,
  chest: THREE.Vector3,
  ballHolder: BallHolderId,
  out = _target,
): THREE.Vector3 {
  if (ballHolder === 'local') {
    return applyRocketAimError(
      leadPlayerTarget(chest, playerChest, playerVel, out),
      out,
    );
  }
  if (Math.random() < BOT.periodicProjectileBallBias) {
    out.copy(ballPos);
    out.y = Math.max(out.y, 0.9);
  } else if (Math.random() < BOT.periodicProjectilePlayerBias) {
    leadPlayerTarget(chest, playerChest, playerVel, out);
  } else {
    out.copy(ballPos);
    out.x += (Math.random() - 0.5) * 10;
    out.z += (Math.random() - 0.5) * 10;
    out.y = Math.max(out.y, 1.4);
  }
  return applyRocketAimError(out, out);
}

/** Rockets — lead player; blend toward ball when they are carrying */
export function pickPlayerRocketTarget(
  chest: THREE.Vector3,
  playerChest: THREE.Vector3,
  playerVel: THREE.Vector3,
  ballPos: THREE.Vector3,
  playerHasBall: boolean,
  out = _target,
): THREE.Vector3 {
  leadPlayerTarget(chest, playerChest, playerVel, out);
  if (playerHasBall) {
    out.lerp(ballPos, 0.4);
    out.y = Math.max(out.y, ballPos.y * 0.5 + playerChest.y * 0.5);
  }
  return out;
}

