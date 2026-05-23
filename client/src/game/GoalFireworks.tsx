import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RENDER } from '../shared/Constants';
import { gameStore } from './gameStore';

type Particle = {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: THREE.Color;
  life: number;
  maxLife: number;
  size: number;
};

const TEAM_COLORS = {
  red: ['#ff4466', '#ffaa44', '#ffee88', '#ff6622'],
  blue: ['#44aaff', '#66ffcc', '#aaddff', '#2266ff'],
} as const;

function spawnBurst(origin: THREE.Vector3, team: 'red' | 'blue'): Particle[] {
  const palette = TEAM_COLORS[team];
  const out: Particle[] = [];
  const count = RENDER.goalFireworkParticles;
  for (let i = 0; i < count; i++) {
    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 1.4 + 0.3,
      (Math.random() - 0.5) * 2,
    ).normalize();
    const speed = 12 + Math.random() * 28;
    const life = 0.9 + Math.random() * 1.1;
    out.push({
      pos: origin.clone().addScaledVector(dir, 1.5 + Math.random() * 2),
      vel: dir.multiplyScalar(speed),
      color: new THREE.Color(palette[i % palette.length]),
      life,
      maxLife: life,
      size: 0.35 + Math.random() * 0.55,
    });
  }
  return out;
}

export function GoalFireworks() {
  const particlesRef = useRef<Particle[]>([]);
  const groupRef = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const flashLightRef = useRef<THREE.PointLight>(null);
  const flashLife = useRef(0);
  const flashOrigin = useRef(new THREE.Vector3());
  const lastCelebrationId = useRef(0);
  const meshPool = useRef<THREE.Mesh[]>([]);

  useEffect(() => {
    const unsub = gameStore.subscribe(() => {
      const c = gameStore.getState().goalCelebration;
      if (!c || c.id === lastCelebrationId.current) return;
      lastCelebrationId.current = c.id;
      flashOrigin.current.set(c.x, c.y, c.z);
      flashLife.current = 1.2;
      particlesRef.current.push(...spawnBurst(flashOrigin.current, c.team));
    });
    return () => {
      unsub();
    };
  }, []);

  useFrame((_, dt) => {
    if (flashLife.current > 0) {
      flashLife.current -= dt;
      const t = Math.max(0, flashLife.current / 1.2);
      if (flashRef.current) {
        flashRef.current.visible = t > 0.02;
        flashRef.current.position.copy(flashOrigin.current);
        flashRef.current.scale.setScalar((1.2 - t) * 18);
        (flashRef.current.material as THREE.MeshBasicMaterial).opacity = t * 0.55;
      }
      if (flashLightRef.current) {
        flashLightRef.current.position.copy(flashOrigin.current);
        flashLightRef.current.intensity = t * 120;
      }
    } else if (flashRef.current) {
      flashRef.current.visible = false;
    }

    const parts = particlesRef.current;
    const alive: Particle[] = [];
    for (const p of parts) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vel.y -= 18 * dt;
      p.pos.addScaledVector(p.vel, dt);
      alive.push(p);
    }
    particlesRef.current = alive;

    const group = groupRef.current;
    if (!group) return;

    while (meshPool.current.length < alive.length) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 6, 6),
        new THREE.MeshBasicMaterial({
          transparent: true,
          toneMapped: false,
          depthWrite: false,
        }),
      );
      group.add(m);
      meshPool.current.push(m);
    }

    for (let i = 0; i < meshPool.current.length; i++) {
      const mesh = meshPool.current[i];
      if (i < alive.length) {
        const p = alive[i];
        const fade = p.life / p.maxLife;
        mesh.visible = true;
        mesh.position.copy(p.pos);
        mesh.scale.setScalar(p.size * fade);
        (mesh.material as THREE.MeshBasicMaterial).color.copy(p.color);
        (mesh.material as THREE.MeshBasicMaterial).opacity = fade;
      } else {
        mesh.visible = false;
      }
    }
  });

  return (
    <group ref={groupRef}>
      <pointLight
        ref={flashLightRef}
        position={[0, 0, 0]}
        color="#ffeeaa"
        intensity={0}
        distance={28}
        decay={2}
      />
      <mesh ref={flashRef} visible={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          color="#ffeeaa"
          transparent
          opacity={0.5}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
