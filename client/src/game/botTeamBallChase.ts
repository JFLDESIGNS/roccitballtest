import { BOT } from '../shared/Constants';
import type { BotId } from './gameStore';
import type { Team } from '../shared/Types';

export type TeammateBallChaseResponse = 'join' | 'center' | 'offense' | 'defense';

type ChaseBroadcast = {
  team: Team;
  at: number;
};

const chaseBroadcast = new Map<BotId, ChaseBroadcast>();

export function clearTeammateBallChase(): void {
  chaseBroadcast.clear();
}

/** Call each frame when this bot is actively chasing the loose ball. */
export function setBotBallChaseActive(
  botId: BotId,
  team: Team,
  chasing: boolean,
  now = performance.now() / 1000,
): void {
  if (chasing) {
    chaseBroadcast.set(botId, { team, at: now });
    return;
  }
  chaseBroadcast.delete(botId);
}

export function findTeammateBallChaser(
  selfId: BotId,
  team: Team,
  now = performance.now() / 1000,
): BotId | null {
  const ttl = BOT.teammateBallChaseSignalTTL;
  for (const [id, entry] of chaseBroadcast) {
    if (id === selfId || entry.team !== team) continue;
    if (now - entry.at > ttl) {
      chaseBroadcast.delete(id);
      continue;
    }
    return id;
  }
  return null;
}

export function rollTeammateBallChaseResponse(): TeammateBallChaseResponse | null {
  const r = Math.random();
  const join = BOT.teammateBallChaseJoinChance;
  const center = BOT.teammateBallChaseCenterChance;
  const offense = BOT.teammateBallChaseOffenseChance;
  const defense = BOT.teammateBallChaseDefenseChance;
  if (r < join) return 'join';
  if (r < join + center) return 'center';
  if (r < join + center + offense) return 'offense';
  if (r < join + center + offense + defense) return 'defense';
  return null;
}
