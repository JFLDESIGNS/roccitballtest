import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { ROCKET } from '../shared/Constants';

export type SplashFx = {
  id: string;
  pos: THREE.Vector3;
  radius: number;
  born: number;
};

function SplashSphere({ fx }: { fx: SplashFx }) {
  const shellRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const shellMat = useRef<THREE.MeshStandardMaterial>(null);
  const coreMat = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    const age = performance.now() / 1000 - fx.born;
    const dur = ROCKET.explosionVisualDuration;
    const t = Math.min(1, age / dur);
    const fade = (1 - t) ** 2;
    const expand = fx.radius * (0.08 + t * 0.95);

    if (shellRef.current) shellRef.current.scale.setScalar(expand);
    if (coreRef.current) coreRef.current.scale.setScalar(expand * 0.55);

    if (shellMat.current) {
      shellMat.current.emissiveIntensity = 3.2 * fade;
      shellMat.current.opacity = 0.42 * fade;
    }
    if (coreMat.current) {
      coreMat.current.emissiveIntensity = 5 * fade;
      coreMat.current.opacity = 0.7 * fade;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 6 * fade;
      lightRef.current.distance = fx.radius * 2.5;
    }
  });

  return (
    <group position={[fx.pos.x, fx.pos.y, fx.pos.z]}>
      <pointLight ref={lightRef} color="#ff7700" intensity={6} distance={fx.radius * 2} />
      <mesh ref={shellRef}>
        <sphereGeometry args={[1, 28, 28]} />
        <meshStandardMaterial
          ref={shellMat}
          color="#ff9944"
          emissive="#ff5500"
          emissiveIntensity={3}
          transparent
          opacity={0.4}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={coreRef}>
        <sphereGeometry args={[1, 20, 20]} />
        <meshStandardMaterial
          ref={coreMat}
          color="#ffcc66"
          emissive="#ff8800"
          emissiveIntensity={4}
          transparent
          opacity={0.65}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export function ExplosionSplashes({ splashes }: { splashes: SplashFx[] }) {
  const now = performance.now() / 1000;
  const active = splashes.filter(
    (s) => now - s.born < ROCKET.explosionVisualDuration,
  );
  if (active.length === 0) return null;

  return (
    <group>
      {active.map((fx) => (
        <SplashSphere key={fx.id} fx={fx} />
      ))}
    </group>
  );
}
