import { BOT } from '../shared/Constants';
import type { BotId } from './gameStore';
import type { Team } from '../shared/Types';

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
