import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ARENA, BALL, BOT, RENDER, ROCKET } from '../shared/Constants';
import { COMBAT_VFX_RENDER_ORDER } from './renderOrderConstants';
import type { BotId } from './Bots';
import type { ExplosionHit } from './explosions';
import {
  announceRocketBallHit,
  announceRocketPlayerHit,
} from './announcements';
import { registerLocalBallComboHit } from './ballCombo';
import type { ActorId } from './playerRoster';
import {
  rocketAge,
  rocketTravelDist,
  segmentHitsSphere,
  segmentBallSurfaceImpact,
  updateRockets,
  type ActiveRocket,
} from './rocketSystem';
import {
  releaseRocketSmokeTrail,
  spawnRocketSmokeStreak,
} from './rocketSmokeStreak';
import { spawnRocketTrailSmokePuff } from './rocketTrailSmokePuffs';

const MAX_BOOMS = 8;
const HEAD_R = RENDER.rocketHeadRadius;
const HEAD_GLOW_R = RENDER.rocketHeadGlowRadius;
const TRAIL_HISTORY_MAX = 280;
const TRAIL_MIN_STEP = ROCKET.trailPuffSpawnStepM;

type RocketVisual = {
  root: THREE.Group;
  head: THREE.Mesh;
  emissiveGlow: THREE.Mesh;
  fire: THREE.Group;
  history: THREE.Vector3[];
  rocketId: string | null;
  lastExplosive: boolean;
};

type RocketMaterials = {
  headBouncer: THREE.MeshBasicMaterial;
  headExplosive: THREE.MeshBasicMaterial;
  emissiveGlowBouncer: THREE.MeshBasicMaterial;
  emissiveGlowExplosive: THREE.MeshBasicMaterial;
  fireBouncer: THREE.MeshBasicMaterial;
  fireExplosive: THREE.MeshBasicMaterial;
};

type RocketsProps = {
  rocketsRef: React.MutableRefObject<ActiveRocket[]>;
  onExplosion: (hit: ExplosionHit) => void;
  playerPos: () => THREE.Vector3;
  botTargets?: () => { id: BotId; x: number; y: number; z: number }[];
  onBotDirectHit?: (
    botId: BotId,
    vx: number,
    vy: number,
    vz: number,
    ownerId: string,
  ) => void;
  onPlayerDirectHit?: (vx: number, vy: number, vz: number) => void;
  ballPos: () => THREE.Vector3 | null;
  ballVel?: () => THREE.Vector3 | null;
};

function makeRocketMaterials(): RocketMaterials {
  return {
    headBouncer: new THREE.MeshBasicMaterial({
      color: '#fff04a',
      toneMapped: false,
    }),
    headExplosive: new THREE.MeshBasicMaterial({
      color: '#ffff66',
      toneMapped: false,
    }),
    emissiveGlowBouncer: new THREE.MeshBasicMaterial({
      color: '#ffcc44',
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    emissiveGlowExplosive: new THREE.MeshBasicMaterial({
      color: '#ffee55',
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    fireBouncer: new THREE.MeshBasicMaterial({
      color: '#ff7722',
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    fireExplosive: new THREE.MeshBasicMaterial({
      color: '#ff9933',
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  };
}

function createFireGroup(
  fireMat: THREE.MeshBasicMaterial,
  planeGeo: THREE.PlaneGeometry,
): THREE.Group {
  const group = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const plane = new THREE.Mesh(planeGeo, fireMat);
    plane.rotation.z = (i * Math.PI * 2) / 3;
    plane.renderOrder = COMBAT_VFX_RENDER_ORDER + 2;
    group.add(plane);
  }
  return group;
}

function createRocketVisual(
  arenaGroup: THREE.Group,
  mats: RocketMaterials,
  headGeo: THREE.SphereGeometry,
  glowGeo: THREE.SphereGeometry,
  firePlaneGeo: THREE.PlaneGeometry,
): RocketVisual {
  const root = new THREE.Group();
  root.frustumCulled = false;
  arenaGroup.add(root);

  const emissiveGlow = new THREE.Mesh(glowGeo, mats.emissiveGlowBouncer);
  emissiveGlow.frustumCulled = false;
  emissiveGlow.renderOrder = COMBAT_VFX_RENDER_ORDER + 2;

  const fire = createFireGroup(mats.fireBouncer, firePlaneGeo);
  fire.frustumCulled = false;

  const head = new THREE.Mesh(headGeo, mats.headBouncer);
  head.frustumCulled = false;
  head.renderOrder = 13;

  root.add(emissiveGlow);
  root.add(fire);
  root.add(head);

  root.visible = false;

  return {
    root,
    head,
    emissiveGlow,
    fire,
    history: [],
    rocketId: null,
    lastExplosive: false,
  };
}

const _dir = new THREE.Vector3();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _camPos = new THREE.Vector3();
const _sample = new THREE.Vector3();

function appendPathPoint(history: THREE.Vector3[], tip: THREE.Vector3) {
  const last = history[history.length - 1];
  if (last && last.distanceToSquared(tip) < TRAIL_MIN_STEP * TRAIL_MIN_STEP) {
    return;
  }
  history.push(tip.clone());
  while (history.length > TRAIL_HISTORY_MAX) {
    history.shift();
  }
}

/** Fill gaps on fast rockets so smoke segments stay continuous */
function appendPathWithVelocity(
  history: THREE.Vector3[],
  tip: THREE.Vector3,
) {
  const last = history[history.length - 1];
  if (!last) {
    appendPathPoint(history, tip);
    return;
  }
  const dist = last.distanceTo(tip);
  const step = TRAIL_MIN_STEP;
  if (dist <= step) {
    appendPathPoint(history, tip);
    return;
  }
  const steps = Math.min(12, Math.ceil(dist / step));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    _sample.lerpVectors(last, tip, t);
    appendPathPoint(history, _sample);
  }
}

function updateFireBillboard(fire: THREE.Group, camera: THREE.Camera, pulse: number) {
  camera.getWorldPosition(_camPos);
  fire.lookAt(_camPos);
  fire.scale.setScalar(0.82 + pulse * 0.28);
}

function updateRocketVisual(
  vis: RocketVisual,
  r: ActiveRocket,
  mats: RocketMaterials,
  camera: THREE.Camera,
  nowMs: number,
) {
  const explosive = r.explosive;
  vis.lastExplosive = explosive;
  vis.root.visible = true;

  vis.head.material = explosive ? mats.headExplosive : mats.headBouncer;
  const glowMat = explosive ? mats.emissiveGlowExplosive : mats.emissiveGlowBouncer;
  vis.emissiveGlow.material = glowMat;
  for (const child of vis.fire.children) {
    if (child instanceof THREE.Mesh) {
      child.material = explosive ? mats.fireExplosive : mats.fireBouncer;
    }
  }

  const tip = r.position;
  vis.head.visible = true;
  vis.emissiveGlow.visible = true;
  vis.fire.visible = true;
  vis.head.position.copy(tip);
  vis.emissiveGlow.position.copy(tip);
  vis.fire.position.copy(tip);

  const pulse = Math.sin(nowMs * 0.028) * 0.5 + 0.5;
  vis.emissiveGlow.scale.setScalar(0.92 + pulse * 0.12);
  glowMat.opacity = 0.88 + pulse * 0.12;
  updateFireBillboard(vis.fire, camera, pulse);

  const fireMat = explosive ? mats.fireExplosive : mats.fireBouncer;
  fireMat.opacity = 0.65 + pulse * 0.35;

  if (r.velocity.lengthSq() > 0.01) {
    _dir.copy(r.velocity).normalize();
    vis.head.quaternion.setFromUnitVectors(_zAxis, _dir);
    vis.emissiveGlow.quaternion.copy(vis.head.quaternion);
    spawnRocketSmokeStreak(
      vis.rocketId,
      tip.x,
      tip.y,
      tip.z,
      r.velocity.x,
      r.velocity.y,
      r.velocity.z,
      explosive,
    );
  }

  appendPathWithVelocity(vis.history, tip);
}

function hideRocketVisual(vis: RocketVisual, explosive: boolean) {
  const h = vis.history;
  if (h.length >= 1) {
    const tail = h[h.length - 1]!;
    spawnRocketTrailSmokePuff(tail.x, tail.y, tail.z, explosive);
  }
  vis.root.visible = false;
  vis.head.visible = false;
  vis.emissiveGlow.visible = false;
  vis.fire.visible = false;
  vis.lastExplosive = explosive;
  vis.history.length = 0;
  releaseRocketSmokeTrail(vis.rocketId);
  vis.rocketId = null;
}

export function Rockets({
  rocketsRef,
  onExplosion,
  playerPos,
  botTargets,
  onBotDirectHit,
  onPlayerDirectHit,
  ballPos,
  ballVel,
}: RocketsProps) {
  const groupRef = useRef<THREE.Group>(null);
  const activeVisuals = useRef(new Map<string, RocketVisual>());
  const freeVisuals = useRef<RocketVisual[]>([]);
  const mats = useRef(makeRocketMaterials());
  const headGeo = useMemo(() => new THREE.SphereGeometry(HEAD_R, 10, 8), []);
  const glowGeo = useMemo(() => new THREE.SphereGeometry(HEAD_GLOW_R, 8, 6), []);
  const firePlaneGeo = useMemo(() => new THREE.PlaneGeometry(0.52, 0.72), []);

  const ballCenter = useRef(new THREE.Vector3());
  const ballImpactNormal = useRef(new THREE.Vector3());
  const ballImpactContact = useRef(new THREE.Vector3());
  const botCenter = useRef(new THREE.Vector3());
  const segFrom = useRef(new THREE.Vector3());
  const segTo = useRef(new THREE.Vector3());
  const boomScratch = useRef<ExplosionHit[]>([]);
  const boomCount = useRef(0);

  useEffect(
    () => () => {
      const m = mats.current;
      m.headBouncer.dispose();
      m.headExplosive.dispose();
      m.emissiveGlowBouncer.dispose();
      m.emissiveGlowExplosive.dispose();
      m.fireBouncer.dispose();
      m.fireExplosive.dispose();
      headGeo.dispose();
      glowGeo.dispose();
      firePlaneGeo.dispose();
      for (const vis of [
        ...freeVisuals.current,
        ...activeVisuals.current.values(),
      ]) {
        vis.root.parent?.remove(vis.root);
      }
    },
    [headGeo, glowGeo, firePlaneGeo],
  );

  const pushBoom = (
    x: number,
    y: number,
    z: number,
    rocketVel?: THREE.Vector3,
    ownerId?: string,
    impactNormal?: THREE.Vector3,
    scorch?: {
      nx: number;
      ny: number;
      nz: number;
      kind: 'wall' | 'floor' | 'ceiling' | 'pillar';
      pillarCx?: number;
      pillarCz?: number;
    },
  ) => {
    const i = boomCount.current++;
    let h = boomScratch.current[i];
    if (!h) {
      h = { x: 0, y: 0, z: 0, radius: ROCKET.explosionRadius };
      boomScratch.current[i] = h;
    }
    h.x = x;
    h.y = y;
    h.z = z;
    h.radius = ROCKET.explosionRadius;
    h.fromOwnerId = ownerId;
    if (scorch) {
      h.scorchNx = scorch.nx;
      h.scorchNy = scorch.ny;
      h.scorchNz = scorch.nz;
      h.scorchKind = scorch.kind;
      h.scorchPillarCx = scorch.pillarCx;
      h.scorchPillarCz = scorch.pillarCz;
    } else {
      h.scorchNx = undefined;
      h.scorchNy = undefined;
      h.scorchNz = undefined;
      h.scorchKind = undefined;
      h.scorchPillarCx = undefined;
      h.scorchPillarCz = undefined;
    }
    if (impactNormal) {
      h.ballImpactNx = impactNormal.x;
      h.ballImpactNy = impactNormal.y;
      h.ballImpactNz = impactNormal.z;
    } else {
      h.ballImpactNx = undefined;
      h.ballImpactNy = undefined;
      h.ballImpactNz = undefined;
    }
    if (rocketVel) {
      h.rocketVx = rocketVel.x;
      h.rocketVy = rocketVel.y;
      h.rocketVz = rocketVel.z;
    } else {
      h.rocketVx = undefined;
      h.rocketVy = undefined;
      h.rocketVz = undefined;
    }
  };

  useFrame(({ camera }, dt) => {
    const rockets = rocketsRef.current;
    const group = groupRef.current;
    if (!group) return;
    const nowMs = performance.now();

    camera.getWorldPosition(_camPos);

    const { rockets: moved, explosions } = updateRockets(
      rockets,
      dt,
      {
        w: ARENA.hexRadius,
        d: ARENA.hexRadius,
        h: ARENA.wallHeight,
      },
    );

    const pp = playerPos();
    const bp = ballPos();
    const ballDetectRadius = BALL.radius + ROCKET.ballHitDetectPad;
    const stillFlying: ActiveRocket[] = [];
    boomCount.current = 0;
    for (const e of explosions) {
      if (boomCount.current >= MAX_BOOMS) break;
      const scorch =
        e.scorchNx !== undefined &&
        e.scorchNy !== undefined &&
        e.scorchNz !== undefined &&
        e.scorchKind
          ? {
              nx: e.scorchNx,
              ny: e.scorchNy,
              nz: e.scorchNz,
              kind: e.scorchKind,
              pillarCx: e.scorchPillarCx,
              pillarCz: e.scorchPillarCz,
            }
          : undefined;
      pushBoom(e.x, e.y, e.z, undefined, undefined, undefined, scorch);
    }

    for (const r of moved) {
      const age = rocketAge(r);
      const travel = rocketTravelDist(r);
      const canHitPlayer = age > ROCKET.ownerGraceSec;
      const leftMuzzle = travel >= ROCKET.minTravelBeforePlayerHit;

      if (canHitPlayer && leftMuzzle && r.ownerId !== 'local') {
        segTo.current.copy(r.position);
        segFrom.current.copy(segTo.current).addScaledVector(r.velocity, -dt);
        const playerHitRadius = ROCKET.playerHitRadius + 0.9;
        const hitPlayer =
          segmentHitsSphere(
            segFrom.current,
            segTo.current,
            pp,
            playerHitRadius,
          ) || pp.distanceTo(r.position) < playerHitRadius;
        if (hitPlayer) {
          announceRocketPlayerHit(r.ownerId as ActorId, 'local');
          onPlayerDirectHit?.(r.velocity.x, r.velocity.y, r.velocity.z);
          if (boomCount.current < MAX_BOOMS) {
            pushBoom(r.position.x, r.position.y, r.position.z, r.velocity, r.ownerId);
          }
          continue;
        }
      }
      let hitBot = false;
      segTo.current.copy(r.position);
      segFrom.current.copy(segTo.current).addScaledVector(r.velocity, -dt);
      const botHitRadius = BOT.rocketHitRadius + 1.2;
      for (const bt of botTargets?.() ?? []) {
        if (r.ownerId === bt.id) continue;
        botCenter.current.set(bt.x, bt.y, bt.z);
        const directHit =
          segmentHitsSphere(
            segFrom.current,
            segTo.current,
            botCenter.current,
            botHitRadius,
          ) ||
          botCenter.current.distanceTo(r.position) < botHitRadius;
        if (!directHit) continue;
        hitBot = true;
        onBotDirectHit?.(
          bt.id,
          r.velocity.x,
          r.velocity.y,
          r.velocity.z,
          r.ownerId,
        );
        if (boomCount.current < MAX_BOOMS) {
          pushBoom(r.position.x, r.position.y, r.position.z, r.velocity, r.ownerId);
        }
        break;
      }
      if (hitBot) continue;

      if (bp && travel >= ROCKET.minTravelBeforeBallHit) {
        ballCenter.current.set(bp.x, bp.y, bp.z);
        segTo.current.copy(r.position);
        segFrom.current.copy(segTo.current).addScaledVector(r.velocity, -dt);
        const hitBall =
          segmentHitsSphere(
            segFrom.current,
            segTo.current,
            ballCenter.current,
            ballDetectRadius,
          ) ||
          segTo.current.distanceTo(ballCenter.current) < ballDetectRadius;
        if (hitBall) {
          const ownerId = r.ownerId;
          announceRocketBallHit(ownerId, ballCenter.current.y);
          if (ownerId === 'local') {
            const bv = ballVel?.();
            registerLocalBallComboHit(
              ballCenter.current.y,
              bv?.y ?? 0,
              r.velocity.length(),
            );
          }
          if (boomCount.current < MAX_BOOMS) {
            const sp = Math.max(0.001, r.velocity.length());
            segmentBallSurfaceImpact(
              segFrom.current,
              segTo.current,
              ballCenter.current,
              BALL.radius,
              ballImpactContact.current,
              ballImpactNormal.current,
            );
            const pad = 0.38;
            const bx =
              ballImpactContact.current.x - (r.velocity.x / sp) * pad;
            const by =
              ballImpactContact.current.y - (r.velocity.y / sp) * pad;
            const bz =
              ballImpactContact.current.z - (r.velocity.z / sp) * pad;
            pushBoom(
              bx,
              by,
              bz,
              r.velocity,
              r.ownerId,
              ballImpactNormal.current,
            );
          }
          continue;
        }
      }
      stillFlying.push(r);
    }

    rocketsRef.current = stillFlying;
    for (let i = 0; i < boomCount.current; i++) {
      onExplosion(boomScratch.current[i]);
    }

    const flyingIds = new Set(stillFlying.map((r) => r.id));
    for (const [id, vis] of [...activeVisuals.current.entries()]) {
      if (flyingIds.has(id)) continue;
      hideRocketVisual(vis, vis.lastExplosive);
      activeVisuals.current.delete(id);
      freeVisuals.current.push(vis);
    }

    for (const r of stillFlying) {
      let vis = activeVisuals.current.get(r.id);
      if (!vis) {
        vis =
          freeVisuals.current.pop() ??
          createRocketVisual(
            group,
            mats.current,
            headGeo,
            glowGeo,
            firePlaneGeo,
          );
        vis.rocketId = r.id;
        vis.history.length = 0;
        appendPathPoint(vis.history, r.position);
        activeVisuals.current.set(r.id, vis);
      }
      updateRocketVisual(vis, r, mats.current, camera, nowMs);
    }
  });

  return <group ref={groupRef} />;
}
