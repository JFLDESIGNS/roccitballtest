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
  ctx.shadowColor = '#2ad4ff';
  ctx.shadowBlur = 22;
  ctx.lineWidth = 24;
  ctx.strokeStyle = 'rgba(20, 28, 38, 0.92)';
  ctx.strokeText(digits, cx, cy);
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(55, 210, 255, 0.9)';
  ctx.strokeText(digits, cx, cy);
  ctx.shadowBlur = 0;
  ctx.fillStyle = fill;
  ctx.fillText(digits, cx, cy);

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
};

/** Jersey number flat on the floor, yaw toward the active camera */
export function GroundJerseyDecal({
  bodyRef,
  jerseyNumber,
  fillColor = '#f4f8ff',
  size = 3.6,
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
          alphaTest={0.03}
          depthWrite={false}
          depthTest={true}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
