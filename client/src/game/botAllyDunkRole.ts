import * as THREE from 'three';
import { BEAM } from '../shared/Constants';
import type { BallHolderId, BotId } from './gameStore';
import type { Team } from '../shared/Types';
import type { BotRuntime } from './Bots';
import { isFriendlyBallHolder } from './botBrain';
import {
  getDistToBottomRingMouth,
  isFriendlyHolderNearGoal,
  isNearEnemyGoal,
  pickAllyDunkSpot,
} from './botGoalOffense';

const _spot = new THREE.Vector3();
const _self = new THREE.Vector3();

function holderTeam(
  holder: BallHolderId,
  localTeam: Team,
  allBots: readonly BotRuntime[],
): Team | null {
  if (holder === null) return null;
  if (holder === 'local') return localTeam;
  return allBots.find((b) => b.id === holder)?.team ?? null;
}

/** One bot per team posts under the rim — closest valid candidate wins */
export function pickTeamAllyDunkPosterId(
  team: Team,
  holder: BallHolderId,
  localTeam: Team,
  allBots: readonly BotRuntime[],
  holderX: number,
  holderZ: number,
): BotId | null {
  if (holder === null) return null;
  if (!isFriendlyBallHolder(holder, team, localTeam)) return null;
  if (holderTeam(holder, localTeam, allBots) !== team) return null;
  if (!isFriendlyHolderNearGoal(holderX, holderZ, team)) return null;

  let bestId: BotId | null = null;
  let bestDist = Infinity;

  for (const b of allBots) {
    if (b.team !== team || b.id === holder) continue;
    const body = b.bodyRef.current;
    if (!body) continue;
    const t = body.translation();
    _self.set(t.x, t.y, t.z);
    pickAllyDunkSpot(team, _self, _spot);
    const distSpot = Math.hypot(t.x - _spot.x, t.z - _spot.z);
    const distGoal = getDistToBottomRingMouth(
      t.x,
      t.y + BEAM.chestHeight,
      t.z,
      team,
    );
    if (!isNearEnemyGoal(distGoal)) continue;
    if (distSpot < bestDist) {
      bestDist = distSpot;
      bestId = b.id;
    }
  }

  return bestId;
}

export function isBotTeamAllyDunkPoster(
  botId: BotId,
  team: Team,
  holder: BallHolderId,
  localTeam: Team,
  allBots: readonly BotRuntime[],
  holderX: number,
  holderZ: number,
): boolean {
  return (
    pickTeamAllyDunkPosterId(
      team,
      holder,
      localTeam,
      allBots,
      holderX,
      holderZ,
    ) === botId
  );
}
