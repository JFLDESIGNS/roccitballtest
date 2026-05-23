import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RENDER } from '../shared/Constants';
import type { Team } from '../shared/Types';
import { buildLaserBeamCurve } from './beamTraceCurve';

export type BeamTraceTeam = Team | 'enemy';

type BeamPullTraceProps = {
  active: () => boolean;
  from: () => THREE.Vector3 | null;
  to: () => THREE.Vector3 | null;
  team?: BeamTraceTeam;
  lowEnergy?: boolean;
};

type TracePalette = {
  core: string;
  inner: string;
  mid: string;
  glow: string;
  halo: string;
  outer: string;
};

const TRACE_COLORS: Record<BeamTraceTeam, TracePalette> = {
  blue: {
    core: '#f0fbff',
    inner: '#aae8ff',
    mid: '#66ccff',
    glow: '#2288ff',
    halo: '#1166ee',
    outer: '#0044bb',
  },
  red: {
    core: '#fff4ee',
    inner: '#ffbb99',
    mid: '#ff8866',
    glow: '#ff4433',
    halo: '#ee2200',
    outer: '#bb1100',
  },
  enemy: {
    core: '#ffffcc',
    inner: '#ffcc88',
    mid: '#ffaa55',
    glow: '#ff5522',
    halo: '#ee3300',
    outer: '#aa2200',
  },
};

const LAYER_COUNT = RENDER.beamTraceLayers;
const TUBE_SEGS = RENDER.beamTubeSegments;
const TUBE_RAD = RENDER.beamTubeRadial;

/** Outer → inner tube radii (world units) */
const LAYER_RADII = [0.2, 0.155, 0.115, 0.082, 0.052, 0.032] as const;

export function BeamPullTrace({
  active,
  from,
  to,
  team = 'blue',
  lowEnergy = false,
}: BeamPullTraceProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const fromRef = useRef(new THREE.Vector3());
  const toRef = useRef(new THREE.Vector3());
  const colors = TRACE_COLORS[team];

  const placeholderGeo = useMemo(() => {
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(),
      new THREE.Vector3(0, 0, 0.2),
    ]);
    return new THREE.TubeGeometry(c, 4, 0.04, TUBE_RAD, false);
  }, []);

  const outerTrace = useRef<THREE.Mesh | null>(null);
  const haloTrace = useRef<THREE.Mesh | null>(null);
  const glowTrace = useRef<THREE.Mesh | null>(null);
  const midTrace = useRef<THREE.Mesh | null>(null);
  const innerTrace = useRef<THREE.Mesh | null>(null);
  const coreTrace = useRef<THREE.Mesh | null>(null);
  const wasActive = useRef(false);
  const rebuildPhase = useRef(0);

  const outerMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: colors.outer,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [colors.outer],
  );
  const haloMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: colors.halo,
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [colors.halo],
  );
  const glowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: colors.glow,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [colors.glow],
  );
  const midMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: colors.mid,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [colors.mid],
  );
  const innerMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: colors.inner,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [colors.inner],
  );
  const coreMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: colors.core,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [colors.core],
  );

  const setTube = (
    mesh: THREE.Mesh | null,
    curve: THREE.CatmullRomCurve3,
    radius: number,
  ) => {
    if (!mesh) return;
    const prev = mesh.geometry;
    mesh.geometry = new THREE.TubeGeometry(curve, TUBE_SEGS, radius, TUBE_RAD, false);
    if (prev !== placeholderGeo) prev.dispose();
  };

  useFrame((_, dt) => {
    timeRef.current += dt;
    const group = groupRef.current;
    if (!group) return;

    const start = from();
    const end = to();
    const show = active() && start && end;

    group.visible = !!show;
    if (!show || !start || !end) {
      wasActive.current = false;
      return;
    }

    toRef.current.copy(end);
    fromRef.current.copy(start);

    const t = timeRef.current;
    const wiggle = 0.32 + Math.sin(t * 13) * 0.1;
    const opacity = lowEnergy ? 0.55 + Math.sin(t * 28) * 0.25 : 1;

    const justActivated = !wasActive.current;
    wasActive.current = true;
    const phase = rebuildPhase.current;
    rebuildPhase.current = (phase + 1) % LAYER_COUNT;

    const curves = [
      buildLaserBeamCurve(fromRef.current, toRef.current, t + 0.95, 4.2, wiggle * 1.5),
      buildLaserBeamCurve(fromRef.current, toRef.current, t + 0.7, 3.6, wiggle * 1.4),
      buildLaserBeamCurve(fromRef.current, toRef.current, t + 0.35, 2, wiggle * 1.15),
      buildLaserBeamCurve(fromRef.current, toRef.current, t + 0.2, 1.2, wiggle * 1.1),
      buildLaserBeamCurve(fromRef.current, toRef.current, t + 0.12, 0.6, wiggle * 1.05),
      buildLaserBeamCurve(fromRef.current, toRef.current, t, 0, wiggle),
    ];
    const meshes = [
      outerTrace,
      haloTrace,
      glowTrace,
      midTrace,
      innerTrace,
      coreTrace,
    ];

    if (justActivated) {
      for (let i = 0; i < LAYER_COUNT; i++) {
        setTube(meshes[i].current, curves[i], LAYER_RADII[i]);
      }
    } else {
      setTube(meshes[phase].current, curves[phase], LAYER_RADII[phase]);
    }

    outerMat.opacity = 0.44 * opacity;
    haloMat.opacity = 0.55 * opacity;
    glowMat.opacity = 0.8 * opacity;
    midMat.opacity = 0.92 * opacity;
    innerMat.opacity = 0.97 * opacity;
    coreMat.opacity = opacity;
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={outerTrace} frustumCulled={false} material={outerMat} geometry={placeholderGeo} />
      <mesh ref={haloTrace} frustumCulled={false} material={haloMat} geometry={placeholderGeo} />
      <mesh ref={glowTrace} frustumCulled={false} material={glowMat} geometry={placeholderGeo} />
      <mesh ref={midTrace} frustumCulled={false} material={midMat} geometry={placeholderGeo} />
      <mesh ref={innerTrace} frustumCulled={false} material={innerMat} geometry={placeholderGeo} />
      <mesh ref={coreTrace} frustumCulled={false} material={coreMat} geometry={placeholderGeo} />
    </group>
  );
}
