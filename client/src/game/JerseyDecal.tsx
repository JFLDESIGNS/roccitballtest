import { useRapier } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { formatJersey } from './playerRoster';
import { traceGroundDecal } from './groundDecalTrace';
import { playerFeetY } from './playerGroundProbe';

/** Floor numbers above arena / props / VFX */
export const JERSEY_DECAL_RENDER_ORDER = 60;
/** Player / bot meshes always on top of floor numbers */
export const CHARACTER_MESH_RENDER_ORDER = 100;
/** Floor jersey digits — material opacity (bots only; local player has no decal) */
export const GROUND_JERSEY_DECAL_OPACITY = 0.48;

const textureCache = new Map<string, THREE.CanvasTexture>();
const _euler = new THREE.Euler(-Math.PI / 2, 0, 0, 'YXZ');
const _quat = new THREE.Quaternion();

function makeNumberTexture(digits: string, fill: string): THREE.CanvasTexture {
  const key = `${digits}-${fill}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    textureCache.set(key, fallback);
    return fallback;
  }

  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;
  const font = '700 200px Orbitron, "Share Tech Mono", system-ui, sans-serif';
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 8;
  ctx.lineWidth = 16;
  ctx.strokeStyle = 'rgba(20, 24, 28, 0.45)';
  ctx.strokeText(digits, cx, cy);
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(90, 98, 108, 0.38)';
  ctx.strokeText(digits, cx, cy);
  ctx.shadowBlur = 0;
  ctx.fillStyle = fill;
  ctx.globalAlpha = 0.72;
  ctx.fillText(digits, cx, cy);
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  textureCache.set(key, tex);
  return tex;
}

type GroundJerseyDecalProps = {
  bodyRef: React.RefObject<RapierRigidBody | null>;
  jerseyNumber: number;
  fillColor?: string;
  /** World-space size on floor (m) */
  size?: number;
  /** When set with hideWhenGrounded, skip the decal while feet are on the ground */
  groundedRef?: React.RefObject<boolean>;
  hideWhenGrounded?: boolean;
  opacity?: number;
};

/** Jersey number flat on the floor, yaw toward the active camera */
export function GroundJerseyDecal({
  bodyRef,
  jerseyNumber,
  fillColor = '#d8dce2',
  size = 3.6,
  groundedRef,
  hideWhenGrounded = false,
  opacity = GROUND_JERSEY_DECAL_OPACITY,
}: GroundJerseyDecalProps) {
  const { world } = useRapier();
  const groupRef = useRef<THREE.Group>(null);
  const hitScratch = useRef({ point: new THREE.Vector3() });
  const digits = formatJersey(jerseyNumber);
  const map = useMemo(
    () => makeNumberTexture(digits, fillColor),
    [digits, fillColor],
  );

  useFrame((state) => {
    const group = groupRef.current;
    const body = bodyRef.current;
    if (!group) return;
    if (!body) {
      group.visible = false;
      return;
    }

    if (hideWhenGrounded && groundedRef?.current) {
      group.visible = false;
      return;
    }

    const t = body.translation();
    const anchorY = playerFeetY(t.y);
    traceGroundDecal(
      world,
      t.x,
      anchorY,
      t.z,
      body,
      hitScratch.current,
    );

    const cam = state.camera.position;
    const yaw = Math.atan2(cam.x - t.x, cam.z - t.z);
    _euler.set(-Math.PI / 2, yaw, 0);
    _quat.setFromEuler(_euler);

    group.visible = true;
    group.position.copy(hitScratch.current.point);
    group.quaternion.copy(_quat);
  });

  return (
    <group ref={groupRef} visible={false} renderOrder={JERSEY_DECAL_RENDER_ORDER}>
      <mesh renderOrder={JERSEY_DECAL_RENDER_ORDER}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial
          map={map}
          transparent
          opacity={opacity}
          alphaTest={0.03}
          depthWrite={false}
          depthTest={true}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
