import { useFrame } from '@react-three/fiber';
import type { RapierRigidBody } from '@react-three/rapier';
import { useRef } from 'react';
import { BALL_SPAWN, TEAM_SPAWN } from '../shared/Constants';
import { gameStore } from './gameStore';
import { tuningStore } from './tuningStore';
import { isGoalBallSuckActive } from './ballGoalSuck';
import {
  createFallTracker,
  recoverBody,
  tickSafePosition,
  type SafePosition,
} from './fallRecovery';
import type { BotRuntime } from './Bots';

type FallRecoveryMonitorProps = {
  playerBodyRef: React.RefObject<RapierRigidBody | null>;
  ballBodyRef: React.RefObject<RapierRigidBody | null>;
  botsRef: React.MutableRefObject<BotRuntime[]>;
  onRecoverPlayer: () => void;
  onRecoverBall: () => void;
};

export function FallRecoveryMonitor({
  playerBodyRef,
  ballBodyRef,
  botsRef,
  onRecoverPlayer,
  onRecoverBall,
}: FallRecoveryMonitorProps) {
  const team = gameStore.getState().localTeam;
  const playerFallback = useRef<SafePosition>({
    ...TEAM_SPAWN[team],
  });
  const ballFallback = useRef<SafePosition>({
    x: BALL_SPAWN.x,
    y: BALL_SPAWN.y,
    z: BALL_SPAWN.z,
  });
  const playerTrack = useRef(createFallTracker(playerFallback.current));
  const ballTrack = useRef(createFallTracker(ballFallback.current));

  useFrame((_, dt) => {
    const phase = gameStore.getState().phase;
    if (phase !== 'playing' && phase !== 'countdown' && phase !== 'loading') {
      return;
    }
    if (tuningStore.getState().showMenu) return;

    const gs = gameStore.getState();
    playerTrack.current.recoverCooldown = Math.max(
      0,
      playerTrack.current.recoverCooldown - dt,
    );
    ballTrack.current.recoverCooldown = Math.max(
      0,
      ballTrack.current.recoverCooldown - dt,
    );

    const player = playerBodyRef.current;
    if (player) {
      const t = player.translation();
      tickSafePosition(playerTrack.current, t.x, t.y, t.z, dt);
      if (
        recoverBody(player, playerTrack.current, playerFallback.current, 'player')
      ) {
        onRecoverPlayer();
      }
    }

    const holder = gs.ballHolderId;
    const ball = ballBodyRef.current;
    if (ball && holder === null && !gs.ballFrozen && !isGoalBallSuckActive()) {
      const t = ball.translation();
      tickSafePosition(ballTrack.current, t.x, t.y, t.z, dt);
      if (recoverBody(ball, ballTrack.current, ballFallback.current, 'ball')) {
        onRecoverBall();
      }
    } else if (ball && holder !== null) {
      const t = ball.translation();
      tickSafePosition(ballTrack.current, t.x, t.y, t.z, dt);
    }

    for (const bot of botsRef.current) {
      bot.fallTrack.recoverCooldown = Math.max(
        0,
        bot.fallTrack.recoverCooldown - dt,
      );
      const body = bot.bodyRef.current;
      if (!body || bot.combat.isRagdoll) continue;
      if (holder === bot.id) {
        const t = body.translation();
        tickSafePosition(bot.fallTrack, t.x, t.y, t.z, dt);
        continue;
      }
      const t = body.translation();
      tickSafePosition(bot.fallTrack, t.x, t.y, t.z, dt);
      if (recoverBody(body, bot.fallTrack, bot.spawn, `bot-${bot.id}`)) {
        bot.onRecovered();
      }
    }
  });

  return null;
}
