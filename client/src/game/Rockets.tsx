import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ARENA, BALL, BOT, RENDER, ROCKET } from '../shared/Constants';
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
  type RocketTrailSegment,
} from './rocketSystem';
import { trailCameraFade } from './trailCameraFade';

const MAX_BOOMS = 8;
const TRAIL_R = RENDER.rocketTrailRadius;
const TRAIL_MIN_LEN = 0.35;
const HEAD_R = RENDER.rocketHeadRadius;
const HEAD_GLOW_R = RENDER.rocketHeadGlowRadius;
const FROZEN_TRAIL_LIFE = 1.55;
const MAX_FROZEN_TRAILS = 36;
const RIBBON_HISTORY_MAX = 12;
const RIBBON_MIN_STEP = 0.14;

type RocketVisual = {
  head: THREE.Mesh;
  emissiveGlow: THREE.Mesh;
  fire: THREE.Group;
  /** Thick vector ribbon (ball-style) */
  pathMesh: THREE.Mesh;
  pathMesh2: THREE.Mesh | null;
  pathRibbon: THREE.Line;
  history: THREE.Vector3[];
  rocketId: string | null;
};

type FrozenTrail = {
  mesh: THREE.Mesh;
  life: number;
  baseOpacity: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
};

type RocketMaterials = {
  headBouncer: THREE.MeshBasicMaterial;
  headExplosive: THREE.MeshBasicMaterial;
  emissiveGlowBouncer: THREE.MeshBasicMaterial;
  emissiveGlowExplosive: THREE.MeshBasicMaterial;
  fireBouncer: THREE.MeshBasicMaterial;
  fireExplosive: THREE.MeshBasicMaterial;
  trailBouncer: THREE.MeshBasicMaterial;
  trailExplosive: THREE.MeshBasicMaterial;
  ribbonBouncer: THREE.MeshBasicMaterial;
  ribbonExplosive: THREE.MeshBasicMaterial;
  pathRibbonBouncer: THREE.LineBasicMaterial;
  pathRibbonExplosive: THREE.LineBasicMaterial;
  pathMeshBouncer: THREE.MeshBasicMaterial;
  pathMeshExplosive: THREE.MeshBasicMaterial;
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
      color: '#fff2b8',
      toneMapped: false,
    }),
    headExplosive: new THREE.MeshBasicMaterial({
      color: '#ffffe8',
      toneMapped: false,
    }),
    emissiveGlowBouncer: new THREE.MeshBasicMaterial({
      color: '#ffaa33',
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    emissiveGlowExplosive: new THREE.MeshBasicMaterial({
      color: '#ffff66',
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    fireBouncer: new THREE.MeshBasicMaterial({
      color: '#ff6622',
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    fireExplosive: new THREE.MeshBasicMaterial({
      color: '#ffee44',
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    trailBouncer: new THREE.MeshBasicMaterial({
      color: '#ccb8a0',
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    trailExplosive: new THREE.MeshBasicMaterial({
      color: '#dd9970',
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    ribbonBouncer: new THREE.MeshBasicMaterial({
      color: '#ffaa66',
      transparent: true,
      opacity: 0.58,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    ribbonExplosive: new THREE.MeshBasicMaterial({
      color: '#ffcc88',
      transparent: true,
      opacity: 0.64,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    pathRibbonBouncer: new THREE.LineBasicMaterial({
      color: '#ff9955',
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    pathRibbonExplosive: new THREE.LineBasicMaterial({
      color: '#ffdd77',
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    pathMeshBouncer: new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
    pathMeshExplosive: new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 1,
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
    plane.renderOrder = 12;
    group.add(plane);
  }
  return group;
}

function makePathMeshGeometry(maxPoints: number) {
  const maxVerts = maxPoints * 2;
  const positions = new Float32Array(maxVerts * 3);
  const colors = new Float32Array(maxVerts * 3);
  const indices: number[] = [];
  for (let i = 0; i < maxPoints - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  return geo;
}

function createPathRibbon(
  mat: THREE.LineBasicMaterial,
): { line: THREE.Line; history: THREE.Vector3[] } {
  const positions = new Float32Array(RIBBON_HISTORY_MAX * 3);
  const colors = new Float32Array(RIBBON_HISTORY_MAX * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setDrawRange(0, 0);
  const line = new THREE.Line(
    geo,
    mat,
  );
  line.frustumCulled = false;
  return { line, history: [] };
}

function createRocketVisual(
  group: THREE.Group,
  mats: RocketMaterials,
  headGeo: THREE.SphereGeometry,
  glowGeo: THREE.SphereGeometry,
  firePlaneGeo: THREE.PlaneGeometry,
  pathMeshGeo: THREE.BufferGeometry,
): RocketVisual {
  const emissiveGlow = new THREE.Mesh(glowGeo, mats.emissiveGlowBouncer);
  emissiveGlow.frustumCulled = false;
  emissiveGlow.renderOrder = 11;
  const fire = createFireGroup(mats.fireBouncer, firePlaneGeo);
  fire.frustumCulled = false;
  const head = new THREE.Mesh(headGeo, mats.headBouncer);
  head.frustumCulled = false;
  head.renderOrder = 12;
  const path = createPathRibbon(mats.pathRibbonBouncer);
  const pathMesh = new THREE.Mesh(pathMeshGeo, mats.pathMeshBouncer);
  pathMesh.frustumCulled = false;
  pathMesh.renderOrder = 9;
  const pathMesh2 = new THREE.Mesh(pathMeshGeo.clone(), mats.pathMeshBouncer);
  pathMesh2.frustumCulled = false;
  pathMesh2.renderOrder = 9;
  pathMesh2.rotation.z = Math.PI / 2;
  group.add(pathMesh);
  group.add(pathMesh2);
  group.add(emissiveGlow);
  group.add(fire);
  group.add(path.line);
  group.add(head);
  return {
    head,
    emissiveGlow,
    fire,
    pathMesh,
    pathMesh2,
    pathRibbon: path.line,
    history: path.history,
    rocketId: null,
  };
}

const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _yAxis = new THREE.Vector3(0, 1, 0);
const _zAxis = new THREE.Vector3(0, 0, 1);
const _camPos = new THREE.Vector3();
const _ribbonColor = new THREE.Color();

function ribbonMat(
  mats: RocketMaterials,
  explosive: boolean,
): THREE.MeshBasicMaterial {
  return explosive ? mats.ribbonExplosive : mats.ribbonBouncer;
}

/** Flat ribbon along a bounce segment — fades via frozen pool */
function placeBounceRibbon(
  mesh: THREE.Mesh,
  mat: THREE.MeshBasicMaterial,
  from: THREE.Vector3,
  to: THREE.Vector3,
) {
  const len = from.distanceTo(to);
  if (len < TRAIL_MIN_LEN) {
    mesh.visible = false;
    return;
  }
  _dir.subVectors(to, from).normalize();
  _mid.lerpVectors(from, to, 0.5);
  mesh.visible = true;
  mesh.material = mat;
  mesh.position.copy(_mid);
  mesh.quaternion.setFromUnitVectors(_yAxis, _dir);
  const ribbonW = TRAIL_R * 2.35;
  mesh.scale.set(ribbonW, len, TRAIL_R * 0.22);
}

function pushPathHistory(history: THREE.Vector3[], tip: THREE.Vector3) {
  const last = history[history.length - 1];
  if (last && last.distanceToSquared(tip) < RIBBON_MIN_STEP * RIBBON_MIN_STEP) return;
  history.push(tip.clone());
  while (history.length > RIBBON_HISTORY_MAX) {
    history.shift();
  }
}

const _worldUp = new THREE.Vector3(0, 1, 0);
const _fallback = new THREE.Vector3(1, 0, 0);
const _right = new THREE.Vector3();
const _binormal = new THREE.Vector3();
const PATH_MESH_HALF_W = 0.14;

function updatePathMeshRibbon(
  mesh: THREE.Mesh,
  mesh2: THREE.Mesh | null,
  history: THREE.Vector3[],
  explosive: boolean,
  camPos: THREE.Vector3,
  mats: RocketMaterials,
) {
  const n = history.length;
  if (n < 2) {
    mesh.visible = false;
    if (mesh2) mesh2.visible = false;
    return;
  }
  mesh.visible = true;
  if (mesh2) mesh2.visible = true;
  const mat = explosive ? mats.pathMeshExplosive : mats.pathMeshBouncer;
  mesh.material = mat;
  if (mesh2) mesh2.material = mat;
  _ribbonColor.set(explosive ? '#ffeeaa' : '#ffaa66');

  const writeMesh = (target: THREE.Mesh) => {
    const posAttr = target.geometry.getAttribute(
      'position',
    ) as THREE.BufferAttribute;
    const colAttr = target.geometry.getAttribute('color') as THREE.BufferAttribute;
    let vi = 0;
    for (let i = 0; i < n; i++) {
      const p = history[i]!;
      if (i < n - 1) {
        const q = history[i + 1]!;
        _dir.subVectors(q, p);
        const len = _dir.length();
        if (len < 1e-5) _dir.copy(_fallback);
        else _dir.multiplyScalar(1 / len);
        _right.crossVectors(_dir, _worldUp);
        if (_right.lengthSq() < 1e-6) _right.set(1, 0, 0);
        _right.normalize();
        _binormal.crossVectors(_dir, _right).normalize();
      }
      const along = n <= 1 ? 1 : 0.2 + (0.8 * i) / (n - 1);
      const fade = along * trailCameraFade(p, camPos);
      const w = PATH_MESH_HALF_W * fade;
      if (i < n - 1) {
        posAttr.setXYZ(vi, p.x - _right.x * w, p.y - _right.y * w, p.z - _right.z * w);
        colAttr.setXYZ(
          vi,
          _ribbonColor.r * fade,
          _ribbonColor.g * fade,
          _ribbonColor.b * fade,
        );
        vi++;
        posAttr.setXYZ(vi, p.x + _right.x * w, p.y + _right.y * w, p.z + _right.z * w);
        colAttr.setXYZ(
          vi,
          _ribbonColor.r * fade,
          _ribbonColor.g * fade,
          _ribbonColor.b * fade,
        );
        vi++;
      }
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    target.geometry.setDrawRange(0, Math.max(0, (n - 1) * 2));
  };

  writeMesh(mesh);
  if (mesh2) writeMesh(mesh2);
}

function updateFireBillboard(fire: THREE.Group, camera: THREE.Camera, pulse: number) {
  camera.getWorldPosition(_camPos);
  fire.lookAt(_camPos);
  const s = 0.82 + pulse * 0.28;
  fire.scale.setScalar(s);
}

function updateRocketVisual(
  vis: RocketVisual,
  r: ActiveRocket,
  mats: RocketMaterials,
  camera: THREE.Camera,
  nowMs: number,
) {
  if (vis.rocketId !== r.id) {
    vis.rocketId = r.id;
    vis.history.length = 0;
  }

  const explosive = r.explosive;
  vis.head.material = explosive ? mats.headExplosive : mats.headBouncer;
  const glowMat = explosive ? mats.emissiveGlowExplosive : mats.emissiveGlowBouncer;
  vis.emissiveGlow.material = glowMat;
  for (const child of vis.fire.children) {
    if (child instanceof THREE.Mesh) {
      child.material = explosive ? mats.fireExplosive : mats.fireBouncer;
    }
  }
  vis.pathRibbon.material = explosive
    ? mats.pathRibbonExplosive
    : mats.pathRibbonBouncer;

  const tip = r.position;
  vis.head.visible = true;
  vis.emissiveGlow.visible = true;
  vis.fire.visible = true;
  vis.head.position.copy(tip);
  vis.emissiveGlow.position.copy(tip);
  vis.fire.position.copy(tip);

  const pulse = Math.sin(nowMs * 0.028) * 0.5 + 0.5;
  const glowScale = 0.92 + pulse * 0.12;
  vis.emissiveGlow.scale.setScalar(glowScale);
  glowMat.opacity = 0.88 + pulse * 0.12;
  updateFireBillboard(vis.fire, camera, pulse);

  const fireMat = explosive ? mats.fireExplosive : mats.fireBouncer;
  fireMat.opacity = 0.65 + pulse * 0.35;

  if (r.velocity.lengthSq() > 0.01) {
    _dir.copy(r.velocity).normalize();
    vis.head.quaternion.setFromUnitVectors(_zAxis, _dir);
    vis.emissiveGlow.quaternion.copy(vis.head.quaternion);
  }

  camera.getWorldPosition(_camPos);
  pushPathHistory(vis.history, tip);
  updatePathMeshRibbon(
    vis.pathMesh,
    vis.pathMesh2,
    vis.history,
    explosive,
    _camPos,
    mats,
  );
  vis.pathRibbon.visible = false;
}

function hideRocketVisual(vis: RocketVisual) {
  vis.head.visible = false;
  vis.emissiveGlow.visible = false;
  vis.fire.visible = false;
  vis.pathMesh.visible = false;
  if (vis.pathMesh2) vis.pathMesh2.visible = false;
  vis.pathRibbon.visible = false;
  vis.history.length = 0;
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
  const visualPool = useRef<RocketVisual[]>([]);
  const frozenTrails = useRef<FrozenTrail[]>([]);
  const mats = useRef(makeRocketMaterials());
  const headGeo = useMemo(() => new THREE.SphereGeometry(HEAD_R, 10, 8), []);
  const glowGeo = useMemo(() => new THREE.SphereGeometry(HEAD_GLOW_R, 8, 6), []);
  const pathMeshGeo = useMemo(
    () => makePathMeshGeometry(RIBBON_HISTORY_MAX),
    [],
  );
  const ribbonGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
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
      m.trailBouncer.dispose();
      m.trailExplosive.dispose();
      m.ribbonBouncer.dispose();
      m.ribbonExplosive.dispose();
      m.pathRibbonBouncer.dispose();
      m.pathRibbonExplosive.dispose();
      m.pathMeshBouncer.dispose();
      m.pathMeshExplosive.dispose();
      headGeo.dispose();
      pathMeshGeo.dispose();
      ribbonGeo.dispose();
      glowGeo.dispose();
      firePlaneGeo.dispose();
      for (const vis of visualPool.current) {
        vis.pathMesh.geometry.dispose();
        vis.pathMesh2?.geometry.dispose();
      }
      for (const ft of frozenTrails.current) {
        const mat = ft.mesh.material;
        if (mat && !Array.isArray(mat)) mat.dispose();
        ft.mesh.geometry.dispose();
      }
    },
    [headGeo, pathMeshGeo, ribbonGeo, glowGeo, firePlaneGeo],
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
      kind: 'wall' | 'floor' | 'ceiling';
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
    } else {
      h.scorchNx = undefined;
      h.scorchNy = undefined;
      h.scorchNz = undefined;
      h.scorchKind = undefined;
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

  const spawnFrozenSegment = (
    group: THREE.Group,
    seg: RocketTrailSegment,
  ) => {
    let slot = frozenTrails.current.find((f) => f.life <= 0);
    if (!slot) {
      if (frozenTrails.current.length >= MAX_FROZEN_TRAILS) {
        slot = frozenTrails.current[0]!;
        for (const f of frozenTrails.current) {
          if (f.life < slot.life) slot = f;
        }
      } else {
        const meshMat = ribbonMat(mats.current, seg.explosive).clone();
        const mesh = new THREE.Mesh(ribbonGeo, meshMat);
        mesh.frustumCulled = false;
        group.add(mesh);
        slot = {
          mesh,
          life: 0,
          baseOpacity: meshMat.opacity,
          from: new THREE.Vector3(),
          to: new THREE.Vector3(),
        };
        frozenTrails.current.push(slot);
      }
    }
    const prevMat = slot.mesh.material;
    if (prevMat && !Array.isArray(prevMat)) prevMat.dispose();
    const meshMat = ribbonMat(mats.current, seg.explosive).clone();
    slot.mesh.material = meshMat;
    slot.baseOpacity = meshMat.opacity;
    placeBounceRibbon(slot.mesh, meshMat, seg.from, seg.to);
    slot.from.copy(seg.from);
    slot.to.copy(seg.to);
    slot.life = FROZEN_TRAIL_LIFE;
  };

  useFrame(({ camera }, dt) => {
    const rockets = rocketsRef.current;
    const group = groupRef.current;
    if (!group) return;
    const nowMs = performance.now();

    camera.getWorldPosition(_camPos);

    for (const ft of frozenTrails.current) {
      if (ft.life <= 0) {
        ft.mesh.visible = false;
        continue;
      }
      ft.life -= dt;
      const mat = ft.mesh.material as THREE.MeshBasicMaterial;
      const lifeFade = Math.max(0, ft.life / FROZEN_TRAIL_LIFE);
      _mid.lerpVectors(ft.from, ft.to, 0.5);
      const camFade =
        (trailCameraFade(ft.from, _camPos) + trailCameraFade(ft.to, _camPos)) *
        0.5;
      mat.opacity = ft.baseOpacity * lifeFade * lifeFade * camFade;
      if (ft.life <= 0 || mat.opacity < 0.02) ft.mesh.visible = false;
    }

    if (rockets.length === 0) {
      for (const v of visualPool.current) hideRocketVisual(v);
    }

    const { rockets: moved, explosions, trailSegments } = updateRockets(
      rockets,
      dt,
      {
        w: ARENA.hexRadius,
        d: ARENA.hexRadius,
        h: ARENA.wallHeight,
      },
    );

    for (const seg of trailSegments) {
      spawnFrozenSegment(group, seg);
    }

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
        const playerHitRadius = ROCKET.playerHitRadius + 0.6;
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
          const ownerId = r.ownerId as ActorId;
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

    while (visualPool.current.length < stillFlying.length) {
      visualPool.current.push(
        createRocketVisual(
          group,
          mats.current,
          headGeo,
          glowGeo,
          firePlaneGeo,
          pathMeshGeo,
        ),
      );
    }

    for (let i = 0; i < visualPool.current.length; i++) {
      const vis = visualPool.current[i];
      if (i < stillFlying.length) {
        updateRocketVisual(vis, stillFlying[i], mats.current, camera, nowMs);
      } else {
        hideRocketVisual(vis);
      }
    }
  });

  return <group ref={groupRef} />;
}
