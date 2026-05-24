import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { BALL } from '../shared/Constants';

type PhysicsBallWireframeProps = {
  bodyRef: React.RefObject<RapierRigidBody | null>;
  visible: boolean;
  meshRef?: React.RefObject<THREE.Mesh | null>;
};

/** Exact physics-body pose — debug overlay only, no simulation. */
export function PhysicsBallWireframe({
  bodyRef,
  visible,
  meshRef: meshRefProp,
}: PhysicsBallWireframeProps) {
  const internalMeshRef = useRef<THREE.Mesh>(null);
  const meshRef = meshRefProp ?? internalMeshRef;

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (!visible) {
      mesh.visible = false;
      return;
    }
    const body = bodyRef.current;
    if (!body) {
      mesh.visible = false;
      return;
    }
    const t = body.translation();
    const r = body.rotation();
    mesh.position.set(t.x, t.y, t.z);
    mesh.quaternion.set(r.x, r.y, r.z, r.w);
    mesh.visible = true;
  }, -1);

  return (
    <mesh ref={meshRef} visible={false} frustumCulled={false} renderOrder={12}>
      <sphereGeometry args={[BALL.radius, 14, 12]} />
      <meshBasicMaterial
        color="#5dffa8"
        wireframe
        transparent
        opacity={0.9}
        depthTest
      />
    </mesh>
  );
}
