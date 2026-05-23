import { gameStore } from './gameStore';
import { getDisplayName, type ActorId } from './playerRoster';

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
  const name = getDisplayName(strikerId);
  gameStore.postAnnouncement(`${name} hit the ball mid-air!`);
}

/** Direct rocket hit on another player */
export function announceRocketPlayerHit(
  attackerId: ActorId,
  victimId: ActorId,
): void {
  if (!canAnnounce()) return;
  if (attackerId === victimId) return;
  const a = getDisplayName(attackerId);
  const v = getDisplayName(victimId);
  gameStore.postAnnouncement(`${a} just hit ${v} with a roccit!`);
}

/** Bot ragdoll after two local-player rocket hits */
export function announceBotDestroyed(
  attackerId: ActorId,
  victimId: ActorId,
): void {
  if (!canAnnounce()) return;
  if (attackerId === victimId) return;
  const a = getDisplayName(attackerId);
  const v = getDisplayName(victimId);
  gameStore.postAnnouncement(`${a} just destroyed ${v}`);
}

/** Rocket struck the ball */
export function announceRocketBallHit(attackerId: ActorId, ballY: number): void {
  if (!canAnnounce()) return;
  if (ballY < 1.2) return;
  const name = getDisplayName(attackerId);
  if (ballY >= MID_AIR_MIN_Y) {
    gameStore.postAnnouncement(`${name} hit the ball mid-air!`);
  } else {
    gameStore.postAnnouncement(`${name} blasted the ball!`);
  }
}
