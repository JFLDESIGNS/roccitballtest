import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { BALL } from '../shared/Constants';

type BallCarryVisualProps = {
  active: boolean;
  ballPosition: () => THREE.Vector3 | null;
};

/** Soft glow + ribbon rings when the ball is beam-held */
export function BallCarryVisual({ active, ballPosition }: BallCarryVisualProps) {
  const groupRef = useRef<THREE.Group>(null);
  const glowMat = useRef<THREE.MeshStandardMaterial>(null);
  const ribbonMat = useRef<THREE.MeshStandardMaterial>(null);
  const ribbon2Mat = useRef<THREE.MeshStandardMaterial>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    const pos = ballPosition();
    const show = active && pos;
    group.visible = !!show;
    if (!show || !pos) return;

    const t = clock.getElapsedTime();
    group.position.copy(pos);
    group.rotation.y = t * 1.4;

    const pulse = 0.9 + Math.sin(t * 5) * 0.25;
    if (glowMat.current) glowMat.current.emissiveIntensity = 1.35 * pulse;
    if (ribbonMat.current) ribbonMat.current.emissiveIntensity = 1.6 * pulse;
    if (ribbon2Mat.current) ribbon2Mat.current.emissiveIntensity = 1.2 * pulse;
    if (lightRef.current) lightRef.current.intensity = 2.5 * pulse;
  });

  const r = BALL.radius;

  return (
    <group ref={groupRef} visible={false}>
      <pointLight
        ref={lightRef}
        color="#ffee88"
        intensity={2.5}
        distance={r * 6}
        decay={2}
      />
      <mesh scale={[1.12, 1.12, 1.12]}>
        <sphereGeometry args={[r, 24, 24]} />
        <meshStandardMaterial
          ref={glowMat}
          color="#fff4aa"
          emissive="#ffdd44"
          emissiveIntensity={1.2}
          transparent
          opacity={0.22}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[r * 1.15, 0.14, 32, 64]} />
        <meshStandardMaterial
          ref={ribbonMat}
          color="#aaddff"
          emissive="#66ccff"
          emissiveIntensity={1.4}
          transparent
          opacity={0.85}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation={[Math.PI / 3.2, 0, Math.PI / 4]}>
        <torusGeometry args={[r * 1.08, 0.1, 28, 48]} />
        <meshStandardMaterial
          ref={ribbon2Mat}
          color="#ffeeaa"
          emissive="#ffaa55"
          emissiveIntensity={1.1}
          transparent
          opacity={0.7}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
