import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RENDER } from '../shared/Constants';
import { buildLaserBeamCurve } from './beamTraceCurve';

export type BeamTraceVariant = 'player' | 'enemy';

type BeamPullTraceProps = {
  active: () => boolean;
  from: () => THREE.Vector3 | null;
  to: () => THREE.Vector3 | null;
  variant?: BeamTraceVariant;
  lowEnergy?: boolean;
};

const TRACE_COLORS: Record<
  BeamTraceVariant,
  { core: string; mid: string; glow: string; halo: string }
> = {
  player: {
    core: '#e8ffff',
    mid: '#77ddff',
    glow: '#22aaff',
    halo: '#1188ee',
  },
  enemy: {
    core: '#ffffcc',
    mid: '#ffaa55',
    glow: '#ff5522',
    halo: '#ee3300',
  },
};

const TUBE_SEGS = RENDER.beamTubeSegments;
const TUBE_RAD = RENDER.beamTubeRadial;

export function BeamPullTrace({
  active,
  from,
  to,
  variant = 'player',
  lowEnergy = false,
}: BeamPullTraceProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const fromRef = useRef(new THREE.Vector3());
  const toRef = useRef(new THREE.Vector3());
  const colors = TRACE_COLORS[variant];

  const placeholderGeo = useMemo(() => {
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(),
      new THREE.Vector3(0, 0, 0.2),
    ]);
    return new THREE.TubeGeometry(c, 4, 0.04, TUBE_RAD, false);
  }, []);

  const coreTrace = useRef<THREE.Mesh | null>(null);
  const midTrace = useRef<THREE.Mesh | null>(null);
  const glowTrace = useRef<THREE.Mesh | null>(null);
  const haloTrace = useRef<THREE.Mesh | null>(null);
  const wasActive = useRef(false);
  const rebuildPhase = useRef(0);

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
  const midMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: colors.mid,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [colors.mid],
  );
  const glowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: colors.glow,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [colors.glow],
  );
  const haloMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: colors.halo,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [colors.halo],
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
    rebuildPhase.current = (phase + 1) % 4;

    const coreCurve = buildLaserBeamCurve(fromRef.current, toRef.current, t, 0, wiggle);
    const glowCurve = buildLaserBeamCurve(
      fromRef.current,
      toRef.current,
      t + 0.35,
      2,
      wiggle * 1.15,
    );
    const midCurve = buildLaserBeamCurve(
      fromRef.current,
      toRef.current,
      t + 0.2,
      1.2,
      wiggle * 1.1,
    );
    const haloCurve = buildLaserBeamCurve(
      fromRef.current,
      toRef.current,
      t + 0.7,
      3.6,
      wiggle * 1.4,
    );

    if (justActivated) {
      setTube(coreTrace.current, coreCurve, 0.04);
    } else {
      if (phase === 0) setTube(coreTrace.current, coreCurve, 0.04);
      if (phase === 1) setTube(midTrace.current, midCurve, 0.065);
      if (phase === 2) setTube(glowTrace.current, glowCurve, 0.095);
      if (phase === 3) setTube(haloTrace.current, haloCurve, 0.13);
    }

    coreMat.opacity = opacity;
    midMat.opacity = 0.88 * opacity;
    glowMat.opacity = 0.58 * opacity;
    haloMat.opacity = 0.32 * opacity;
    if (midTrace.current) {
      midTrace.current.visible =
        justActivated || midTrace.current.geometry !== placeholderGeo;
    }
    if (haloTrace.current) {
      haloTrace.current.visible =
        justActivated || haloTrace.current.geometry !== placeholderGeo;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={haloTrace} frustumCulled={false} material={haloMat} geometry={placeholderGeo} />
      <mesh ref={glowTrace} frustumCulled={false} material={glowMat} geometry={placeholderGeo} />
      <mesh ref={midTrace} frustumCulled={false} material={midMat} geometry={placeholderGeo} />
      <mesh ref={coreTrace} frustumCulled={false} material={coreMat} geometry={placeholderGeo} />
    </group>
  );
}
