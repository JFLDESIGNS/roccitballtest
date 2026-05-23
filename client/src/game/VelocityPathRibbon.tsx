import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { trailCameraFade } from './trailCameraFade';

type VelocityPathRibbonProps = {
  samplePosition: () => THREE.Vector3 | null;
  hidden?: boolean;
  color?: string;
  opacity?: number;
  maxPoints?: number;
  minStep?: number;
  /** World-space ribbon half-width (m); enables thick mesh trail */
  lineWidthWorld?: number;
  /** Second ribbon plane rotated 90° — visible from all angles (X cross-section) */
  crossSection?: boolean;
};

const DEFAULT_COLOR = '#ffffff';
const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _binormal = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _fallback = new THREE.Vector3(1, 0, 0);
const _camPos = new THREE.Vector3();

function pushHistory(
  history: THREE.Vector3[],
  p: THREE.Vector3,
  maxPoints: number,
  minStep: number,
) {
  const last = history[history.length - 1];
  if (last && last.distanceToSquared(p) < minStep * minStep) return;
  history.push(p.clone());
  while (history.length > maxPoints) {
    history.shift();
  }
}

function trailFade(
  i: number,
  n: number,
  opacity: number,
  worldPos: THREE.Vector3,
  camPos: THREE.Vector3,
): number {
  const t = n <= 1 ? 1 : i / (n - 1);
  const along = 0.22 + t * 0.78;
  return along * trailCameraFade(worldPos, camPos) * opacity;
}

function makeRibbonGeometry(maxPoints: number) {
  const maxVerts = maxPoints * 2;
  const positions = new Float32Array(maxVerts * 3);
  const colors = new Float32Array(maxVerts * 3);
  const indices: number[] = [];
  for (let i = 0; i < maxPoints - 1; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  return geo;
}

function makeRibbonMaterial() {
  return new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

/** White fading motion ribbon */
export function VelocityPathRibbon({
  samplePosition,
  hidden = false,
  color = DEFAULT_COLOR,
  opacity = 0.55,
  maxPoints = 14,
  minStep = 0.22,
  lineWidthWorld,
  crossSection = false,
}: VelocityPathRibbonProps) {
  const { camera } = useThree();
  const history = useRef<THREE.Vector3[]>([]);
  const meshRef = useRef<THREE.Mesh>(null);
  const meshRef2 = useRef<THREE.Mesh>(null);
  const lineRef = useRef<THREE.Line>(null);

  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const thick = lineWidthWorld != null && lineWidthWorld > 0;
  const halfWidth = lineWidthWorld ?? 0.2;

  const thinLine = useMemo(() => {
    const positions = new Float32Array(maxPoints * 3);
    const colors = new Float32Array(maxPoints * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const l = new THREE.Line(geo, mat);
    l.frustumCulled = false;
    l.renderOrder = 8;
    return l;
  }, [maxPoints]);

  const ribbonGeo = useMemo(() => makeRibbonGeometry(maxPoints), [maxPoints]);
  const ribbonGeo2 = useMemo(
    () => (crossSection ? makeRibbonGeometry(maxPoints) : null),
    [maxPoints, crossSection],
  );
  const ribbonMat = useMemo(() => makeRibbonMaterial(), []);
  const ribbonMat2 = useMemo(
    () => (crossSection ? makeRibbonMaterial() : null),
    [crossSection],
  );

  const updateMeshRibbon = (
    geo: THREE.BufferGeometry,
    mesh: THREE.Mesh,
    n: number,
    widthAxis: 'right' | 'binormal',
  ) => {
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    const pts = history.current;
    camera.getWorldPosition(_camPos);

    for (let i = 0; i < n; i++) {
      if (i < n - 1) {
        _dir.subVectors(pts[i + 1]!, pts[i]!);
      } else {
        _dir.subVectors(pts[i]!, pts[i - 1]!);
      }
      if (_dir.lengthSq() < 1e-8) _dir.set(0, 0, 1);
      _dir.normalize();

      _right.crossVectors(_dir, _worldUp);
      if (_right.lengthSq() < 1e-8) _right.crossVectors(_dir, _fallback);
      _right.normalize();

      _binormal.crossVectors(_right, _dir).normalize();
      const axis = widthAxis === 'right' ? _right : _binormal;

      const p = pts[i]!;
      const fade = trailFade(i, n, opacity, p, _camPos);
      const w = halfWidth * (0.45 + fade * 0.55);
      const ax = axis.x * w;
      const ay = axis.y * w;
      const az = axis.z * w;

      const vi = i * 2;
      posAttr.setXYZ(vi, p.x - ax, p.y - ay, p.z - az);
      posAttr.setXYZ(vi + 1, p.x + ax, p.y + ay, p.z + az);
      colAttr.setXYZ(vi, baseColor.r * fade, baseColor.g * fade, baseColor.b * fade);
      colAttr.setXYZ(
        vi + 1,
        baseColor.r * fade,
        baseColor.g * fade,
        baseColor.b * fade,
      );
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;

    const indexCount = Math.max(0, (n - 1) * 6);
    geo.setDrawRange(0, indexCount);
    mesh.visible = true;
  };

  useFrame(() => {
    if (thick) {
      const mesh = meshRef.current;
      if (!mesh) return;

      if (hidden) {
        mesh.visible = false;
        if (meshRef2.current) meshRef2.current.visible = false;
        history.current.length = 0;
        return;
      }

      const p = samplePosition();
      if (!p) {
        mesh.visible = false;
        if (meshRef2.current) meshRef2.current.visible = false;
        return;
      }

      pushHistory(history.current, p, maxPoints, minStep);
      const n = history.current.length;
      if (n < 2) {
        mesh.visible = false;
        if (meshRef2.current) meshRef2.current.visible = false;
        return;
      }

      updateMeshRibbon(ribbonGeo, mesh, n, 'right');
      if (crossSection && ribbonGeo2 && meshRef2.current && ribbonMat2) {
        updateMeshRibbon(ribbonGeo2, meshRef2.current, n, 'binormal');
      }
      return;
    }

    const mesh = lineRef.current ?? thinLine;
    if (!mesh) return;

    if (hidden) {
      mesh.visible = false;
      history.current.length = 0;
      return;
    }

    const p = samplePosition();
    if (!p) {
      mesh.visible = false;
      return;
    }

    pushHistory(history.current, p, maxPoints, minStep);
    const n = history.current.length;
    if (n < 2) {
      mesh.visible = false;
      return;
    }

    mesh.visible = true;
    const posAttr = mesh.geometry.getAttribute(
      'position',
    ) as THREE.BufferAttribute;
    const colAttr = mesh.geometry.getAttribute('color') as THREE.BufferAttribute;

    camera.getWorldPosition(_camPos);

    for (let i = 0; i < n; i++) {
      const h = history.current[i]!;
      posAttr.setXYZ(i, h.x, h.y, h.z);
      const fade = trailFade(i, n, opacity, h, _camPos);
      colAttr.setXYZ(
        i,
        baseColor.r * fade,
        baseColor.g * fade,
        baseColor.b * fade,
      );
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    mesh.geometry.setDrawRange(0, n);
  }, 50);

  if (thick) {
    return (
      <>
        <mesh
          ref={meshRef}
          geometry={ribbonGeo}
          material={ribbonMat}
          frustumCulled={false}
          renderOrder={8}
        />
        {crossSection && ribbonGeo2 && ribbonMat2 && (
          <mesh
            ref={meshRef2}
            geometry={ribbonGeo2}
            material={ribbonMat2}
            frustumCulled={false}
            renderOrder={9}
          />
        )}
      </>
    );
  }

  return <primitive ref={lineRef} object={thinLine} />;
}
