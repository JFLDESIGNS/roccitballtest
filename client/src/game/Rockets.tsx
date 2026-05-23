import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ARENA, BALL, BOT, RENDER, ROCKET } from '../shared/Constants';
import type { BotId } from './Bots';
import type { ExplosionHit } from './explosions';
import { playPlayerHit } from './audio';
import {
  rocketAge,
  rocketTravelDist,
  segmentHitsSphere,
  updateRockets,
  type ActiveRocket,
} from './rocketSystem';

const MAX_BOOMS = 8;
const MAX_SMOKE = RENDER.rocketMaxSmoke;
const TRAIL_STEP = RENDER.rocketTrailStep;
const TRAIL_BEHIND = RENDER.rocketTrailBehind;

/** Smoke trail — visual only (no Rapier colliders) */

type SmokePuff = {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  explosive: boolean;
};

type RocketVisual = {
  core: THREE.Mesh;
  glow: THREE.Mesh;
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
  ) => void;
  ballPos: () => THREE.Vector3 | null;
};

function makeRocketMaterials() {
  const bouncerCore = new THREE.MeshStandardMaterial({
    color: '#ff8844',
    emissive: '#ff3300',
    emissiveIntensity: 3.2,
    toneMapped: false,
    metalness: 0.35,
    roughness: 0.25,
  });
  const explosiveCore = new THREE.MeshStandardMaterial({
    color: '#ffdd66',
    emissive: '#ff4400',
    emissiveIntensity: 4.2,
    toneMapped: false,
    metalness: 0.2,
    roughness: 0.2,
  });
  const bouncerGlow = new THREE.MeshBasicMaterial({
    color: '#ff6622',
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const explosiveGlow = new THREE.MeshBasicMaterial({
    color: '#ffaa33',
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const smokeMat = new THREE.MeshBasicMaterial({
    color: '#8a9098',
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    toneMapped: false,
  });
  return {
    bouncerCore,
    explosiveCore,
    bouncerGlow,
    explosiveGlow,
    smokeMat,
  };
}

function allocSmokePuff(pool: SmokePuff[]): SmokePuff {
  const reused = pool.pop();
  if (reused) return reused;
  return {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    life: 0,
    maxLife: 0,
    size: 0,
    explosive: false,
  };
}

export function Rockets({
  rocketsRef,
  onExplosion,
  playerPos,
  botTargets,
  onBotDirectHit,
  ballPos,
}: RocketsProps) {
  const groupRef = useRef<THREE.Group>(null);
  const smokeGroupRef = useRef<THREE.Group>(null);
  const visualPool = useRef<RocketVisual[]>([]);
  const smokePool = useRef<THREE.Mesh[]>([]);
  const smokePuffs = useRef<SmokePuff[]>([]);
  const smokeFree = useRef<SmokePuff[]>([]);
  const trailLastPos = useRef(new Map<string, THREE.Vector3>());
  const mats = useRef(makeRocketMaterials());
  const coreGeo = useMemo(() => new THREE.BoxGeometry(0.22, 0.22, 0.85), []);
  const glowGeo = useMemo(() => new THREE.BoxGeometry(0.38, 0.38, 1.15), []);
  const smokeGeo = useMemo(() => new THREE.SphereGeometry(1, 5, 4), []);

  const dirVec = useRef(new THREE.Vector3(0, 0, 1));
  const segFrom = useRef(new THREE.Vector3());
  const segTo = useRef(new THREE.Vector3());
  const ballCenter = useRef(new THREE.Vector3());
  const zAxis = useRef(new THREE.Vector3(0, 0, 1));
  const boomScratch = useRef<ExplosionHit[]>([]);
  const boomCount = useRef(0);
  const trailScratch = useRef(new THREE.Vector3());

  useEffect(
    () => () => {
      mats.current.bouncerCore.dispose();
      mats.current.explosiveCore.dispose();
      mats.current.bouncerGlow.dispose();
      mats.current.explosiveGlow.dispose();
      mats.current.smokeMat.dispose();
      coreGeo.dispose();
      glowGeo.dispose();
      smokeGeo.dispose();
    },
    [coreGeo, glowGeo, smokeGeo],
  );

  const pushBoom = (
    x: number,
    y: number,
    z: number,
    rocketVel?: THREE.Vector3,
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

  const emitSmokeAt = (r: ActiveRocket, at: THREE.Vector3) => {
    if (smokePuffs.current.length >= MAX_SMOKE) {
      const dead = smokePuffs.current.shift();
      if (dead) smokeFree.current.push(dead);
    }
    const p = allocSmokePuff(smokeFree.current);
    const speed = Math.max(1, r.velocity.length());
    const back = TRAIL_BEHIND + Math.min(0.08, speed * 0.00035);
    p.pos.copy(at).addScaledVector(r.velocity, -back / speed);
    p.vel.set(
      r.velocity.x * 0.02 + (Math.random() - 0.5) * 0.12,
      r.velocity.y * 0.015 + Math.random() * 0.08,
      r.velocity.z * 0.02 + (Math.random() - 0.5) * 0.12,
    );
    p.life = 0.32 + Math.random() * 0.22;
    p.maxLife = p.life;
    p.size = 0.18 + Math.random() * 0.2;
    p.explosive = r.explosive;
    smokePuffs.current.push(p);
  };

  const emitTrailSegment = (r: ActiveRocket, from: THREE.Vector3, to: THREE.Vector3) => {
    const dist = from.distanceTo(to);
    if (dist < 1e-4) {
      emitSmokeAt(r, to);
      return;
    }
    const steps = Math.min(4, Math.max(1, Math.ceil(dist / TRAIL_STEP)));
    for (let i = 0; i <= steps; i++) {
      if (smokePuffs.current.length >= MAX_SMOKE) break;
      const t = i / steps;
      trailScratch.current.lerpVectors(from, to, t);
      emitSmokeAt(r, trailScratch.current);
    }
  };

  useFrame((_, dt) => {
    const rockets = rocketsRef.current;
    if (rockets.length === 0) {
      for (const v of visualPool.current) {
        v.core.visible = false;
        v.glow.visible = false;
      }
    }

    const { rockets: moved, explosions } = updateRockets(rockets, dt, {
      w: ARENA.hexRadius,
      d: ARENA.hexRadius,
      h: ARENA.wallHeight,
    });

    const pp = playerPos();
    const bp = ballPos();
    const ballHitRadius = BALL.radius + 3.8;
    const stillFlying: ActiveRocket[] = [];
    boomCount.current = 0;
    for (const e of explosions) {
      if (boomCount.current >= MAX_BOOMS) break;
      pushBoom(e.x, e.y, e.z);
    }

    for (const r of moved) {
      const age = rocketAge(r);
      const travel = rocketTravelDist(r);
      const canHitPlayer = age > ROCKET.ownerGraceSec;
      const leftMuzzle = travel >= ROCKET.minTravelBeforePlayerHit;

      if (
        canHitPlayer &&
        leftMuzzle &&
        pp.distanceTo(r.position) < ROCKET.playerHitRadius
      ) {
        if (boomCount.current < MAX_BOOMS) {
          pushBoom(
            r.position.x,
            r.position.y,
            r.position.z,
            r.velocity,
          );
        }
        trailLastPos.current.delete(r.id);
        continue;
      }
      let hitBot = false;
      for (const bt of botTargets?.() ?? []) {
        if (r.ownerId === bt.id) continue;
        const dx = bt.x - r.position.x;
        const dy = bt.y - r.position.y;
        const dz = bt.z - r.position.z;
        if (Math.hypot(dx, dy, dz) < BOT.rocketHitRadius + 1.2) {
          hitBot = true;
          if (r.ownerId === 'local') playPlayerHit();
          onBotDirectHit?.(bt.id, r.velocity.x, r.velocity.y, r.velocity.z);
          if (boomCount.current < MAX_BOOMS) {
            pushBoom(
              r.position.x,
              r.position.y,
              r.position.z,
              r.velocity,
            );
          }
          break;
        }
      }
      if (hitBot) {
        trailLastPos.current.delete(r.id);
        continue;
      }
      if (bp && travel >= ROCKET.minTravelBeforeBallHit) {
        ballCenter.current.set(bp.x, bp.y, bp.z);
        segTo.current.copy(r.position);
        segFrom.current.copy(segTo.current).addScaledVector(r.velocity, -dt);
        const hitBall =
          segmentHitsSphere(
            segFrom.current,
            segTo.current,
            ballCenter.current,
            ballHitRadius,
          ) || segTo.current.distanceTo(ballCenter.current) < ballHitRadius;
        if (hitBall) {
          if (boomCount.current < MAX_BOOMS) {
            const sp = Math.max(0.001, r.velocity.length());
            const back = BALL.radius + 0.4;
            pushBoom(
              ballCenter.current.x - (r.velocity.x / sp) * back,
              ballCenter.current.y - (r.velocity.y / sp) * back * 0.35,
              ballCenter.current.z - (r.velocity.z / sp) * back,
              r.velocity,
            );
          }
          trailLastPos.current.delete(r.id);
          continue;
        }
      }
      stillFlying.push(r);
    }

    rocketsRef.current = stillFlying;
    for (let i = 0; i < boomCount.current; i++) {
      onExplosion(boomScratch.current[i]);
    }

    const activeIds = new Set(stillFlying.map((r) => r.id));
    for (const id of trailLastPos.current.keys()) {
      if (!activeIds.has(id)) trailLastPos.current.delete(id);
    }

    for (const r of stillFlying) {
      let last = trailLastPos.current.get(r.id);
      if (!last) {
        last = r.spawnPos.clone();
        trailLastPos.current.set(r.id, last);
        emitSmokeAt(r, r.spawnPos);
        emitSmokeAt(r, r.position);
        last.copy(r.position);
        continue;
      }
      const dist = last.distanceTo(r.position);
      if (dist >= TRAIL_STEP) {
        emitTrailSegment(r, last, r.position);
        last.copy(r.position);
      }
    }

    const smokeAlive: SmokePuff[] = [];
    for (const p of smokePuffs.current) {
      p.life -= dt;
      if (p.life <= 0) {
        smokeFree.current.push(p);
        continue;
      }
      p.vel.y += 0.35 * dt;
      p.pos.addScaledVector(p.vel, dt);
      smokeAlive.push(p);
    }
    smokePuffs.current = smokeAlive;

    const group = groupRef.current;
    const smokeGroup = smokeGroupRef.current;
    if (!group || !smokeGroup) return;

    while (visualPool.current.length < stillFlying.length) {
      const core = new THREE.Mesh(coreGeo, mats.current.bouncerCore);
      const glow = new THREE.Mesh(glowGeo, mats.current.bouncerGlow);
      group.add(core);
      group.add(glow);
      visualPool.current.push({ core, glow });
    }

    for (let i = 0; i < visualPool.current.length; i++) {
      const vis = visualPool.current[i];
      if (i < stillFlying.length) {
        const r = stillFlying[i];
        const explosive = r.explosive;
        vis.core.visible = true;
        vis.glow.visible = true;
        vis.core.material = explosive
          ? mats.current.explosiveCore
          : mats.current.bouncerCore;
        vis.glow.material = explosive
          ? mats.current.explosiveGlow
          : mats.current.bouncerGlow;
        vis.core.position.copy(r.position);
        vis.glow.position.copy(r.position);
        if (r.velocity.lengthSq() > 0.01) {
          dirVec.current.copy(r.velocity).normalize();
          vis.core.quaternion.setFromUnitVectors(zAxis.current, dirVec.current);
          vis.glow.quaternion.copy(vis.core.quaternion);
        }
      } else {
        vis.core.visible = false;
        vis.glow.visible = false;
      }
    }

    while (smokePool.current.length < smokeAlive.length) {
      const m = new THREE.Mesh(smokeGeo, mats.current.smokeMat);
      smokeGroup.add(m);
      smokePool.current.push(m);
    }

    const smokeMat = mats.current.smokeMat;
    for (let i = 0; i < smokePool.current.length; i++) {
      const mesh = smokePool.current[i];
      if (i < smokeAlive.length) {
        const p = smokeAlive[i];
        const t = p.life / p.maxLife;
        mesh.visible = true;
        mesh.position.copy(p.pos);
        const grow = 1 + (1 - t) * 1.4;
        mesh.scale.setScalar(p.size * grow);
        smokeMat.opacity = t * 0.48;
        smokeMat.color.set(p.explosive ? '#6a5a4a' : '#5a6068');
      } else {
        mesh.visible = false;
      }
    }
  });

  return (
    <>
      <group ref={groupRef} />
      <group ref={smokeGroupRef} />
    </>
  );
}
