import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BOT, RENDER } from '../shared/Constants';
import type { Team } from '../shared/Types';
import type { FxFollowAnchor } from './explosionSplashPool';

const POOL_SIZE = 4;
const DURATION = BOT.ragdollDurationSec;
const RING_COUNT = 5;
const SEGS_PER_RING = 2;
const ARC_COUNT = RING_COUNT * SEGS_PER_RING;
const TUBE_SEGS = RENDER.beamTubeSegments;
const TUBE_RAD = RENDER.beamTubeRadial;
const ARC_CURVE_POINTS = 18;

const TEAM_ELECTRIC: Record<Team, readonly number[]> = {
  red: [0xff1133, 0xff5577, 0xff99bb, 0xff3355, 0xffaacc],
  blue: [0x1188ff, 0x55ccff, 0xaaeeff, 0x2266ff, 0x77ddff],
};

const _ringNormal = new THREE.Vector3();
const _ringTangentU = new THREE.Vector3();
const _ringTangentV = new THREE.Vector3();
const _arcPoint = new THREE.Vector3();
const _curvePoints: THREE.Vector3[] = [];

function curvePoint(i: number): THREE.Vector3 {
  if (!_curvePoints[i]) _curvePoints[i] = new THREE.Vector3();
  return _curvePoints[i];
}

function ringNormalForIndex(ringIdx: number, out: THREE.Vector3): THREE.Vector3 {
  const t = (ringIdx + 0.5) / RING_COUNT;
  const phi = Math.acos(1 - 2 * t);
  const theta = ringIdx * 2.399963229728653;
  out.set(
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  );
  return out.normalize();
}

function ringTangentBasis(
  normal: THREE.Vector3,
  u: THREE.Vector3,
  v: THREE.Vector3,
): void {
  const up =
    Math.abs(normal.y) < 0.92
      ? _arcPoint.set(0, 1, 0)
      : _arcPoint.set(1, 0, 0);
  u.crossVectors(normal, up);
  if (u.lengthSq() < 1e-8) u.crossVectors(normal, _arcPoint.set(0, 0, 1));
  u.normalize();
  v.crossVectors(normal, u).normalize();
}

function buildSphericalArcCurve(
  normal: THREE.Vector3,
  theta0: number,
  theta1: number,
  radius: number,
  time: number,
  phase: number,
): THREE.CatmullRomCurve3 {
  ringTangentBasis(normal, _ringTangentU, _ringTangentV);

  for (let i = 0; i <= ARC_CURVE_POINTS; i++) {
    const u = i / ARC_CURVE_POINTS;
    const theta = theta0 + (theta1 - theta0) * u;
    const p = curvePoint(i);
    p.copy(_ringTangentU)
      .multiplyScalar(Math.cos(theta) * radius)
      .addScaledVector(_ringTangentV, Math.sin(theta) * radius);

    if (i > 0 && i < ARC_CURVE_POINTS) {
      const envelope = Math.sin(Math.PI * u) ** 1.15;
      const glitch =
        Math.sin(time * 42 + phase + u * 28) * envelope * 0.22 * radius;
      const glitch2 =
        Math.cos(time * 37 + phase * 1.4 + u * 22) * envelope * 0.18 * radius;
      const radial =
        Math.sin(time * 51 + phase * 2.2 + u * 35) * envelope * 0.12 * radius;
      p.x += glitch + radial * normal.x;
      p.y +=
        Math.sin(time * 48 + phase + u * 19) * envelope * 0.14 * radius +
        radial * normal.y;
      p.z += glitch2 + radial * normal.z;
    }
  }

  return new THREE.CatmullRomCurve3(
    _curvePoints.slice(0, ARC_CURVE_POINTS + 1),
  );
}

function applyTeamArcColors(arcMats: THREE.MeshBasicMaterial[], team: Team): void {
  const palette = TEAM_ELECTRIC[team];
  for (let a = 0; a < arcMats.length; a++) {
    arcMats[a].color.setHex(palette[a % palette.length]);
  }
}

export type BotRagdollBurstHandle = {
  spawn: (
    x: number,
    y: number,
    z: number,
    team: Team,
    follow?: FxFollowAnchor | null,
  ) => void;
};

type BurstSlot = {
  active: boolean;
  born: number;
  pos: THREE.Vector3;
  ringSpin: number;
  team: Team;
  follow: FxFollowAnchor | null;
};

function createSlot(): BurstSlot {
  return {
    active: false,
    born: 0,
    pos: new THREE.Vector3(),
    ringSpin: Math.random() * Math.PI * 2,
    team: 'red',
    follow: null,
  };
}

type SlotVisuals = {
  group: THREE.Group;
  arcs: THREE.Mesh[];
  arcMats: THREE.MeshBasicMaterial[];
};

type BotRagdollBurstFxProps = {
  poolRef: React.MutableRefObject<BotRagdollBurstHandle | null>;
};

export function BotRagdollBurstFx({ poolRef }: BotRagdollBurstFxProps) {
  const slots = useMemo(() => Array.from({ length: POOL_SIZE }, createSlot), []);
  const visualsRef = useRef<SlotVisuals[]>([]);
  const rootRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const placeholderGeo = useMemo(() => {
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(),
      new THREE.Vector3(0, 0, 0.2),
    ]);
    return new THREE.TubeGeometry(c, 4, 0.04, TUBE_RAD, false);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const visuals: SlotVisuals[] = [];

    for (let i = 0; i < POOL_SIZE; i++) {
      const group = new THREE.Group();
      group.visible = false;

      const arcs: THREE.Mesh[] = [];
      const arcMats: THREE.MeshBasicMaterial[] = [];
      for (let a = 0; a < ARC_COUNT; a++) {
        const mat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 1,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        });
        const arc = new THREE.Mesh(placeholderGeo, mat);
        arc.frustumCulled = false;
        group.add(arc);
        arcs.push(arc);
        arcMats.push(mat);
      }

      root.add(group);
      visuals.push({ group, arcs, arcMats });
    }

    visualsRef.current = visuals;
  }, [placeholderGeo]);

  const poolHandle = useMemo(
    (): BotRagdollBurstHandle => ({
      spawn: (x, y, z, team, follow = null) => {
        let slot = slots.find((s) => !s.active);
        if (!slot) {
          let oldest = slots[0];
          for (const s of slots) {
            if (s.born < oldest.born) oldest = s;
          }
          slot = oldest;
        }
        slot.active = true;
        slot.born = performance.now() / 1000;
        slot.pos.set(x, y, z);
        slot.team = team;
        slot.follow = follow;
        slot.ringSpin = Math.random() * Math.PI * 2;

        const vis = visualsRef.current[slots.indexOf(slot)];
        if (vis) applyTeamArcColors(vis.arcMats, team);
      },
    }),
    [slots],
  );

  poolRef.current = poolHandle;

  useFrame((_, dt) => {
    timeRef.current += dt;
    const now = performance.now() / 1000;
    const tAnim = timeRef.current;
    const visuals = visualsRef.current;

    for (let i = 0; i < POOL_SIZE; i++) {
      const slot = slots[i];
      const vis = visuals[i];
      if (!vis) continue;

      if (!slot.active) {
        vis.group.visible = false;
        continue;
      }

      const age = now - slot.born;
      if (age >= DURATION) {
        slot.active = false;
        slot.follow = null;
        vis.group.visible = false;
        continue;
      }

      if (slot.follow) {
        const p = slot.follow();
        if (p) slot.pos.set(p.x, p.y, p.z);
      }

      vis.group.visible = true;
      vis.group.position.copy(slot.pos);

      const u = age / DURATION;
      const fade = (1 - u) ** 1.35;
      const ringRadius = (0.55 + u * 2.8) * 0.9;
      const spin = slot.ringSpin + tAnim * 3.2;

      for (let a = 0; a < ARC_COUNT; a++) {
        const arc = vis.arcs[a];
        const arcMat = vis.arcMats[a];
        const ringIdx = Math.floor(a / SEGS_PER_RING);
        const segIdx = a % SEGS_PER_RING;
        const segSpan = (Math.PI * 2) / SEGS_PER_RING;
        const theta0 =
          spin + ringIdx * 0.85 + segIdx * segSpan + Math.sin(tAnim * 7 + a) * 0.15;
        const theta1 = theta0 + segSpan * 0.88;

        ringNormalForIndex(ringIdx, _ringNormal);
        const curve = buildSphericalArcCurve(
          _ringNormal,
          theta0,
          theta1,
          ringRadius,
          tAnim,
          a * 0.91 + ringIdx * 1.7,
        );
        const prev = arc.geometry;
        arc.geometry = new THREE.TubeGeometry(
          curve,
          TUBE_SEGS,
          0.04 + (a % 3) * 0.012,
          TUBE_RAD,
          false,
        );
        if (prev !== placeholderGeo) prev.dispose();
        arcMat.opacity =
          fade * (0.95 + 0.05 * Math.sin(tAnim * 13 + a * 1.1));
        arc.visible = arcMat.opacity > 0.04;
      }
    }
  });

  return <group ref={rootRef} />;
}
