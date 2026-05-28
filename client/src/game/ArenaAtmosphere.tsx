import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { ARENA } from '../shared/Constants';
import { graphicsStore } from './graphicsStore';

const POOL = 160;

const pointsVertexShader = /* glsl */ `
  attribute float aAlpha;
  uniform float uSize;
  varying float vAlpha;

  void main() {
    vAlpha = aAlpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * (520.0 / max(-mvPosition.z, 1.0));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const pointsFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    if (d > 0.5) discard;
    float soft = 1.0 - smoothstep(0.08, 0.5, d);
    gl_FragColor = vec4(uColor, soft * vAlpha);
  }
`;

/** Soft floating dust in the stadium volume */
export function ArenaAtmosphere() {
  const gfx = useSyncExternalStore(
    graphicsStore.subscribe,
    graphicsStore.getState,
  );

  const count = gfx.atmosphere ? Math.min(gfx.particleCount, POOL) : 0;

  const { geometry, base, seeds, fade, material } = useMemo(() => {
    const positions = new Float32Array(POOL * 3);
    const basePos = new Float32Array(POOL * 3);
    const seed = new Float32Array(POOL * 3);
    const fadePhase = new Float32Array(POOL * 2);
    const alpha = new Float32Array(POOL);
    const r = ARENA.hexRadius * 0.88;
    for (let i = 0; i < POOL; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * r;
      const x = Math.cos(a) * dist;
      const y = 6 + Math.random() * 32;
      const z = Math.sin(a) * dist;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      basePos[i * 3] = x;
      basePos[i * 3 + 1] = y;
      basePos[i * 3 + 2] = z;
      seed[i * 3] = Math.random() * Math.PI * 2;
      seed[i * 3 + 1] = 0.65 + Math.random() * 1.15;
      seed[i * 3 + 2] = 1.05 + Math.random() * 2.35;
      fadePhase[i * 2] = Math.random() * Math.PI * 2;
      fadePhase[i * 2 + 1] = 0.35 + Math.random() * 0.95;
      alpha[i] = 0;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uSize: { value: 0.32 },
        uColor: { value: new THREE.Color('#c5ccd4') },
      },
      vertexShader: pointsVertexShader,
      fragmentShader: pointsFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      toneMapped: false,
    });
    mat.name = 'ArenaAtmospherePoints';
    return {
      geometry: geo,
      base: basePos,
      seeds: seed,
      fade: fadePhase,
      material: mat,
    };
  }, []);

  useFrame(({ clock }) => {
    if (!gfx.atmosphere || count <= 0) return;

    material.uniforms.uSize!.value = gfx.particleSize;

    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const alphaAttr = geometry.getAttribute('aAlpha') as THREE.BufferAttribute;
    const t = clock.elapsedTime;
    const baseOpacity = gfx.particleOpacity;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const i2 = i * 2;
      const bx = seeds[i * 3];
      const spd = seeds[i * 3 + 1];
      const amp = seeds[i * 3 + 2];
      const fadePhase = fade[i2];
      const fadeSpeed = fade[i2 + 1];
      const pulse = 0.5 + 0.5 * Math.sin(t * fadeSpeed + fadePhase);
      const alpha = (0.22 + 0.78 * Math.pow(pulse, 1.15)) * baseOpacity;

      pos.setX(
        i,
        base[i3] +
          Math.sin(t * 0.34 + bx) * 1.15 +
          Math.cos(t * 0.21 + i * 0.11) * 0.45,
      );
      pos.setY(
        i,
        base[i3 + 1] +
          Math.sin(t * spd + bx) * amp +
          Math.sin(t * 0.28 + i * 0.09) * 1.35,
      );
      pos.setZ(
        i,
        base[i3 + 2] +
          Math.cos(t * 0.31 + bx) * 1.15 +
          Math.sin(t * 0.24 + i * 0.13) * 0.45,
      );
      alphaAttr.setX(i, alpha);
    }
    geometry.setDrawRange(0, count);
    pos.needsUpdate = true;
    alphaAttr.needsUpdate = true;
  });

  if (!gfx.atmosphere || count <= 0) return null;

  return (
    <points
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={6}
    />
  );
}
