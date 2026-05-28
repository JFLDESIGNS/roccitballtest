import type { RefObject } from 'react';
import { CHARACTER_MESH_RENDER_ORDER } from './JerseyDecal';
import {
  BOT_FLAME_FORWARD_PITCH_DEG,
  BOT_THRUSTER_OFFSET_BACK_IN,
  BOT_THRUSTER_OFFSET_UP_IN,
  BOT_THRUSTER_SIZE_SCALE,
  PLAYER_FLAME_FORWARD_PITCH_DEG,
  DroneThrusterFlames,
} from './DroneThrusterFlames';
import { PlayerAvatar } from './PlayerAvatar';
import type { Team } from '../shared/Types';

type BotDroneVisualProps = {
  team: Team;
  /** Optional — preview bot keeps cones lit for alignment */
  throttleRef?: RefObject<number>;
};

/** Shared drone mesh + bot thruster placement (matches center alignment preview) */
export function BotDroneVisual({ team, throttleRef }: BotDroneVisualProps) {
  return (
    <group renderOrder={CHARACTER_MESH_RENDER_ORDER}>
      <PlayerAvatar rotationY={0} team={team} />
      <DroneThrusterFlames
        team={team}
        throttleRef={throttleRef}
        offsetUpIn={BOT_THRUSTER_OFFSET_UP_IN}
        offsetBackIn={BOT_THRUSTER_OFFSET_BACK_IN}
        forwardPitchDeg={BOT_FLAME_FORWARD_PITCH_DEG}
        sizeScale={BOT_THRUSTER_SIZE_SCALE}
      />
    </group>
  );
}

/** Thrusters only — parent under bob/tilt so cones follow pitch + bob */
export function BotDroneThrusters({
  team,
  throttleRef,
}: {
  team: Team;
  throttleRef?: RefObject<number>;
}) {
  return (
    <DroneThrusterFlames
      team={team}
      throttleRef={throttleRef}
      offsetUpIn={BOT_THRUSTER_OFFSET_UP_IN}
      offsetBackIn={BOT_THRUSTER_OFFSET_BACK_IN}
      forwardPitchDeg={BOT_FLAME_FORWARD_PITCH_DEG}
      sizeScale={BOT_THRUSTER_SIZE_SCALE}
    />
  );
}

/** Player thrusters — same placement as bots, +10° pitch vs bot cones */
export function PlayerDroneThrusters({
  team,
  throttleRef,
  jumpBoostRef,
}: {
  team: Team;
  throttleRef?: RefObject<number>;
  jumpBoostRef?: RefObject<number>;
}) {
  return (
    <DroneThrusterFlames
      team={team}
      throttleRef={throttleRef}
      jumpBoostRef={jumpBoostRef}
      offsetUpIn={BOT_THRUSTER_OFFSET_UP_IN}
      offsetBackIn={BOT_THRUSTER_OFFSET_BACK_IN}
      forwardPitchDeg={PLAYER_FLAME_FORWARD_PITCH_DEG}
      sizeScale={BOT_THRUSTER_SIZE_SCALE}
      idleOpacityScale={0.5}
    />
  );
}
