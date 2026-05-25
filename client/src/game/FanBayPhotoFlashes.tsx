import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ARENA_PADS } from '../shared/Constants';
import type { Team } from '../shared/Types';
import { getFanCelebrationState } from './fanCelebration';
import { isFanBayGlassCelebrating } from './fanGlassHit';

const FT = 0.3048;
const MAX_FLASHES = 72;

type SeatLike = {
  x: number;
  y: number;
  z: number;
  color: number;
  jumpPhase: number;
  jumpSpeed: number;
  hopPortion: number;
  ampScale: number;
  yJitter: number;
  phaseDrift: number;
  swayPhase: number;
  swaySpeed: number;
};

type PhotoFlash = {
  active: boolean;
  seatIndex: number;
  born: number;
  duration: number;
};

type FanBayPhotoFlashesProps = {
  bayKey: string;
  seats: readonly SeatLike[];
  sphereR: number;
  maxFanX: number;
};

function fanMatchesScoringTeam(colorIndex: number, team: Team): boolean {
  return team === 'red' ? colorIndex === 0 : colorIndex === 1;
}

function fanSignHoldOffset(sphereR: number) {
  return {
    holdY: sphereR * 0.06 + FT,
    holdZ: sphereR + 0.34,
  };
}

function fanJumpOffset(
  time: number,
  phase: number,
  speed: number,
  amp: number,
  hopPortion: number,
): number {
  const cycle = ((time * speed + phase) % 1 + 1) % 1;
  if (cycle >= hopPortion) return 0;
  const u = cycle / hopPortion;
  return amp * Math.sin(u * Math.PI);
}

function pickRandomSeatIndex(seats: readonly SeatLike[], filter?: (s: SeatLike) => boolean): number {
  if (seats.length === 0) return -1;
  const tries = Math.min(12, seats.length);
  for (let i = 0; i < tries; i++) {
    const idx = Math.floor(Math.random() * seats.length);
    const seat = seats[idx]!;
    if (!filter || filter(seat)) return idx;
  }
  for (let i = 0; i < seats.length; i++) {
    if (!filter || filter(seats[i]!)) return i;
  }
  return -1;
}

function claimFlash(pool: PhotoFlash[]): PhotoFlash | null {
  const free = pool.find((f) => !f.active);
  if (free) return free;
  let oldest = pool[0]!;
  for (const f of pool) {
    if (f.born < oldest.born) oldest = f;
  }
  return oldest;
}

/** Brief emissive diamond — idle paparazzi pops + goal frenzy on scoring fans */
export function FanBayPhotoFlashes({
  bayKey,
  seats,
  sphereR,
  maxFanX,
}: FanBayPhotoFlashesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const pool = useMemo(
    () =>
      Array.from({ length: MAX_FLASHES }, () => ({
        active: false,
        seatIndex: 0,
        born: 0,
        duration: ARENA_PADS.fanPhotoFlashDurationSec,
      })),
    [],
  );
  const flashColor = useMemo(() => new THREE.Color(), []);
  const idleTimerRef = useRef(
    ARENA_PADS.fanPhotoIdleMinSec +
      Math.random() * (ARENA_PADS.fanPhotoIdleMaxSec - ARENA_PADS.fanPhotoIdleMinSec),
  );
  const goalBurstCooldownRef = useRef(0);
  const wasGoalActiveRef = useRef(false);

  const geo = useMemo(() => new THREE.OctahedronGeometry(1, 0), []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f4fbff',
        emissive: '#dff6ff',
        emissiveIntensity: 2.8,
        metalness: 0.15,
        roughness: 0.22,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
  }, []);

  const spawnFlash = (seatIndex: number, duration?: number) => {
    const flashDuration = duration ?? ARENA_PADS.fanPhotoFlashDurationSec;
    const slot = claimFlash(pool);
    if (!slot || seatIndex < 0) return;
    slot.active = true;
    slot.seatIndex = seatIndex;
    slot.born = performance.now() / 1000;
    slot.duration = flashDuration;
  };

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const now = performance.now() / 1000;
    const celebration = getFanCelebrationState(t);
    const glassCrazy = isFanBayGlassCelebrating(bayKey);
    const scoringCheer =
      celebration.active &&
      celebration.team !== null &&
      seats.some((s) => fanMatchesScoringTeam(s.color, celebration.team!));

    idleTimerRef.current -= dt;
    if (idleTimerRef.current <= 0 && !scoringCheer) {
      idleTimerRef.current =
        ARENA_PADS.fanPhotoIdleMinSec +
        Math.random() * (ARENA_PADS.fanPhotoIdleMaxSec - ARENA_PADS.fanPhotoIdleMinSec);
      if (Math.random() < ARENA_PADS.fanPhotoIdleChance) {
        spawnFlash(pickRandomSeatIndex(seats));
      }
    }

    if (scoringCheer && celebration.team) {
      const team = celebration.team;
      const filter = (s: SeatLike) => fanMatchesScoringTeam(s.color, team);
      if (!wasGoalActiveRef.current) {
        for (let i = 0; i < ARENA_PADS.fanPhotoGoalBurstCount; i++) {
          spawnFlash(pickRandomSeatIndex(seats, filter), ARENA_PADS.fanPhotoGoalFlashDurationSec);
        }
      }
      goalBurstCooldownRef.current -= dt;
      if (goalBurstCooldownRef.current <= 0) {
        goalBurstCooldownRef.current = ARENA_PADS.fanPhotoGoalBurstIntervalSec;
        const burst = Math.floor(
          ARENA_PADS.fanPhotoGoalBurstPerTick *
            (0.85 + Math.random() * 0.3),
        );
        for (let i = 0; i < burst; i++) {
          spawnFlash(pickRandomSeatIndex(seats, filter), ARENA_PADS.fanPhotoGoalFlashDurationSec);
        }
      }
    } else {
      goalBurstCooldownRef.current = 0;
    }
    wasGoalActiveRef.current = scoringCheer;

    const inst = meshRef.current;
    if (!inst) return;

    const baseAmp = ARENA_PADS.fanBounceAmpM;
    const baseSpeed = ARENA_PADS.fanBounceSpeed;
    const swayAmp = ARENA_PADS.fanSwayAmpM;
    const swayBase = ARENA_PADS.fanSwaySpeed;
    const { holdY, holdZ } = fanSignHoldOffset(sphereR);
    const diamondScale = sphereR * ARENA_PADS.fanPhotoDiamondScale;

    let n = 0;
    for (const flash of pool) {
      if (!flash.active) continue;
      const elapsed = now - flash.born;
      if (elapsed >= flash.duration) {
        flash.active = false;
        continue;
      }

      const seat = seats[flash.seatIndex];
      if (!seat) {
        flash.active = false;
        continue;
      }

      const lifeT = 1 - elapsed / flash.duration;
      const pop = Math.sin(Math.min(1, elapsed / (flash.duration * 0.22)) * Math.PI);
      const fade = lifeT * lifeT * pop;
      if (fade < 0.02) continue;

      const scoringFan =
        celebration.active &&
        celebration.team !== null &&
        fanMatchesScoringTeam(seat.color, celebration.team);
      const motionAmp = scoringFan || glassCrazy
        ? baseAmp * ARENA_PADS.fanCelebrateAmpMult * seat.ampScale
        : baseAmp * seat.ampScale;
      const motionSpeed = scoringFan || glassCrazy
        ? baseSpeed * ARENA_PADS.fanCelebrateSpeedMult * seat.jumpSpeed
        : baseSpeed * seat.jumpSpeed;
      const hop = scoringFan
        ? ARENA_PADS.fanCelebrateHopPortion
        : seat.hopPortion;

      const phase = (seat.jumpPhase + t * seat.phaseDrift * 0.11) % 1;
      const bounce = fanJumpOffset(t, phase, motionSpeed, motionAmp, hop);
      const swayX =
        swayAmp *
        Math.sin(t * swayBase * seat.swaySpeed + seat.swayPhase * Math.PI * 2);
      const fanX = Math.max(-maxFanX, Math.min(maxFanX, seat.x + swayX));

      dummy.position.set(
        fanX,
        seat.y + seat.yJitter + bounce + holdY + sphereR * 0.42,
        seat.z + holdZ + sphereR * 0.08,
      );
      dummy.rotation.set(0.38, t * 2.4 + flash.seatIndex * 0.17, 0.38);
      const s = diamondScale * (0.55 + fade * 0.95);
      dummy.scale.set(s, s * 1.35, s);
      dummy.updateMatrix();
      inst.setMatrixAt(n, dummy.matrix);

      const bright = fade * (scoringFan ? 1.15 : 0.92);
      flashColor.setRGB(0.72 * bright, 0.9 * bright, bright);
      inst.setColorAt(n, flashColor);
      n++;
    }

    inst.count = n;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, MAX_FLASHES]}
      frustumCulled={false}
      renderOrder={12}
    />
  );
}
