import * as THREE from 'three';
import type { Team } from '../shared/Types';
import { ARENA_PADS } from '../shared/Constants';
import {
  fanGlassVolumeByDistanceM,
  playFanGlassCheer,
  playFanGlassPanic,
} from './audio';
import { spawnFanGlassCrack } from './fanGlassCrackPool';
import { gameStore } from './gameStore';

/** Tight bounds for rockets/ball — was 0.85 m and caused mid-air hits */
const FAN_GLASS_QUERY_PAD_M = 0.05;

export type FanGlassPanel = {
  bayKey: string;
  homeTeam: Team;
  box: THREE.Box3;
  courtFaceCenter: THREE.Vector3;
  outwardNormal: THREE.Vector3;
  tangent: THREE.Vector3;
  bitangent: THREE.Vector3;
  halfW: number;
  halfH: number;
};

const panels: FanGlassPanel[] = [];
const _courtFace = new THREE.Vector3();
const _outNormal = new THREE.Vector3();
const glassMeshes = new Map<
  string,
  { bayKey: string; homeTeam: Team; mesh: THREE.Mesh }
>();
const _hit = new THREE.Vector3();
const _box = new THREE.Box3();
const _clamped = new THREE.Vector3();
const _segDir = new THREE.Vector3();
const _planeDelta = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _bitangent = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _local = new THREE.Vector3();

const _listener = new THREE.Vector3(0, 2, 0);
const _panelCenter = new THREE.Vector3();

/** Updated each frame from the local player — used for stand crowd volume falloff */
export function setFanGlassListenerPosition(x: number, y: number, z: number): void {
  _listener.set(x, y, z);
}

function crowdVolumeForPanel(panel: FanGlassPanel): number {
  panel.box.getCenter(_panelCenter);
  return fanGlassVolumeByDistanceM(_panelCenter.distanceTo(_listener));
}

const bayGlassCelebrateUntilMs = new Map<string, number>();

export function fanBayHomeTeam(edgeIndex: number): Team {
  return edgeIndex === 1 || edgeIndex === 5 ? 'blue' : 'red';
}

export function fanBayKey(edgeIndex: number): string {
  return `fan-bay-${edgeIndex}`;
}

function glassSurfaceBasis(
  normal: THREE.Vector3,
  tangent: THREE.Vector3,
  bitangent: THREE.Vector3,
): void {
  if (Math.abs(normal.y) > 0.85) {
    tangent.set(1, 0, 0);
  } else {
    tangent.crossVectors(_up, normal);
    if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0);
    tangent.normalize();
  }
  bitangent.crossVectors(normal, tangent).normalize();
}

function storeGlassPanel(
  bayKey: string,
  homeTeam: Team,
  box: THREE.Box3,
  courtFaceCenter: THREE.Vector3,
  outwardNormal: THREE.Vector3,
): void {
  const n = outwardNormal.clone().normalize();
  glassSurfaceBasis(n, _tangent, _bitangent);
  const tight = box.clone().expandByScalar(FAN_GLASS_QUERY_PAD_M);
  const center = tight.getCenter(new THREE.Vector3());
  let halfW = 0.5;
  let halfH = 0.5;
  const corners = [
    new THREE.Vector3(tight.min.x, tight.min.y, tight.min.z),
    new THREE.Vector3(tight.max.x, tight.min.y, tight.min.z),
    new THREE.Vector3(tight.min.x, tight.max.y, tight.min.z),
    new THREE.Vector3(tight.max.x, tight.max.y, tight.min.z),
    new THREE.Vector3(tight.min.x, tight.min.y, tight.max.z),
    new THREE.Vector3(tight.max.x, tight.min.y, tight.max.z),
    new THREE.Vector3(tight.min.x, tight.max.y, tight.max.z),
    new THREE.Vector3(tight.max.x, tight.max.y, tight.max.z),
  ];
  for (const c of corners) {
    _local.subVectors(c, center);
    const u = Math.abs(_local.dot(_tangent));
    const v = Math.abs(_local.dot(_bitangent));
    if (u > halfW) halfW = u;
    if (v > halfH) halfH = v;
  }

  const entry: FanGlassPanel = {
    bayKey,
    homeTeam,
    box: tight,
    courtFaceCenter: courtFaceCenter.clone(),
    outwardNormal: n,
    tangent: _tangent.clone(),
    bitangent: _bitangent.clone(),
    halfW,
    halfH,
  };
  const i = panels.findIndex((p) => p.bayKey === bayKey);
  if (i >= 0) panels[i] = entry;
  else panels.push(entry);
}

export function registerFanGlassMesh(
  bayKey: string,
  homeTeam: Team,
  mesh: THREE.Mesh,
): void {
  glassMeshes.set(bayKey, { bayKey, homeTeam, mesh });
}

export function unregisterFanGlass(bayKey: string): void {
  glassMeshes.delete(bayKey);
  const i = panels.findIndex((p) => p.bayKey === bayKey);
  if (i >= 0) panels.splice(i, 1);
}

/** Call right before rocket/ball segment tests so boxes match current transforms. */
export function refreshFanGlassBoxes(): void {
  for (const { bayKey, homeTeam, mesh } of glassMeshes.values()) {
    mesh.updateWorldMatrix(true, false);
    _box.setFromObject(mesh);
    const halfDepth = ARENA_PADS.fanFacadeGlassThicknessM * 0.5;
    _courtFace.set(0, 0, halfDepth).applyMatrix4(mesh.matrixWorld);
    _outNormal.set(0, 0, 1).transformDirection(mesh.matrixWorld).normalize();
    storeGlassPanel(bayKey, homeTeam, _box, _courtFace, _outNormal);
  }
}

export function getFanGlassPanels(): readonly FanGlassPanel[] {
  return panels;
}

export function trySegmentHitsFanGlass(
  from: THREE.Vector3,
  to: THREE.Vector3,
): FanGlassPanel | null {
  const detailed = trySegmentHitsFanGlassWithPoint(from, to);
  return detailed?.panel ?? null;
}

/** Impact point on the court-facing glass plane */
export function fanGlassImpactPoint(
  from: THREE.Vector3,
  to: THREE.Vector3,
  panel: FanGlassPanel,
): THREE.Vector3 {
  const n = panel.outwardNormal;
  const c = panel.courtFaceCenter;
  _segDir.subVectors(to, from);
  const segLen = _segDir.length();
  if (segLen > 1e-6) {
    const invLen = 1 / segLen;
    _segDir.multiplyScalar(invLen);
    const denom = n.dot(_segDir);
    if (Math.abs(denom) > 1e-8) {
      const t = _planeDelta.subVectors(c, from).dot(n) / denom;
      if (t >= 0 && t <= segLen) {
        _hit.copy(from).addScaledVector(_segDir, t);
        return _hit.clone();
      }
    }
  }

  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    _hit.lerpVectors(from, to, i / steps);
    if (panel.box.containsPoint(_hit)) return _hit.clone();
  }

  _hit.lerpVectors(from, to, 0.5);
  panel.box.clampPoint(_hit, _clamped);
  return _clamped.clone();
}

function pointOnGlassPanel(panel: FanGlassPanel, world: THREE.Vector3): boolean {
  _local.subVectors(world, panel.courtFaceCenter);
  const u = Math.abs(_local.dot(panel.tangent));
  const v = Math.abs(_local.dot(panel.bitangent));
  return u <= panel.halfW && v <= panel.halfH;
}

/** Segment vs court-facing glass plane, then bounds check on the panel */
function segmentHitsGlassPlane(
  from: THREE.Vector3,
  to: THREE.Vector3,
  panel: FanGlassPanel,
): THREE.Vector3 | null {
  const n = panel.outwardNormal;
  const c = panel.courtFaceCenter;
  _segDir.subVectors(to, from);
  const segLen = _segDir.length();
  if (segLen < 1e-8) return null;
  _segDir.multiplyScalar(1 / segLen);
  const denom = n.dot(_segDir);
  if (Math.abs(denom) < 1e-8) return null;
  const t = _planeDelta.subVectors(c, from).dot(n) / denom;
  if (t < 0 || t > segLen) return null;
  _hit.copy(from).addScaledVector(_segDir, t);
  return pointOnGlassPanel(panel, _hit) ? _hit : null;
}

export function trySegmentHitsFanGlassWithPoint(
  from: THREE.Vector3,
  to: THREE.Vector3,
): { panel: FanGlassPanel; point: THREE.Vector3 } | null {
  if (from.distanceToSquared(to) < 1e-8) return null;

  for (const panel of panels) {
    const planeHit = segmentHitsGlassPlane(from, to, panel);
    if (planeHit) {
      return { panel, point: planeHit.clone() };
    }
  }
  return null;
}

function spawnCrackOnPanel(panel: FanGlassPanel, point: THREE.Vector3): void {
  spawnFanGlassCrack(
    point.x,
    point.y,
    point.z,
    panel.outwardNormal.x,
    panel.outwardNormal.y,
    panel.outwardNormal.z,
  );
}

export function triggerFanGlassHit(
  bayKey: string,
  hitPoint?: THREE.Vector3,
): void {
  bayGlassCelebrateUntilMs.set(
    bayKey,
    performance.now() + ARENA_PADS.fanGlassCelebrateMs,
  );
  const panel = panels.find((p) => p.bayKey === bayKey);
  if (panel && hitPoint) spawnCrackOnPanel(panel, hitPoint);
  const localTeam = gameStore.getState().localTeam;
  const volumeMul = panel ? crowdVolumeForPanel(panel) : 0.35;
  if (panel && panel.homeTeam === localTeam) {
    playFanGlassCheer(volumeMul);
  } else {
    playFanGlassPanic(volumeMul);
  }
}

function tryPointNearFanGlass(p: THREE.Vector3, maxDist: number): boolean {
  let closest: FanGlassPanel | null = null;
  let closestDist = maxDist + 1;

  for (const panel of panels) {
    const n = panel.outwardNormal;
    const planeDist = Math.abs(_planeDelta.subVectors(p, panel.courtFaceCenter).dot(n));
    if (planeDist > maxDist) continue;
    if (!pointOnGlassPanel(panel, p)) continue;
    _clamped
      .copy(p)
      .addScaledVector(n, -_planeDelta.subVectors(p, panel.courtFaceCenter).dot(n));
    const d = p.distanceTo(_clamped);
    if (d < closestDist) {
      closestDist = d;
      closest = panel;
    }
  }

  if (closest) {
    triggerFanGlassHit(closest.bayKey, _clamped.clone());
    return true;
  }
  return false;
}

/** Rocket/ball wall impact near fan glass — segment test + proximity fallback. */
export function tryTriggerFanGlassFromWallImpact(
  from: THREE.Vector3,
  to: THREE.Vector3,
): void {
  const segmentHit = trySegmentHitsFanGlassWithPoint(from, to);
  if (segmentHit) {
    triggerFanGlassHit(segmentHit.panel.bayKey, segmentHit.point);
    return;
  }

  if (tryPointNearFanGlass(to, 5.5)) return;
  if (tryPointNearFanGlass(from, 5.5)) return;

  for (let i = 1; i < 8; i++) {
    _hit.lerpVectors(from, to, i / 8);
    if (tryPointNearFanGlass(_hit, 4.5)) return;
  }
}

export function isFanBayGlassCelebrating(bayKey: string): boolean {
  const until = bayGlassCelebrateUntilMs.get(bayKey);
  if (!until) return false;
  if (performance.now() >= until) {
    bayGlassCelebrateUntilMs.delete(bayKey);
    return false;
  }
  return true;
}
