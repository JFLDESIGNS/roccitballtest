import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { loadRocccitLogoTexture } from './roccitLogo';

type RocccitLogoStampProps = {
  /** Max width or height while preserving aspect (m) */
  size?: number;
  maxWidth?: number;
  maxHeight?: number;
  rotationY?: number;
};

function fitLogoDimensions(
  aspect: number,
  size: number,
  maxWidth?: number,
  maxHeight?: number,
): { w: number; h: number } {
  let w = aspect >= 1 ? size : size * aspect;
  let h = aspect >= 1 ? size / aspect : size;
  if (maxWidth !== undefined && w > maxWidth) {
    const s = maxWidth / w;
    w *= s;
    h *= s;
  }
  if (maxHeight !== undefined && h > maxHeight) {
    const s = maxHeight / h;
    w *= s;
    h *= s;
  }
  return { w, h };
}

/**
 * Logo stamp with correct aspect ratio and alpha preserved (normal depth sorting).
 */
export function RocccitLogoStamp({
  size = 3,
  maxWidth,
  maxHeight,
  rotationY = 0,
}: RocccitLogoStampProps) {
  const [map, setMap] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let alive = true;
    loadRocccitLogoTexture().then((tex) => {
      if (!alive) return;
      tex.premultiplyAlpha = false;
      setMap(tex);
    });
    return () => {
      alive = false;
    };
  }, []);

  const { w, h } = useMemo(() => {
    const img = map?.image as { width?: number; height?: number } | undefined;
    const iw = img?.width ?? 800;
    const ih = img?.height ?? 400;
    const aspect = iw / ih;
    return fitLogoDimensions(aspect, size, maxWidth, maxHeight);
  }, [map, size, maxWidth, maxHeight]);

  if (!map) return null;

  return (
    <group rotation={[0, rotationY, 0]}>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial
          map={map}
          transparent
          alphaTest={0.08}
          depthWrite
          depthTest
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
