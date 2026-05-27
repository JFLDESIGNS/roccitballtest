import { gameStore } from './gameStore';
import { multiplayerStore } from '../multiplayer/multiplayerStore';
import {
  getDisplayName,
  getLocalProfile,
  type ActorId,
} from './playerRoster';

const MID_AIR_MIN_Y = 2.15;
const MIN_STRIKE_SPEED = 2.4;
const COOLDOWN_MS = 1200;

let lastAt = 0;

function canAnnounce(): boolean {
  const now = performance.now();
  if (now - lastAt < COOLDOWN_MS) return false;
  lastAt = now;
  return true;
}

function displayNameFor(id: string): string {
  if (id === 'local' || id === 'bot-0' || id === 'bot-1' || id === 'bot-2') {
    return getDisplayName(id as ActorId);
  }
  const multiplayer = multiplayerStore.getState();
  if (id === multiplayer.selfId) return getLocalProfile().displayName;
  const remote = multiplayer.remotePlayers.find((player) => player.id === id);
  return remote?.name || 'Player';
}

export function isBallMidAir(y: number, vy: number): boolean {
  return y >= MID_AIR_MIN_Y && vy > -0.35;
}

/** Ball struck by a character (body contact) while airborne */
export function announceBallStrike(
  strikerId: ActorId,
  ballY: number,
  ballVy: number,
  impactSpeed: number,
): void {
  if (!canAnnounce()) return;
  if (!isBallMidAir(ballY, ballVy)) return;
  if (impactSpeed < MIN_STRIKE_SPEED) return;
  const name = displayNameFor(strikerId);
  gameStore.postAnnouncement(`${name} hit the ball mid-air!`);
}

/** Direct rocket hit on another player */
export function announceRocketPlayerHit(
  attackerId: ActorId,
  victimId: ActorId,
): void {
  if (!canAnnounce()) return;
  if (attackerId === victimId) return;
  const a = displayNameFor(attackerId);
  const v = displayNameFor(victimId);
  gameStore.postAnnouncement(`${a} just hit ${v} with a roccit!`);
}

/** Bot ragdoll after two local-player rocket hits */
export function announceBotDestroyed(
  attackerId: ActorId,
  victimId: ActorId,
): void {
  if (!canAnnounce()) return;
  if (attackerId === victimId) return;
  const a = displayNameFor(attackerId);
  const v = displayNameFor(victimId);
  gameStore.postAnnouncement(`${a} just destroyed ${v}`);
}

/** Rocket struck the ball */
export function announceRocketBallHit(attackerId: string, ballY: number): void {
  if (!canAnnounce()) return;
  if (ballY < 1.2) return;
  const name = displayNameFor(attackerId);
  if (ballY >= MID_AIR_MIN_Y) {
    gameStore.postAnnouncement(`${name} hit the ball mid-air!`);
  } else {
    gameStore.postAnnouncement(`${name} blasted the ball!`);
  }
}
