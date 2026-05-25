import { useMemo } from 'react';
import * as THREE from 'three';

type PuffSpec = {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
};

type CloudClusterSpec = {
  position: [number, number, number];
  scale: number;
  puffs: PuffSpec[];
};

const DIST = 3;
const NEAR_RING_M = 31 * DIST;

function farPos(x: number, y: number, z: number): [number, number, number] {
  return [x * DIST, y * 1.12, z * DIST];
}

/** Hand-tuned billowy shapes — rotated/scaled per cluster for variety */
const CLOUD_TEMPLATES: PuffSpec[][] = [
  [
    { x: 0, y: 0, z: 0, sx: 17, sy: 11, sz: 14 },
    { x: 10, y: 1.8, z: 3, sx: 12, sy: 8, sz: 11 },
    { x: -9, y: 2.2, z: -4, sx: 13, sy: 7, sz: 12 },
    { x: 4, y: -1, z: -8, sx: 10, sy: 6, sz: 10 },
    { x: -5, y: 3, z: 7, sx: 9, sy: 9, sz: 9 },
    { x: 14, y: 0.5, z: 0, sx: 20, sy: 5, sz: 7 },
  ],
  [
    { x: 0, y: 0, z: 0, sx: 16, sy: 10, sz: 15 },
    { x: -11, y: 1.5, z: 2, sx: 11, sy: 8, sz: 10 },
    { x: 8, y: 2.5, z: -5, sx: 12, sy: 7, sz: 11 },
    { x: 2, y: 4, z: 6, sx: 9, sy: 10, sz: 8 },
    { x: -7, y: -0.5, z: -9, sx: 14, sy: 4.5, sz: 8 },
    { x: 6, y: 1, z: 10, sx: 8, sy: 7, sz: 13 },
  ],
  [
    { x: 0, y: 0, z: 0, sx: 18, sy: 9, sz: 13 },
    { x: 7, y: 2, z: 5, sx: 10, sy: 9, sz: 10 },
    { x: -10, y: 1, z: -2, sx: 13, sy: 8, sz: 12 },
    { x: -4, y: 3.5, z: 8, sx: 8, sy: 8, sz: 9 },
    { x: 11, y: 0, z: -6, sx: 11, sy: 6, sz: 11 },
    { x: -15, y: 1.2, z: 1, sx: 22, sy: 4.8, sz: 6 },
  ],
];

function stylizedPuffs(clusterIndex: number): PuffSpec[] {
  const template = CLOUD_TEMPLATES[clusterIndex % CLOUD_TEMPLATES.length]!;
  const rot = clusterIndex * 1.17 + 0.4;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const scale = 0.9 + (clusterIndex % 4) * 0.06;
  return template.map((p, i) => ({
    x: (p.x * c - p.z * s) * scale,
    y: p.y + Math.sin(clusterIndex * 0.8 + i) * 0.6,
    z: (p.x * s + p.z * c) * scale,
    sx: p.sx * scale,
    sy: p.sy * scale,
    sz: p.sz * scale,
  }));
}

const CLOUD_CLUMP_PLACES: Omit<CloudClusterSpec, 'puffs'>[] = [
  { position: farPos(220, 78, -140), scale: 1.15 },
  { position: farPos(-240, 82, 120), scale: 1.1 },
  { position: farPos(160, 74, 200), scale: 1.05 },
  { position: farPos(-180, 80, -200), scale: 1.12 },
  { position: farPos(0, 88, -260), scale: 1.2 },
  { position: farPos(280, 76, 60), scale: 1.08 },
  { position: farPos(-200, 84, -80), scale: 1.06 },
  { position: farPos(NEAR_RING_M / DIST, 76, 0), scale: 1 },
  { position: farPos(-NEAR_RING_M / DIST, 78, 14), scale: 0.98 },
  { position: farPos(10, 74, NEAR_RING_M / DIST), scale: 0.96 },
  { position: farPos(-8, 77, -NEAR_RING_M / DIST), scale: 1 },
  { position: farPos(0, 80, NEAR_RING_M / DIST + 3), scale: 1.02 },
  { position: farPos(NEAR_RING_M / DIST + 4, 75, -NEAR_RING_M / DIST), scale: 0.94 },
];

function puffBlocksCourt(
  clusterPos: [number, number, number],
  clusterScale: number,
  p: PuffSpec,
): boolean {
  const wx = clusterPos[0] + p.x * clusterScale;
  const wy = clusterPos[1] + p.y * clusterScale;
  const wz = clusterPos[2] + p.z * clusterScale;
  const reach = Math.max(p.sx, p.sy, p.sz) * clusterScale * 0.42;
  const r = Math.hypot(wx, wz);
  return r - reach < 52 && wy - reach * 0.35 < 48;
}

const CLOUD_CLUSTERS: CloudClusterSpec[] = CLOUD_CLUMP_PLACES.map((c, i) => ({
  ...c,
  puffs: stylizedPuffs(i).filter(
    (p) => !puffBlocksCourt(c.position, c.scale, p),
  ),
})).filter((c) => c.puffs.length > 0);

const cloudPuffMaterial = new THREE.MeshBasicMaterial({
  color: '#f6faff',
  transparent: true,
  opacity: 0.8,
  depthWrite: false,
  fog: false,
});

const skyDomeMaterial = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  uniforms: {
    uTop: { value: new THREE.Color('#3d8fd9') },
    uHorizon: { value: new THREE.Color('#7ec0f5') },
    uBottom: { value: new THREE.Color('#b5dcfa') },
  },
  vertexShader: /* glsl */ `
    varying vec3 vWorldPos;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uTop;
    uniform vec3 uHorizon;
    uniform vec3 uBottom;
    varying vec3 vWorldPos;
    void main() {
      float h = normalize(vWorldPos).y * 0.5 + 0.5;
      vec3 col = h > 0.55
        ? mix(uHorizon, uTop, smoothstep(0.55, 1.0, h))
        : mix(uBottom, uHorizon, smoothstep(0.0, 0.55, h));
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});

function CloudCluster({
  position,
  scale,
  puffs,
}: CloudClusterSpec) {
  const geo = useMemo(() => new THREE.SphereGeometry(1, 14, 10), []);

  return (
    <group position={position} scale={scale}>
      {puffs.map((p, i) => (
        <mesh
          key={i}
          geometry={geo}
          material={cloudPuffMaterial}
          position={[p.x, p.y, p.z]}
          scale={[p.sx, p.sy, p.sz]}
          castShadow={false}
          receiveShadow={false}
        />
      ))}
    </group>
  );
}

/** Open sky — gradient dome + sparse distant cloud clumps */
export function ArenaSky() {
  const domeGeo = useMemo(() => new THREE.SphereGeometry(920, 32, 24), []);

  return (
    <group frustumCulled={false} renderOrder={-20}>
      <mesh geometry={domeGeo} material={skyDomeMaterial} frustumCulled={false} />
      {CLOUD_CLUSTERS.map((cluster, i) => (
        <CloudCluster key={i} {...cluster} />
      ))}
    </group>
  );
}
