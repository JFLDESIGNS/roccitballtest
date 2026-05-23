import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { loadRocccitLogoTexture } from './roccitLogo';

type RocccitLogoPlaneProps = {
  width: number;
  height: number;
  emissiveBoost?: number;
};

/** Flat screen with Rocccit logo texture */
export function RocccitLogoPlane({
  width,
  height,
  emissiveBoost = 0.35,
}: RocccitLogoPlaneProps) {
  const [map, setMap] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let alive = true;
    loadRocccitLogoTexture().then((tex) => {
      if (alive) setMap(tex);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <mesh>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        map={map}
        transparent
        alphaTest={0.08}
        toneMapped={false}
        emissive="#ffffff"
        emissiveIntensity={map ? emissiveBoost : 0}
        emissiveMap={map}
        metalness={0.1}
        roughness={0.45}
        side={THREE.DoubleSide}
        depthWrite
        depthTest
      />
    </mesh>
  );
}
