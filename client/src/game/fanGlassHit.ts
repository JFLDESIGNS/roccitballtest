import * as THREE from 'three';
import type { Team } from '../shared/Types';
import { ARENA_PADS } from '../shared/Constants';
import {
  fanGlassVolumeByDistanceM,
  playFanGlassCheer,
  playFanGlassPanic,
} from './audio';
import { gameStore } from './gameStore';

export type FanGlassPanel = {
  bayKey: string;
  homeTeam: Team;
  box: THREE.Box3;
  courtFaceCenter: THREE.Vector3;
  outwardNormal: THREE.Vector3;
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

function storeGlassPanel(
  bayKey: string,
  homeTeam: Team,
  box: THREE.Box3,
  courtFaceCenter: THREE.Vector3,
  outwardNormal: THREE.Vector3,
): void {
  const entry: FanGlassPanel = {
    bayKey,
    homeTeam,
    box: box.clone().expandByScalar(0.85),
    courtFaceCenter: courtFaceCenter.clone(),
    outwardNormal: outwardNormal.clone(),
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
  if (from.distanceToSquared(to) < 1e-8) return null;

  for (const panel of panels) {
    const box = panel.box;
    if (box.containsPoint(from) || box.containsPoint(to)) return panel;

    const steps = 18;
    for (let i = 0; i <= steps; i++) {
      _hit.lerpVectors(from, to, i / steps);
      if (box.containsPoint(_hit)) return panel;
    }
  }
  return null;
}

export function triggerFanGlassHit(bayKey: string): void {
  bayGlassCelebrateUntilMs.set(
    bayKey,
    performance.now() + ARENA_PADS.fanGlassCelebrateMs,
  );
  const panel = panels.find((p) => p.bayKey === bayKey);
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
    const box = panel.box;
    if (box.containsPoint(p)) {
      triggerFanGlassHit(panel.bayKey);
      return true;
    }
    box.clampPoint(p, _clamped);
    const d = _clamped.distanceTo(p);
    if (d <= maxDist && d < closestDist) {
      closestDist = d;
      closest = panel;
    }
  }

  if (closest) {
    triggerFanGlassHit(closest.bayKey);
    return true;
  }
  return false;
}

/** Rocket/ball wall impact near fan glass — segment test + proximity fallback. */
export function tryTriggerFanGlassFromWallImpact(
  from: THREE.Vector3,
  to: THREE.Vector3,
): void {
  const segmentHit = trySegmentHitsFanGlass(from, to);
  if (segmentHit) {
    triggerFanGlassHit(segmentHit.bayKey);
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
