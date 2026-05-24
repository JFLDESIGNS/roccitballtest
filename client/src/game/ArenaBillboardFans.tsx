import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody, interactionGroups } from '@react-three/rapier';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ARENA, ARENA_PADS, BALL } from '../shared/Constants';
import type { Team } from '../shared/Types';
import type { WallMount } from './arenaPadLayout';
import { arenaWallMaterial } from './arenaMaterials';
import { getFanCelebrationState } from './fanCelebration';
import {
  fanBayHomeTeam,
  fanBayKey,
  isFanBayGlassCelebrating,
  registerFanGlassMesh,
  unregisterFanGlass,
} from './fanGlassHit';

const FT = 0.3048;
const FAN_COLOR_RED = 0;
const FAN_COLOR_BLUE = 1;
const FAN_COLOR_GREEN = 2;
/** Team crowd colors — mostly red/blue with rare green accents */
const FAN_PALETTE = ['#ff5522', '#3388ff', '#4ecf6a'] as const;

/** Home-team crowd with sparse green + away accents */
function fanColorIndex(
  row: number,
  col: number,
  seat: number,
  homeTeam: Team,
): number {
  const hash = (row * 17 + col * 31 + seat * 13) % 100;
  const homeColor = homeTeam === 'red' ? FAN_COLOR_RED : FAN_COLOR_BLUE;
  const awayColor = homeTeam === 'red' ? FAN_COLOR_BLUE : FAN_COLOR_RED;
  if (hash < 5) return FAN_COLOR_GREEN;
  if (hash < 95) return homeColor;
  return awayColor;
}

function fanMatchesScoringTeam(colorIndex: number, team: Team): boolean {
  return team === 'red'
    ? colorIndex === FAN_COLOR_RED
    : colorIndex === FAN_COLOR_BLUE;
}
const WALL_COLLISION = interactionGroups(2, [0, 1, 2]);
/** Booth interior — players/bots only; ball bounces on the glass facade instead. */
const FAN_BOOTH_INTERIOR_COLLISION = interactionGroups(2, [0, 2]);
const FAN_GLASS_RESTITUTION = BALL.restitution * 0.62;

function fanOpeningWorldY() {
  const bottom =
    ARENA_PADS.fanBayCenterYM - ARENA_PADS.fanBayHeightM * 0.5;
  const top = ARENA_PADS.fanBayCenterYM + ARENA_PADS.fanBayHeightM * 0.5;
  return { bottom, top };
}

/** Short hop: grounded most of the cycle, quick pop up then drop. */
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

const FAN_SIGN_MAX_TILT = (5 * Math.PI) / 180;
const FAN_SIGN_BASE_PITCH = 0.045;

function fanSignTiltTarget(
  t: number,
  seatIndex: number,
  seat: SeatSlot,
  crazy: boolean,
): { x: number; y: number; z: number } {
  const seed = seatIndex * 1.73 + seat.swayPhase * 11.3;
  const slow = 0.28 + (seatIndex % 7) * 0.045;
  const amp = crazy ? FAN_SIGN_MAX_TILT * 1.25 : FAN_SIGN_MAX_TILT;
  const pitch =
    FAN_SIGN_BASE_PITCH +
    Math.sin(t * slow + seed) * amp * 0.62 +
    Math.sin(t * slow * 0.41 + seed * 2.1) * amp * 0.28;
  const yaw =
    Math.sin(t * slow * 0.76 + seed * 1.37) * amp * 0.52 +
    Math.cos(t * slow * 0.33 + seed * 0.8) * amp * 0.18;
  const roll =
    Math.cos(t * slow * 0.58 + seed * 0.95) * amp * 0.42 +
    Math.sin(t * slow * 0.29 + seed * 1.6) * amp * 0.15;
  return { x: pitch, y: yaw, z: roll };
}

function fanSignHoldOffset(sphereR: number) {
  return {
    /** Held above the fan head (~1 ft) */
    holdY: sphereR * 0.06 + FT,
    /** In front of sphere toward glass / court (+Z) */
    holdZ: sphereR + 0.34,
  };
}

const FAN_CELEBRATE_SLOW = 0.75;

function fanCelebrateDiagOffset(
  t: number,
  seatKey: number,
  swaySpeed: number,
  swayPhase: number,
): { dx: number; dz: number } {
  const amp = ARENA_PADS.fanCelebrateDiagAmpM;
  const spd = ARENA_PADS.fanCelebrateDiagSpeed * FAN_CELEBRATE_SLOW;
  const phase = swayPhase * Math.PI * 2 + seatKey * 0.41;
  return {
    dx: amp * 0.58 * Math.sin(t * spd * swaySpeed + phase),
    dz: amp * Math.cos(t * spd * swaySpeed * 0.93 + phase * 1.17),
  };
}

function fanCelebrateMotion(
  baseSpeed: number,
  baseAmp: number,
  baseHop: number,
  glassCrazy: boolean,
  scoringCheer: boolean,
): { speed: number; amp: number; hopPortion: number; crazy: boolean } {
  if (glassCrazy) {
    return {
      speed:
        baseSpeed *
        ARENA_PADS.fanGlassCelebrateSpeedMult *
        FAN_CELEBRATE_SLOW,
      amp: baseAmp * ARENA_PADS.fanGlassCelebrateAmpMult,
      hopPortion: ARENA_PADS.fanGlassCelebrateHopPortion,
      crazy: true,
    };
  }
  if (scoringCheer) {
    return {
      speed:
        baseSpeed * ARENA_PADS.fanCelebrateSpeedMult * FAN_CELEBRATE_SLOW,
      amp: baseAmp * ARENA_PADS.fanCelebrateAmpMult,
      hopPortion: ARENA_PADS.fanCelebrateHopPortion,
      crazy: true,
    };
  }
  return { speed: baseSpeed, amp: baseAmp, hopPortion: baseHop, crazy: false };
}

function fanJumpTraits(row: number, col: number, seat: number) {
  const h = row * 41 + col * 19 + seat * 7;
  const h2 = row * 13 + col * 37 + seat * 29;
  return {
    jumpPhase: (h % 997) / 997,
    jumpSpeed: 0.52 + ((h2 * 3) % 88) / 100,
    hopPortion: 0.16 + ((h2 * 5) % 32) / 100,
    ampScale: 0.72 + ((h2 * 11) % 52) / 100,
    yJitter: ((h2 * 23) % 24) / 100 - 0.12,
    phaseDrift: 0.04 + ((h2 * 31) % 60) / 100,
    swayPhase: ((h2 * 17) % 997) / 997,
    swaySpeed: 0.85 + ((h * 7) % 70) / 100,
  };
}

type SeatSlot = {
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

type FanBayProps = {
  mount: WallMount;
  bayKey: string;
  homeTeam: Team;
};

type FanCrowdSignProps = {
  seat: SeatSlot;
  seatIndex: number;
  color: string;
  width: number;
  height: number;
  sphereR: number;
  bayKey: string;
  maxFanX: number;
};

function FanCrowdSign({
  seat,
  seatIndex,
  color,
  width,
  height,
  sphereR,
  bayKey,
  maxFanX,
}: FanCrowdSignProps) {
  const groupRef = useRef<THREE.Group>(null);
  const tiltRef = useRef(new THREE.Euler(FAN_SIGN_BASE_PITCH, 0, 0));
  const { holdY, holdZ } = fanSignHoldOffset(sphereR);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.position.set(seat.x, seat.y + seat.yJitter + holdY, seat.z + holdZ);
    tiltRef.current.set(FAN_SIGN_BASE_PITCH, 0, 0);
    group.rotation.copy(tiltRef.current);
    group.visible = true;
  }, [seat, holdY, holdZ]);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const t = clock.elapsedTime;
    const glassCrazy = isFanBayGlassCelebrating(bayKey);
    const celebration = getFanCelebrationState(t);
    const scoringCheer =
      celebration.active &&
      celebration.team !== null &&
      fanMatchesScoringTeam(seat.color, celebration.team);
    const motion = fanCelebrateMotion(
      ARENA_PADS.fanBounceSpeed * seat.jumpSpeed,
      ARENA_PADS.fanBounceAmpM * seat.ampScale,
      seat.hopPortion,
      glassCrazy,
      scoringCheer,
    );

    const phase = (seat.jumpPhase + t * seat.phaseDrift * 0.11) % 1;
    const bounce = fanJumpOffset(
      t,
      phase,
      motion.speed,
      motion.amp,
      motion.hopPortion,
    );
    const swayX =
      ARENA_PADS.fanSwayAmpM *
      Math.sin(
        t * ARENA_PADS.fanSwaySpeed * seat.swaySpeed +
          seat.swayPhase * Math.PI * 2,
      );
    const diag = motion.crazy
      ? fanCelebrateDiagOffset(t, seatIndex, seat.swaySpeed, seat.swayPhase)
      : { dx: 0, dz: 0 };

    group.position.set(
      Math.max(-maxFanX, Math.min(maxFanX, seat.x + swayX + diag.dx)),
      seat.y + seat.yJitter + bounce + holdY,
      seat.z + holdZ + diag.dz,
    );

    const target = fanSignTiltTarget(
      t,
      seatIndex,
      seat,
      motion.crazy,
    );
    const homePull = motion.crazy ? 0.08 : 0.14;
    target.x += (FAN_SIGN_BASE_PITCH - target.x) * homePull;
    target.y *= 1 - homePull;
    target.z *= 1 - homePull;

    const ease = 1 - Math.exp(-2.4 * Math.min(delta, 0.05));
    tiltRef.current.x += (target.x - tiltRef.current.x) * ease;
    tiltRef.current.y += (target.y - tiltRef.current.y) * ease;
    tiltRef.current.z += (target.z - tiltRef.current.z) * ease;
    group.rotation.copy(tiltRef.current);
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh position={[0, 0, 0.06]} renderOrder={6}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.42}
          roughness={0.82}
          metalness={0.06}
          side={THREE.FrontSide}
          depthTest
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function pickSignSeatIndices(
  displayRows: number,
  cols: number,
  count: number,
): number[] {
  const rowSlots = [1, 2, 3, 4, 5, 6, 7].filter((r) => r < displayRows);
  const colSlots = [1, 3, 4, 6, 7, 8, 9].filter((c) => c < cols);
  const picks: number[] = [];
  for (let i = 0; i < count; i++) {
    const r = rowSlots[i % rowSlots.length]!;
    const c = colSlots[(i * 2 + 1) % colSlots.length]!;
    picks.push(r * cols + c);
  }
  return picks;
}

function FanBay({ mount, bayKey, homeTeam }: FanBayProps) {
  const rootRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const bayW = ARENA_PADS.fanBayWidthM;
  const bayH = ARENA_PADS.fanBayHeightM;
  const bayD = ARENA_PADS.fanBayDepthFt * FT;
  const cols = ARENA_PADS.fanCols;
  const rows = ARENA_PADS.fanRows;
  const wallT = ARENA.wallThickness;
  const sphereR = ARENA_PADS.fanSphereRadiusM;
  const benchH = ARENA_PADS.fanBenchHeightM;

  const bayY = 0;
  const glassThick = ARENA_PADS.fanFacadeGlassThicknessM;
  /** Wall opening plane (split-wall cut) — glass stays here */
  const wallOpeningZ = -wallT / 2 - 0.02;
  /** Shift recess assembly toward court (+Z in wall-local) */
  const recessShiftZ = ARENA_PADS.fanBayForwardNudgeM;
  const lipZ = wallOpeningZ + recessShiftZ;
  /** Glass court face pushed toward opening (+Z wall-local) */
  const glassCourtFaceZ = wallOpeningZ + ARENA_PADS.fanFacadeGlassForwardM;
  const glassZ = glassCourtFaceZ - glassThick * 0.5;
  const glassBackZ = glassCourtFaceZ - glassThick;
  const recessCenterZ = lipZ - bayD * 0.5;
  const backZ = lipZ - bayD + 0.12;
  const sideInset = 0.14;

  const glassMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#030405',
        transparent: true,
        opacity: ARENA_PADS.fanFacadeGlassOpacity,
        transmission: ARENA_PADS.fanFacadeGlassTransmission,
        thickness: 0.14,
        roughness: 0.12,
        metalness: 0.2,
        reflectivity: 1,
        ior: 1.5,
        envMapIntensity: 0.65,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [],
  );

  const { seats, rowBenches } = useMemo(() => {
    const slots: SeatSlot[] = [];
    const benches: { y: number; z: number }[] = [];
    const padX = sphereR + ARENA_PADS.fanRowSideMarginM;
    const usableW = bayW - padX * 2;
    const stepX = usableW / Math.max(cols - 1, 1);

    const floorY = bayY - bayH * 0.5 + benchH * 0.5 + 0.06;
    const topBenchY = bayY + bayH * 0.5 - benchH * 0.5 - 0.35;
    const displayRows = rows - 1;
    const rowStepY = (topBenchY - floorY) / Math.max(displayRows - 1, 1);
    const frontZ =
      glassBackZ - ARENA_PADS.fanGlassFanClearanceM - benchH * 0.55;
    const backRowZ = lipZ - bayD + benchH + 0.35;
    const rowStepZ = (backRowZ - frontZ) / Math.max(rows - 1, 1);

    for (let r = 0; r < displayRows; r++) {
      const benchCenterY = floorY + r * rowStepY;
      const rowZ = frontZ + r * rowStepZ;
      benches.push({ y: benchCenterY, z: rowZ });
      const seatY =
        benchCenterY +
        benchH * 0.5 +
        sphereR +
        ARENA_PADS.fanSeatLiftM;
      const staggerX = (r % 2) * stepX * 0.42;
      const rowHalfW = usableW * 0.5 - sphereR - 0.06;

      for (let c = 0; c < cols; c++) {
        const jump = fanJumpTraits(r, c, r * cols + c);
        let seatX = -usableW * 0.5 + c * stepX + staggerX;
        seatX = Math.max(-rowHalfW, Math.min(rowHalfW, seatX));
        slots.push({
          x: seatX,
          y: seatY,
          z: rowZ + ((c % 3) - 1) * 0.06,
          color: fanColorIndex(r, c, r * cols + c, homeTeam),
          ...jump,
        });
      }
    }

    return { seats: slots, rowBenches: benches };
  }, [bayW, bayH, bayY, lipZ, bayD, glassBackZ, cols, rows, sphereR, benchH, recessCenterZ, homeTeam]);

  const sphereGeo = useMemo(
    () => new THREE.SphereGeometry(sphereR, 20, 16),
    [sphereR],
  );
  const sphereMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.48,
        metalness: 0.12,
        flatShading: false,
      }),
    [],
  );
  const fanColors = useMemo(
    () => FAN_PALETTE.map((hex) => new THREE.Color(hex)),
    [],
  );

  const recessMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1a222c',
        roughness: 0.94,
        metalness: 0.03,
      }),
    [],
  );
  const benchMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#2a3544',
        roughness: 0.9,
        metalness: 0.05,
      }),
    [],
  );

  const displayRows = rows - 1;
  const maxFanX =
    bayW * 0.5 - sphereR - ARENA_PADS.fanRowSideMarginM - 0.04;

  const signAnchors = useMemo(() => {
    const count = ARENA_PADS.fanSignCount;
    const teamPalette =
      homeTeam === 'blue'
        ? (['#3388ff', '#2255aa', '#88ccff', '#aaccee'] as const)
        : (['#ff5522', '#cc3311', '#ff8866', '#ffaa88'] as const);
    const seatIndices = pickSignSeatIndices(displayRows, cols, count);
    return seatIndices
      .filter((idx) => idx < displayRows * cols)
      .map((seatIndex, i) => ({
        seatIndex,
        color: teamPalette[i % teamPalette.length]!,
        width: (1.05 + (i % 2) * 0.22) * 1.5 * 2 * 0.75,
        height: (0.42 + (i % 3) * 0.08) * 1.5 * 2.35 * 0.75,
      }));
  }, [displayRows, cols, homeTeam]);

  useEffect(() => {
    return () => unregisterFanGlass(bayKey);
  }, [bayKey]);

  useLayoutEffect(() => {
    const inst = meshRef.current;
    if (!inst) return;
    for (let i = 0; i < seats.length; i++) {
      const o = seats[i]!;
      dummy.position.set(o.x, o.y + o.yJitter, o.z);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  }, [seats, dummy]);

  useFrame(({ clock }) => {
    const inst = meshRef.current;
    if (!inst) return;
    const t = clock.elapsedTime;
    const baseAmp = ARENA_PADS.fanBounceAmpM;
    const baseSpeed = ARENA_PADS.fanBounceSpeed;
    const swayAmp = ARENA_PADS.fanSwayAmpM;
    const swayBase = ARENA_PADS.fanSwaySpeed;
    const maxFanXLocal =
      bayW * 0.5 - sphereR - ARENA_PADS.fanRowSideMarginM - 0.04;
    const celebration = getFanCelebrationState(t);
    const glassCrazy = isFanBayGlassCelebrating(bayKey);

    for (let i = 0; i < seats.length; i++) {
      const o = seats[i]!;
      const scoringCheer =
        celebration.active &&
        celebration.team !== null &&
        fanMatchesScoringTeam(o.color, celebration.team);
      const motion = fanCelebrateMotion(
        baseSpeed * o.jumpSpeed,
        baseAmp * o.ampScale,
        o.hopPortion,
        glassCrazy,
        scoringCheer,
      );

      const phase =
        (o.jumpPhase + t * o.phaseDrift * 0.11) % 1;
      const bounce = fanJumpOffset(
        t,
        phase,
        motion.speed,
        motion.amp,
        motion.hopPortion,
      );
      const swayX =
        swayAmp *
        Math.sin(
          t * swayBase * o.swaySpeed + o.swayPhase * Math.PI * 2,
        );
      const diag = motion.crazy
        ? fanCelebrateDiagOffset(t, i, o.swaySpeed, o.swayPhase)
        : { dx: 0, dz: 0 };
      const fanX = Math.max(
        -maxFanXLocal,
        Math.min(maxFanXLocal, o.x + swayX + diag.dx),
      );
      dummy.position.set(fanX, o.y + o.yJitter + bounce, o.z + diag.dz);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, fanColors[o.color]!);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  });

  return (
    <group
      ref={rootRef}
      position={[mount.x, mount.y, mount.z]}
      rotation={[0, mount.yaw, 0]}
    >
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[bayW / 2, bayH / 2, 0.22]}
          position={[0, bayY + bayH * 0.08, backZ]}
          friction={0.2}
          restitution={BALL.restitution}
          collisionGroups={FAN_BOOTH_INTERIOR_COLLISION}
        />
      </RigidBody>

      <mesh
        position={[-bayW * 0.5 + sideInset, bayY, recessCenterZ]}
        material={arenaWallMaterial}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[sideInset * 2, bayH, bayD]} />
      </mesh>
      <mesh
        position={[bayW * 0.5 - sideInset, bayY, recessCenterZ]}
        material={arenaWallMaterial}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[sideInset * 2, bayH, bayD]} />
      </mesh>
      <mesh position={[0, bayY - bayH * 0.5 + 0.1, recessCenterZ]} material={recessMat}>
        <boxGeometry args={[bayW, 0.2, bayD]} />
      </mesh>
      {/* Full-height interior back wall */}
      <mesh
        position={[0, bayY, lipZ - bayD + 0.18]}
        material={recessMat}
        receiveShadow
      >
        <boxGeometry args={[bayW * 0.98, bayH * 1.08, 0.34]} />
      </mesh>
      <mesh
        position={[0, bayY, backZ]}
        material={arenaWallMaterial}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[bayW, bayH * 1.06, 0.28]} />
      </mesh>
      <mesh
        position={[0, bayY + bayH * 0.5 - 0.14, recessCenterZ]}
        material={arenaWallMaterial}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[bayW * 0.98, 0.28, bayD * 0.96]} />
      </mesh>

      {rowBenches.map((bench, i) => (
        <mesh
          key={`bench-${i}`}
          position={[0, bench.y, bench.z]}
          material={benchMat}
          castShadow={false}
          receiveShadow
          visible={false}
        >
          <boxGeometry args={[bayW * 0.9, benchH, 0.44]} />
        </mesh>
      ))}

      <instancedMesh
        ref={meshRef}
        args={[sphereGeo, sphereMat, seats.length]}
        frustumCulled={false}
        renderOrder={1}
      />

      {signAnchors.map((sign) => {
        const seat = seats[sign.seatIndex];
        if (!seat) return null;
        return (
          <FanCrowdSign
            key={`fan-sign-${sign.seatIndex}`}
            seat={seat}
            seatIndex={sign.seatIndex}
            color={sign.color}
            width={sign.width}
            height={sign.height}
            sphereR={sphereR}
            bayKey={bayKey}
            maxFanX={maxFanX}
          />
        );
      })}

      {/* Glass physics — thicker than visual so fast balls don't tunnel / double-hit */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[
            (bayW * 0.992) / 2,
            (bayH * 0.992) / 2,
            ARENA_PADS.fanGlassColliderDepthM / 2,
          ]}
          position={[0, bayY, glassZ]}
          friction={0.22}
          restitution={FAN_GLASS_RESTITUTION}
          collisionGroups={WALL_COLLISION}
        />
      </RigidBody>
      <mesh
        ref={(mesh) => {
          if (mesh) registerFanGlassMesh(bayKey, homeTeam, mesh);
        }}
        position={[0, bayY, glassZ]}
        material={glassMat}
        renderOrder={3}
      >
        <boxGeometry
          args={[
            bayW * 0.992,
            bayH * 0.992,
            ARENA_PADS.fanFacadeGlassThicknessM,
          ]}
        />
      </mesh>

      <FanBoothExteriorTrim
        bayW={bayW}
        bayH={bayH}
        bayY={bayY}
        courtFaceZ={glassCourtFaceZ}
      />
    </group>
  );
}

/** Black rectangular trim on court-facing side of crowd booth glass */
function FanBoothExteriorTrim({
  bayW,
  bayH,
  bayY,
  courtFaceZ,
}: {
  bayW: number;
  bayH: number;
  bayY: number;
  courtFaceZ: number;
}) {
  const fw = ARENA_PADS.fanExteriorFrameWidthM;
  const fd = ARENA_PADS.fanExteriorFrameDepthM;
  const trimZ = courtFaceZ + fd * 0.55;
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#050608',
        roughness: 0.95,
        metalness: 0.03,
      }),
    [],
  );

  return (
    <group renderOrder={4}>
      <mesh position={[0, bayY + bayH * 0.5 + fw * 0.5, trimZ]} material={mat} castShadow>
        <boxGeometry args={[bayW + fw * 2, fw, fd]} />
      </mesh>
      <mesh position={[0, bayY - bayH * 0.5 - fw * 0.5, trimZ]} material={mat} castShadow>
        <boxGeometry args={[bayW + fw * 2, fw, fd]} />
      </mesh>
      <mesh position={[-bayW * 0.5 - fw * 0.5, bayY, trimZ]} material={mat} castShadow>
        <boxGeometry args={[fw, bayH, fd]} />
      </mesh>
      <mesh position={[bayW * 0.5 + fw * 0.5, bayY, trimZ]} material={mat} castShadow>
        <boxGeometry args={[fw, bayH, fd]} />
      </mesh>
    </group>
  );
}

function FanOpeningWallFill({
  bayW,
  height,
  centerYLocal,
}: {
  bayW: number;
  height: number;
  centerYLocal: number;
}) {
  const h = height / 2;
  const t = ARENA.wallThickness / 2;

  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={[0, centerYLocal, 0]}
    >
      <CuboidCollider
        args={[bayW / 2, h, t]}
        friction={0.2}
        restitution={BALL.restitution}
        collisionGroups={WALL_COLLISION}
      />
      <mesh castShadow receiveShadow material={arenaWallMaterial}>
        <boxGeometry args={[bayW, height, ARENA.wallThickness]} />
      </mesh>
    </RigidBody>
  );
}

type SplitWallProps = {
  x: number;
  z: number;
  y: number;
  yaw: number;
  length: number;
  edgeIndex: number;
};

/** Perimeter wall split around fan opening — wings + sill/lintel + recessed crowd bay. */
export function SplitPerimeterWallWithFans({
  x,
  z,
  y,
  yaw,
  length,
  edgeIndex,
}: SplitWallProps) {
  const bayW = ARENA_PADS.fanBayWidthM;
  const wingLen = (length - bayW) / 2;
  const h = ARENA.wallHeight / 2;
  const t = ARENA.wallThickness / 2;
  const fanMountY = ARENA_PADS.fanBayCenterYM - y;
  const wallMidY = ARENA.wallHeight / 2;

  const { bottom: fanBottom, top: fanTop } = fanOpeningWorldY();
  const sillH = fanBottom;
  const lintelH = ARENA.wallHeight - fanTop;
  const sillCenterLocal = sillH * 0.5 - wallMidY;
  const lintelCenterLocal = fanTop + lintelH * 0.5 - wallMidY;

  const wingOffset = bayW / 2 + wingLen / 2;

  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]}>
      {([-1, 1] as const).map((side) => (
        <RigidBody
          key={side}
          type="fixed"
          colliders={false}
          position={[side * wingOffset, 0, 0]}
        >
          <CuboidCollider
            args={[wingLen / 2, h, t]}
            friction={0.2}
            restitution={BALL.restitution}
            collisionGroups={WALL_COLLISION}
          />
          <mesh castShadow receiveShadow material={arenaWallMaterial}>
            <boxGeometry args={[wingLen, ARENA.wallHeight, ARENA.wallThickness]} />
          </mesh>
        </RigidBody>
      ))}

      {sillH > 0.05 && (
        <FanOpeningWallFill
          bayW={bayW}
          height={sillH}
          centerYLocal={sillCenterLocal}
        />
      )}
      {lintelH > 0.05 && (
        <FanOpeningWallFill
          bayW={bayW}
          height={lintelH}
          centerYLocal={lintelCenterLocal}
        />
      )}

      <FanBay
        bayKey={fanBayKey(edgeIndex)}
        homeTeam={fanBayHomeTeam(edgeIndex)}
        mount={{
          x: 0,
          y: fanMountY,
          z: 0,
          yaw: 0,
        }}
      />
    </group>
  );
}
