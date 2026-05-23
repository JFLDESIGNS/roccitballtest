import * as THREE from 'three';
import { BALL_SPAWN, BOT } from '../shared/Constants';
import type { BotId } from './gameStore';
import type { Team } from '../shared/Types';
import { getBallDropLayout } from './arenaLayout';

const _lane = new THREE.Vector3();

let lastCountdown = 0;
const oopBotByTeam: Partial<Record<Team, BotId>> = {};
let oopExpiresAt = 0;
/** When this bot first posted at the rim (pass-wait timer) */
const oopPassWaitStartByBot = new Map<BotId, number>();
const oopReturningHome = new Set<BotId>();

function clearOopPassWait(botId: BotId): void {
  oopPassWaitStartByBot.delete(botId);
}

/** Advance kickoff rolls — call once per frame from any bot */
export function tickKickoffState(
  phase: string,
  countdown: number,
  nowSec: number,
  roster: readonly { id: BotId; team: Team }[],
): void {
  if (phase !== 'playing') {
    lastCountdown = 0;
    oopBotByTeam.red = undefined;
    oopBotByTeam.blue = undefined;
    oopExpiresAt = 0;
    oopPassWaitStartByBot.clear();
    oopReturningHome.clear();
    return;
  }

  if (countdown > 0 && lastCountdown === 0) {
    oopBotByTeam.red = undefined;
    oopBotByTeam.blue = undefined;
    oopPassWaitStartByBot.clear();
    oopReturningHome.clear();
    for (const team of ['red', 'blue'] as const) {
      const teamBots = roster.filter((r) => r.team === team);
      if (teamBots.length === 0) continue;
      if (Math.random() < BOT.kickoffAllyOopChance) {
        oopBotByTeam[team] =
          teamBots[Math.floor(Math.random() * teamBots.length)]!.id;
      }
    }
    oopExpiresAt = 0;
  }

  if (countdown === 0 && lastCountdown > 0) {
    const anyOop = oopBotByTeam.red ?? oopBotByTeam.blue;
    if (anyOop) {
      oopExpiresAt = nowSec + BOT.kickoffAllyOopDurationSec;
    }
  }

  if (oopExpiresAt > 0 && nowSec >= oopExpiresAt) {
    for (const id of [oopBotByTeam.red, oopBotByTeam.blue]) {
      if (id) beginKickoffAllyOopReturnHome(id);
    }
    oopBotByTeam.red = undefined;
    oopBotByTeam.blue = undefined;
    oopExpiresAt = 0;
  }

  lastCountdown = countdown;
}

export function isKickoffAllyOopBot(botId: BotId, nowSec: number): boolean {
  const assigned =
    oopBotByTeam.red === botId || oopBotByTeam.blue === botId;
  if (!assigned) return false;
  if (oopExpiresAt === 0) return true;
  return nowSec < oopExpiresAt;
}

export function isKickoffAllyOopReturningHome(botId: BotId): boolean {
  return oopReturningHome.has(botId);
}

export function beginKickoffAllyOopReturnHome(botId: BotId): void {
  if (oopBotByTeam.red === botId) oopBotByTeam.red = undefined;
  if (oopBotByTeam.blue === botId) oopBotByTeam.blue = undefined;
  clearOopPassWait(botId);
  oopReturningHome.add(botId);
}

/** Caught the lob or normal play — leave alley-oop without running home */
export function endKickoffAllyOopForBot(botId: BotId): void {
  if (oopBotByTeam.red === botId) oopBotByTeam.red = undefined;
  if (oopBotByTeam.blue === botId) oopBotByTeam.blue = undefined;
  clearOopPassWait(botId);
  oopReturningHome.delete(botId);
}

export function clearKickoffAllyOopReturnHome(botId: BotId): void {
  oopReturningHome.delete(botId);
}

export function noteKickoffAllyOopAtRim(botId: BotId, nowSec: number): void {
  if (!oopPassWaitStartByBot.has(botId)) {
    oopPassWaitStartByBot.set(botId, nowSec);
  }
}

export function kickoffAllyOopPassWaitExceeded(
  botId: BotId,
  nowSec: number,
): boolean {
  const start = oopPassWaitStartByBot.get(botId);
  if (start === undefined) return false;
  return nowSec - start >= BOT.kickoffAllyOopPassWaitSec;
}

export function getKickoffAllyOopReturnCenter(
  feetY: number,
  out = _lane,
): THREE.Vector3 {
  return out.set(BOT.celebrateCenterX, feetY, BOT.celebrateCenterZ);
}

export function isKickoffContestPhase(
  phase: string,
  countdown: number,
  ballFrozen: boolean,
): boolean {
  return phase === 'playing' && (countdown > 0 || ballFrozen);
}

/** World point bots jump toward during countdown / flap hold */
export function getKickoffBallAimPoint(out = new THREE.Vector3()): THREE.Vector3 {
  const { spawnY } = getBallDropLayout();
  return out.set(BALL_SPAWN.x, spawnY, BALL_SPAWN.z);
}

/** Spread bots under the drop so they do not stack */
export function pickKickoffContestGroundTarget(
  botId: BotId,
  feetY: number,
  out = _lane,
): THREE.Vector3 {
  const laneZ =
    botId === 'bot-0' ? -5.5 : botId === 'bot-1' ? 5.5 : 0;
  const laneX = botId === 'bot-2' ? 2.5 : -2.5;
  return out.set(BALL_SPAWN.x + laneX, feetY, BALL_SPAWN.z + laneZ);
}

export function kickoffContestSprintSpeed(): number {
  return BOT.sprintSpeed * BOT.kickoffContestSprintMult;
}

export function kickoffContestJumpForce(baseJump: number): number {
  return baseJump * BOT.kickoffContestJumpForceScale;
}
