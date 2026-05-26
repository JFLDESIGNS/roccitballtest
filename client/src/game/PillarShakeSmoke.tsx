import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ARENA_PILLAR } from './arenaPillarConfig';
import { tickPillarSmokePuffs } from './pillarSmokePuffs';

const MAX_INSTANCES = 160;
/** ~50% more transparent than prior pillar poof */
const SMOKE_OPACITY = 0.05;
const FRESNEL_OPACITY = 0.06;
const SMOKE_Y_MIN = ARENA_PILLAR.floorY;
const SMOKE_Y_MAX = ARENA_PILLAR.floorY + ARENA_PILLAR.height;
const SMOKE_COLOR_BOTTOM = new THREE.Color(0x101214);
const SMOKE_COLOR_TOP = new THREE.Color(0x3a3e44);
const _smokeColor = new THREE.Color();

/** Grow-in envelope — 2× faster timing */
function growEnvelope(age: number): number {
  const t = Math.min(age / 0.19, 1);
  const ease = 1 - (1 - t) ** 3;
  return 0.55 + ease * 0.45;
}

const SQUASH_BLEND_AGE = 0.5;

function squashForAge(age: number): number {
  const t = Math.min(age / SQUASH_BLEND_AGE, 1);
  const eased = t * t * (3 - 2 * t);
  return THREE.MathUtils.lerp(0.94, 0.28, eased);
}

function heightColor(y: number, out: THREE.Color): THREE.Color {
  const t = THREE.MathUtils.clamp(
    (y - SMOKE_Y_MIN) / (SMOKE_Y_MAX - SMOKE_Y_MIN),
    0,
    1,
  );
  return out.lerpColors(SMOKE_COLOR_BOTTOM, SMOKE_COLOR_TOP, t);
}

const fresnelVertex = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  void main() {
    vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fresnelFragment = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  uniform float uOpacity;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - max(dot(normalize(vWorldNormal), viewDir), 0.0), 2.2);
    float rim = smoothstep(0.22, 0.88, fresnel);
    gl_FragColor = vec4(0.26, 0.28, 0.3, rim * uOpacity);
  }
`;

export function PillarShakeSmoke() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const fresnelRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: SMOKE_OPACITY,
        depthWrite: false,
        depthTest: true,
        toneMapped: false,
        blending: THREE.NormalBlending,
        vertexColors: true,
      }),
    [],
  );
  const fresnelMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uOpacity: { value: FRESNEL_OPACITY } },
        vertexShader: fresnelVertex,
        fragmentShader: fresnelFragment,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        toneMapped: false,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const geo = useMemo(() => new THREE.SphereGeometry(1, 12, 10), []);

  useLayoutEffect(() => {
    for (const mesh of [meshRef.current, fresnelRef.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
    }
  }, []);

  useFrame((_, dt) => {
    const inst = meshRef.current;
    const rim = fresnelRef.current;
    if (!inst || !rim) return;
    const active = tickPillarSmokePuffs(dt);
    let n = 0;

    for (let i = 0; i < active.length && n < MAX_INSTANCES; i++) {
      const p = active[i]!;
      const lifeT = Math.max(0, p.life / p.maxLife);
      const age = 1 - lifeT;
      const grow = growEnvelope(age);
      const fade = Math.pow(lifeT, 1.55);
      const sx = p.maxSize * grow * (0.35 + fade * 0.65);
      const sy = sx * squashForAge(age);

      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(sx, sy, sx);
      dummy.updateMatrix();
      inst.setMatrixAt(n, dummy.matrix);
      inst.setColorAt(n, heightColor(p.y, _smokeColor));

      dummy.scale.set(sx * 1.38, sy * 1.32, sx * 1.38);
      dummy.updateMatrix();
      rim.setMatrixAt(n, dummy.matrix);

      n++;
    }

    inst.count = n;
    rim.count = n;
    inst.instanceMatrix.needsUpdate = true;
    rim.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[geo, mat, MAX_INSTANCES]}
        frustumCulled={false}
        renderOrder={14}
      />
      <instancedMesh
        ref={fresnelRef}
        args={[geo, fresnelMat, MAX_INSTANCES]}
        frustumCulled={false}
        renderOrder={15}
      />
    </>
  );
}
