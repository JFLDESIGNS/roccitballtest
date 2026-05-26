import * as THREE from 'three';
import { BOT } from '../shared/Constants';
import { ARENA_GOALS } from './goals';
import type { GoalSize, Team } from '../shared/Types';
import { pickBotGoalLaunchTarget } from './botGoals';
import { clampMoveTargetFromGoalBottomPit } from './botGoalBottomPit';
import { getShootZoneCenter } from './botShootZone';
import type { BotHoldPhase } from './botBrain';

const _scratch = new THREE.Vector3();

export type BotShotStyle = 'normal' | 'dunk' | 'jam';

function defendTeam(attackingTeam: Team): Team {
  return attackingTeam === 'red' ? 'blue' : 'red';
}

function towardCourtX(attackingTeam: Team): number {
  return attackingTeam === 'red' ? -1 : 1;
}

function enemyRing(
  team: Team,
  size: GoalSize,
): (typeof ARENA_GOALS)[number] | undefined {
  return ARENA_GOALS.find(
    (g) => g.team === defendTeam(team) && g.size === size,
  );
}

/** Court-side point directly in front of a ring (center Z, no lane drift). */
export function pickBotRingApproachTarget(
  team: Team,
  ringSize: GoalSize,
  selfY: number,
  out = _scratch,
  insetM: number = BOT.goalRingApproachInset,
): THREE.Vector3 {
  const ring =
    enemyRing(team, ringSize) ??
    enemyRing(team, 'large') ??
    ARENA_GOALS[0];
  const toward = towardCourtX(team);
  out.set(ring.center.x + toward * insetM, selfY, ring.center.z);
  clampMoveTargetFromGoalBottomPit(out, team);
  return out;
}

/** Where to run while attacking — bottom ring or mid ring for second jump */
export function pickBotGoalOffenseMoveTarget(
  team: Team,
  shotStyle: BotShotStyle,
  holdPhase: BotHoldPhase,
  setupJumped: boolean,
  selfPos: THREE.Vector3,
  out = _scratch,
): THREE.Vector3 {
  if (
    shotStyle === 'dunk' &&
    setupJumped &&
    (holdPhase === 'setup' || holdPhase === 'shoot')
  ) {
    return pickBotRingApproachTarget(
      team,
      'medium',
      selfPos.y,
      out,
      BOT.goalDunkMidApproachInset,
    );
  }
  pickBotRingApproachTarget(team, 'large', selfPos.y, out);
  clampMoveTargetFromGoalBottomPit(out, team);
  return out;
}

/** Roll once per setup phase — dunk in shoot zone ~60%, jam when very close */
/** Inside the tight net cylinder — jam or shoot, never idle carry */
export function rollNetFinishShotStyle(): BotShotStyle {
  const r = Math.random();
  if (r < BOT.netFinishJamChance) return 'jam';
  if (r < BOT.netFinishJamChance + BOT.netFinishDunkChance) return 'dunk';
  return 'normal';
}

export function rollBotShotStyle(
  inShootZone: boolean,
  distGoal: number,
): BotShotStyle {
  if (inShootZone) {
    const r = Math.random();
    if (r < BOT.shootZoneDunkChance) return 'dunk';
    if (r < BOT.shootZoneDunkChance + BOT.shootZoneJamChance) return 'jam';
    return 'normal';
  }
  if (distGoal <= BOT.goalJamMaxDist && Math.random() < BOT.nearGoalJamChance) {
    return 'jam';
  }
  if (
    distGoal <= BOT.goalDunkMaxDist &&
    Math.random() < BOT.nearGoalDunkChance
  ) {
    return 'dunk';
  }
  return 'normal';
}

export function isNearEnemyGoal(distGoal: number): boolean {
  return distGoal <= Math.max(BOT.goalDunkMaxDist, BOT.goalJamMaxDist);
}

/** @deprecated use pickBotRingApproachTarget */
export function pickBotJamMoveTarget(
  team: Team,
  out = _scratch,
): THREE.Vector3 {
  return pickBotRingApproachTarget(team, 'large', 2, out);
}

/** Low line into the scoring wall / bottom ring */
export function pickBotJamLaunchTarget(
  team: Team,
  _shotIndex: number,
  out = _scratch,
  fromChest?: THREE.Vector3,
): THREE.Vector3 {
  const ring = enemyRing(team, 'large') ?? enemyRing(team, 'medium')!;
  const towardNet = -towardCourtX(team);
  out.set(ring.center.x + towardNet * 0.85, ring.center.y - 0.35, ring.center.z);
  if (fromChest) {
    const dist = fromChest.distanceTo(out);
    if (dist > 10) out.y -= 0.25;
  }
  return out;
}

/** High arc at top / medium ring */
export function pickBotDunkLaunchTarget(
  team: Team,
  _shotIndex: number,
  out = _scratch,
  fromChest?: THREE.Vector3,
): THREE.Vector3 {
  const dist = fromChest?.distanceTo(
    pickBotRingApproachTarget(team, 'large', fromChest.y, _scratch),
  );
  const aimRing =
    dist !== undefined && dist < 9
      ? enemyRing(team, 'medium') ?? enemyRing(team, 'small')
      : enemyRing(team, 'small') ?? enemyRing(team, 'medium');
  const ring = aimRing ?? enemyRing(team, 'large')!;
  const towardNet = -towardCourtX(team) * 0.75;
  out.set(ring.center.x + towardNet, ring.center.y, ring.center.z);
  out.y += BOT.dunkTargetLiftY;
  if (fromChest) {
    const d = fromChest.distanceTo(out);
    if (d < 8) out.y += 1.8;
    else if (d < 16) out.y += 1.1;
  }
  return out;
}

export function pickBotStyledLaunchTarget(
  style: BotShotStyle,
  team: Team,
  shotIndex: number,
  out: THREE.Vector3,
  fromChest?: THREE.Vector3,
): THREE.Vector3 {
  if (style === 'dunk') {
    return pickBotDunkLaunchTarget(team, shotIndex, out, fromChest);
  }
  if (style === 'jam') {
    return pickBotJamLaunchTarget(team, shotIndex, out, fromChest);
  }
  return pickBotGoalLaunchTarget(team, shotIndex, out, fromChest);
}

export function dunkPitchOffsetRad(style: BotShotStyle): number {
  if (style === 'dunk') {
    return THREE.MathUtils.degToRad(BOT.dunkPitchOffsetDeg);
  }
  if (style === 'jam') {
    return THREE.MathUtils.degToRad(BOT.jamPitchOffsetDeg);
  }
  return 0;
}

export function isHolderSettingUpShot(
  holderInShootZone: boolean,
  holderDistGoal: number,
): boolean {
  return (
    holderInShootZone || holderDistGoal <= BOT.goalQuickShotDist
  );
}

export function getHolderDistGoal(holderX: number, holderZ: number, team: Team): number {
  const g = getShootZoneCenter(team, _scratch);
  return Math.hypot(holderX - g.x, holderZ - g.z);
}

/** Distance to bottom ring mouth — better than mid-ring center for “near goal”. */
export function getDistToBottomRingMouth(
  x: number,
  y: number,
  z: number,
  team: Team,
): number {
  pickBotRingApproachTarget(team, 'large', y, _scratch);
  return Math.hypot(x - _scratch.x, z - _scratch.z);
}
