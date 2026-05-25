import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ARENA_PADS } from '../shared/Constants';
import type { Team } from '../shared/Types';
import { getFanCelebrationState } from './fanCelebration';
import { isFanBayGlassCelebrating } from './fanGlassHit';
import { FAN_BOOTH_RENDER_ORDER } from './renderOrderConstants';

const FT = 0.3048;
const MAX_FLASHES = 72;
const _lookAt = new THREE.Vector3();

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

type PhotoShooter = {
  seatIndex: number;
  shotsLeft: number;
  nextShotAt: number;
  flashDuration: number;
  gapMin: number;
  gapMax: number;
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

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function shuffleIndices(indices: number[]): number[] {
  const out = [...indices];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

function pickRandomSeatIndex(
  seats: readonly SeatLike[],
  filter?: (s: SeatLike) => boolean,
): number {
  if (seats.length === 0) return -1;
  const tries = Math.min(16, seats.length);
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

function buildShootersFromIndices(
  seatIndices: number[],
  flashDuration: number,
  nowSec: number,
  shotsMin: number = ARENA_PADS.fanPhotoShotsPerShooterMin,
  shotsMax: number = ARENA_PADS.fanPhotoShotsPerShooterMax,
  gapMin: number = ARENA_PADS.fanPhotoShotGapMinSec,
  gapMax: number = ARENA_PADS.fanPhotoShotGapMaxSec,
): PhotoShooter[] {
  const shooters: PhotoShooter[] = [];
  for (const seatIndex of seatIndices) {
    const shots = randInt(shotsMin, shotsMax);
    shooters.push({
      seatIndex,
      shotsLeft: shots,
      nextShotAt: nowSec + randFloat(0.02, 0.28),
      flashDuration,
      gapMin,
      gapMax,
    });
  }
  return shooters;
}

function buildGoalPhotographerSeats(seats: readonly SeatLike[], team: Team): number[] {
  const scoring: number[] = [];
  for (let i = 0; i < seats.length; i++) {
    if (fanMatchesScoringTeam(seats[i]!.color, team)) scoring.push(i);
  }
  if (scoring.length === 0) return [];
  const share = ARENA_PADS.fanPhotoGoalParticipationPct;
  const count = Math.max(2, Math.round(scoring.length * share));
  return shuffleIndices(scoring).slice(0, Math.min(count, scoring.length));
}

function buildGlassPhotographerSeats(seats: readonly SeatLike[]): number[] {
  const all = seats.map((_, i) => i);
  const count = Math.min(ARENA_PADS.fanPhotoGlassShooterCount, all.length);
  return shuffleIndices(all).slice(0, count);
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

/** Visible flash — quick rise, brief hold, soft fall */
function flashBrightness(elapsed: number, duration: number): number {
  const u = Math.min(1, Math.max(0, elapsed / duration));
  if (u < 0.14) return u / 0.14;
  if (u > 0.78) return Math.max(0, (1 - u) / 0.22);
  return 1;
}

function tickShooters(
  shooters: PhotoShooter[],
  nowSec: number,
  spawnFlash: (seatIndex: number, duration: number) => void,
): void {
  for (const shooter of shooters) {
    if (shooter.shotsLeft <= 0) continue;
    if (nowSec < shooter.nextShotAt) continue;
    spawnFlash(shooter.seatIndex, shooter.flashDuration);
    shooter.shotsLeft -= 1;
    if (shooter.shotsLeft > 0) {
      shooter.nextShotAt = nowSec + randFloat(shooter.gapMin, shooter.gapMax);
    }
  }
}

/** Bright camera-style flash — sparse idle snaps + limited goal/glass photographers */
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
  const wasGoalActiveRef = useRef(false);
  const goalShootersRef = useRef<PhotoShooter[]>([]);
  const wasGlassActiveRef = useRef(false);
  const glassShootersRef = useRef<PhotoShooter[]>([]);

  const geo = useMemo(() => new THREE.OctahedronGeometry(1, 0), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: ARENA_PADS.fanPhotoFlashOpacity,
        depthWrite: false,
        depthTest: true,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (mesh.instanceColor) mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
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

  const spawnIdleSnap = () => {
    if (ARENA_PADS.fanPhotoIdleBurstMax <= 0) return;
    const n = randInt(
      ARENA_PADS.fanPhotoIdleBurstMin,
      ARENA_PADS.fanPhotoIdleBurstMax,
    );
    for (let i = 0; i < n; i++) {
      spawnFlash(pickRandomSeatIndex(seats));
    }
  };

  useFrame(({ clock, camera }, dt) => {
    const t = clock.elapsedTime;
    const now = performance.now() / 1000;
    const celebration = getFanCelebrationState(t);
    const glassCrazy = isFanBayGlassCelebrating(bayKey);
    const scoringCheer =
      celebration.active &&
      celebration.team !== null &&
      seats.some((s) => fanMatchesScoringTeam(s.color, celebration.team!));

    idleTimerRef.current -= dt;
    if (idleTimerRef.current <= 0 && !scoringCheer && !glassCrazy) {
      idleTimerRef.current =
        ARENA_PADS.fanPhotoIdleMinSec +
        Math.random() * (ARENA_PADS.fanPhotoIdleMaxSec - ARENA_PADS.fanPhotoIdleMinSec);
      spawnIdleSnap();
    }

    if (scoringCheer && celebration.team) {
      if (!wasGoalActiveRef.current) {
        const seatsForGoal = buildGoalPhotographerSeats(seats, celebration.team);
        goalShootersRef.current = buildShootersFromIndices(
          seatsForGoal,
          ARENA_PADS.fanPhotoGoalFlashDurationSec,
          now,
          ARENA_PADS.fanPhotoGoalShotsPerShooterMin,
          ARENA_PADS.fanPhotoGoalShotsPerShooterMax,
          ARENA_PADS.fanPhotoGoalShotGapMinSec,
          ARENA_PADS.fanPhotoGoalShotGapMaxSec,
        );
      }
      tickShooters(goalShootersRef.current, now, spawnFlash);
    } else {
      goalShootersRef.current = [];
    }
    wasGoalActiveRef.current = scoringCheer;

    if (glassCrazy) {
      if (!wasGlassActiveRef.current) {
        const glassSeats = buildGlassPhotographerSeats(seats);
        glassShootersRef.current = buildShootersFromIndices(
          glassSeats,
          ARENA_PADS.fanPhotoGlassFlashDurationSec,
          now,
        );
      }
      tickShooters(glassShootersRef.current, now, spawnFlash);
    } else {
      glassShootersRef.current = [];
    }
    wasGlassActiveRef.current = glassCrazy;

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

      const fade = flashBrightness(elapsed, flash.duration);
      if (fade < 0.04) continue;

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

      _lookAt.set(
        fanX,
        seat.y + seat.yJitter + bounce + holdY + sphereR * 0.5,
        seat.z + holdZ + sphereR * 0.22,
      );
      dummy.position.copy(_lookAt);
      dummy.lookAt(camera.position);
      const s = diamondScale * (0.7 + fade * 0.95);
      dummy.scale.set(s, s * 1.2, s);
      dummy.updateMatrix();
      inst.setMatrixAt(n, dummy.matrix);

      const bright = fade * (scoringFan || glassCrazy ? 2.1 : 1.55);
      flashColor.setRGB(bright, bright, bright * 1.02);
      inst.setColorAt(n, flashColor);
      n++;
    }

    if (inst.count !== n) {
      inst.count = n;
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    } else if (n > 0) {
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, MAX_FLASHES]}
      frustumCulled={false}
      renderOrder={FAN_BOOTH_RENDER_ORDER + 1}
    />
  );
}
