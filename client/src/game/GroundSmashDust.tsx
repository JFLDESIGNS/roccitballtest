import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

type DustParticle = {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
};

const particles: DustParticle[] = [];
const MAX_DUST = 60;
const DUST_LIFE = 0.55;
const DUST_COLOR = new THREE.Color('#b7a58a');

export function burstGroundSmashDust(x: number, y: number, z: number): void {
  const count = 18;
  for (let i = 0; i < count; i += 1) {
    if (particles.length >= MAX_DUST) particles.shift();
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.25 + Math.random() * 0.95;
    const speed = 3.5 + Math.random() * 7.5;
    const life = DUST_LIFE + Math.random() * 0.18;
    particles.push({
      pos: new THREE.Vector3(
        x + Math.cos(angle) * radius,
        y + 0.08 + Math.random() * 0.12,
        z + Math.sin(angle) * radius,
      ),
      vel: new THREE.Vector3(
        Math.cos(angle) * speed,
        1.5 + Math.random() * 2.8,
        Math.sin(angle) * speed,
      ),
      life,
      maxLife: life,
      size: 0.18 + Math.random() * 0.32,
    });
  }
}

export function GroundSmashDust() {
  const groupRef = useRef<THREE.Group>(null);
  const meshPool = useRef<THREE.Mesh[]>([]);

  useFrame((_, dt) => {
    const alive: DustParticle[] = [];
    for (const p of particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vel.y -= 7 * dt;
      p.vel.multiplyScalar(1 - Math.min(0.72, dt * 1.8));
      p.pos.addScaledVector(p.vel, dt);
      alive.push(p);
    }
    particles.length = 0;
    particles.push(...alive);

    const group = groupRef.current;
    if (!group) return;

    while (meshPool.current.length < alive.length) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(1, 8, 6),
        new THREE.MeshBasicMaterial({
          color: DUST_COLOR,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      group.add(m);
      meshPool.current.push(m);
    }

    for (let i = 0; i < meshPool.current.length; i += 1) {
      const mesh = meshPool.current[i];
      if (i < alive.length) {
        const p = alive[i];
        const fade = p.life / p.maxLife;
        mesh.visible = true;
        mesh.position.copy(p.pos);
        mesh.scale.setScalar(p.size * (0.45 + (1 - fade) * 1.65));
        const material = mesh.material as THREE.MeshBasicMaterial;
        material.opacity = fade * 0.42;
      } else {
        mesh.visible = false;
      }
    }
  });

  return <group ref={groupRef} />;
}
