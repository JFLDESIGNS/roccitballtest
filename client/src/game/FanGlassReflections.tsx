import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const _worldCam = new THREE.Vector3();
const _localCam = new THREE.Vector3();
const _clipNormal = new THREE.Vector3(0, 0, 1);

/** Shared tilt for both streaks — nearly vertical, 9° from upright */
const BAR_TILT_RAD = (9 * Math.PI) / 180;
/** Fixed spacing between the two bars (move as one pair) */
const BAR_PAIR_GAP_MULT = 0.11;
/** Gap from the pair center to the solo bar (not touching the pair) */
const BAR_SOLO_GAP_MULT = 0.2;
/** Tall enough that rotated ends fade out inside the glass rect */
const STREAK_HEIGHT_MULT = 5.5;

function createStreakMaterial(opacityMul = 1): THREE.MeshBasicMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.1, 'rgba(255,255,255,0.78)');
    grad.addColorStop(0.38, 'rgba(255,255,255,0.68)');
    grad.addColorStop(0.52, 'rgba(255,255,255,0.42)');
    grad.addColorStop(0.64, 'rgba(255,255,255,0.14)');
    grad.addColorStop(0.76, 'rgba(255,255,255,0.04)');
    grad.addColorStop(0.88, 'rgba(255,255,255,0.01)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;

  return new THREE.MeshBasicMaterial({
    map,
    color: 0xffffff,
    transparent: true,
    opacity: 0.05 * opacityMul,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

type FanGlassReflectionsProps = {
  panelW: number;
  panelH: number;
};

/** Long soft glare streaks — fade at ends, dimmer at grazing view angles. */
export function FanGlassReflections({ panelW, panelH }: FanGlassReflectionsProps) {
  const groupRef = useRef<THREE.Group>(null);
  const shineA = useRef<THREE.Mesh>(null);
  const shineB = useRef<THREE.Mesh>(null);
  const shineC = useRef<THREE.Mesh>(null);
  const smoothOffset = useRef(new THREE.Vector2());
  const streakMat = useMemo(() => createStreakMaterial(0.88), []);
  const soloStreakMat = useMemo(() => createStreakMaterial(0.42), []);

  const barRotation: [number, number, number] = [0, 0, BAR_TILT_RAD];
  const barH = panelH * STREAK_HEIGHT_MULT;
  const barW1 = panelW * 0.14;
  const barW2 = panelW * 0.18;
  const barW3 = panelW * 0.11;

  useFrame(({ camera, clock }) => {
    const root = groupRef.current;
    const a = shineA.current;
    const b = shineB.current;
    const c = shineC.current;
    if (!root || !a || !b || !c) return;

    camera.getWorldPosition(_worldCam);
    root.worldToLocal(_localCam.copy(_worldCam));

    const camLen = _localCam.length();
    const headOn = camLen > 1e-4 ? Math.abs(_localCam.dot(_clipNormal)) / camLen : 1;
    const grazing = 1 - headOn;
    const viewOpacity = THREE.MathUtils.lerp(0.28, 0.035, grazing ** 1.25);
    const breathe = 0.94 + 0.06 * Math.sin(clock.elapsedTime * 0.55);
    const baseOp = viewOpacity * breathe * 0.085;
    streakMat.opacity = baseOp;
    soloStreakMat.opacity = baseOp * 0.48;

    const swayX = Math.sin(clock.elapsedTime * 0.35) * panelW * 0.014;
    const swayY = Math.sin(clock.elapsedTime * 0.28 + 0.9) * panelH * 0.006;
    const targetX = THREE.MathUtils.clamp(
      _localCam.x * 0.4 + _localCam.z * 0.16 + swayX,
      -panelW * 0.36,
      panelW * 0.36,
    );
    const targetY = THREE.MathUtils.clamp(
      _localCam.y * 0.19 + swayY,
      -panelH * 0.16,
      panelH * 0.16,
    );
    const follow = 0.22;
    smoothOffset.current.x = THREE.MathUtils.lerp(
      smoothOffset.current.x,
      targetX,
      follow,
    );
    smoothOffset.current.y = THREE.MathUtils.lerp(
      smoothOffset.current.y,
      targetY,
      follow,
    );
    const ox = smoothOffset.current.x;
    const oy = smoothOffset.current.y;
    const halfGap = panelW * BAR_PAIR_GAP_MULT * 0.5;
    const soloOffset =
      halfGap + panelW * BAR_SOLO_GAP_MULT + panelW * 0.09;

    a.position.set(ox - halfGap, oy, 0.012);
    b.position.set(ox + halfGap, oy, 0.012);
    c.position.set(ox + soloOffset, oy + panelH * 0.02, 0.009);
  });

  useEffect(
    () => () => {
      streakMat.map?.dispose();
      streakMat.dispose();
      soloStreakMat.map?.dispose();
      soloStreakMat.dispose();
    },
    [streakMat, soloStreakMat],
  );

  return (
    <group ref={groupRef} renderOrder={4}>
      <mesh
        ref={shineA}
        material={streakMat}
        rotation={barRotation}
        frustumCulled={false}
      >
        <planeGeometry args={[barW1, barH]} />
      </mesh>
      <mesh
        ref={shineB}
        material={streakMat}
        rotation={barRotation}
        frustumCulled={false}
      >
        <planeGeometry args={[barW2, barH]} />
      </mesh>
      <mesh
        ref={shineC}
        material={soloStreakMat}
        rotation={barRotation}
        frustumCulled={false}
      >
        <planeGeometry args={[barW3, barH * 0.92]} />
      </mesh>
    </group>
  );
}
