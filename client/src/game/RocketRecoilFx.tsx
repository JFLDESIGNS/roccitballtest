import { useFrame } from '@react-three/fiber';
import { useState } from 'react';
import * as THREE from 'three';
import {
  getRocketMuzzleFlashes,
  tickRocketRecoil,
  type RocketMuzzleFlash,
} from './rocketRecoil';

const _coneForward = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();

function MuzzleCone({ flash }: { flash: RocketMuzzleFlash }) {
  const life = Math.max(0, flash.life);
  const pop = life * life;
  const scale = (0.55 + (flash.explosive ? 0.2 : 0) + pop * 0.85) * life;
  const opacity = Math.min(1, life * 1.15) * 0.92;

  _dir.set(flash.dirX, flash.dirY, flash.dirZ);
  if (_dir.lengthSq() < 1e-8) _dir.set(0, 0, 1);
  _dir.normalize();
  _quat.setFromUnitVectors(_coneForward, _dir);

  return (
    <group position={[flash.x, flash.y, flash.z]} quaternion={_quat}>
      <mesh scale={[scale * 0.72, scale * 1.05, scale * 0.72]} renderOrder={18}>
        <coneGeometry args={[0.42, 1.05, 10, 1, true]} />
        <meshBasicMaterial
          color={flash.explosive ? '#fff4b8' : '#fffef5'}
          transparent
          opacity={opacity}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh
        scale={[scale * 0.5, scale * 0.65, scale * 0.5]}
        position={[0, 0.22 * scale, 0]}
        renderOrder={19}
      >
        <coneGeometry args={[0.28, 0.55, 8, 1, true]} />
        <meshBasicMaterial
          color={flash.explosive ? '#ffcc55' : '#ffe8a8'}
          transparent
          opacity={opacity * 0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/** Ticks recoil decay + draws toon muzzle cones */
export function RocketRecoilFx() {
  const [flashes, setFlashes] = useState<readonly RocketMuzzleFlash[]>([]);

  useFrame((_, dt) => {
    tickRocketRecoil(dt);
    setFlashes([...getRocketMuzzleFlashes()]);
  });

  if (flashes.length === 0) return null;

  return (
    <group>
      {flashes.map((f, i) => (
        <MuzzleCone key={`muzzle-${i}-${f.life.toFixed(2)}`} flash={f} />
      ))}
    </group>
  );
}
