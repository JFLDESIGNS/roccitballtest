import { BOT } from '../shared/Constants';
import { clearTeammateBallChase } from './botTeamBallChase';
import type { BotId } from './gameStore';
import type { Team } from '../shared/Types';

const allySaveReactedAt = new Map<BotId, number>();

export type BotTeamReleaseKind = 'pass' | 'shot';

type TeamReleaseSignal = {
  team: Team;
  from: BotId;
  kind: BotTeamReleaseKind;
  at: number;
};

let lastRelease: TeamReleaseSignal | null = null;

export function recordBotTeamRelease(
  team: Team,
  from: BotId,
  kind: BotTeamReleaseKind,
): void {
  lastRelease = { team, from, kind, at: performance.now() / 1000 };
}

export function clearBotTeamRelease(): void {
  lastRelease = null;
  allySaveReactedAt.clear();
  clearTeammateBallChase();
}

export type TeammateReleaseIntent = {
  kind: BotTeamReleaseKind;
  from: BotId;
  at: number;
  waitBeamUntil: number;
};

/** Latest release from a teammate (not self), for pass reception / shot spacing */
export function getTeammateReleaseIntent(
  selfId: BotId,
  team: Team,
  now = performance.now() / 1000,
): TeammateReleaseIntent | null {
  if (!lastRelease || lastRelease.team !== team || lastRelease.from === selfId) {
    return null;
  }
  if (now - lastRelease.at > BOT.teamReleaseSignalTTL) {
    lastRelease = null;
    return null;
  }
  const waitBeamUntil =
    lastRelease.kind === 'shot'
      ? lastRelease.at + BOT.allyWaitAfterTeammateShotSec
      : lastRelease.at;
  return {
    kind: lastRelease.kind,
    from: lastRelease.from,
    at: lastRelease.at,
    waitBeamUntil,
  };
}

export function shouldWaitForTeammateShot(
  intent: TeammateReleaseIntent | null,
  now = performance.now() / 1000,
): boolean {
  return intent?.kind === 'shot' && now < intent.waitBeamUntil;
}

/** Latest goal attempt from the opposing team (for ally save rockets) */
export function getOpponentShotIntent(
  selfTeam: Team,
  now = performance.now() / 1000,
): TeammateReleaseIntent | null {
  if (!lastRelease || lastRelease.team === selfTeam || lastRelease.kind !== 'shot') {
    return null;
  }
  if (now - lastRelease.at > BOT.allySaveAfterOpponentShotWindowSec) {
    return null;
  }
  return {
    kind: 'shot',
    from: lastRelease.from,
    at: lastRelease.at,
    waitBeamUntil: lastRelease.at,
  };
}

/** One roll per bot per opponent shot */
export function shouldAllyReactSaveToOpponentShot(
  botId: BotId,
  selfTeam: Team,
  now = performance.now() / 1000,
): boolean {
  const intent = getOpponentShotIntent(selfTeam, now);
  if (!intent) return false;
  if (allySaveReactedAt.get(botId) === intent.at) return false;
  allySaveReactedAt.set(botId, intent.at);
  return Math.random() < BOT.allySaveBallAfterOpponentShotChance;
}
