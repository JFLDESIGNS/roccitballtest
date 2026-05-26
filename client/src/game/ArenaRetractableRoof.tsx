import { useFrame } from '@react-three/fiber';
import {
  CuboidCollider,
  interactionGroups,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ARENA } from '../shared/Constants';
import { arenaPillarTopWorldY } from './arenaPillarConfig';
import { goalEndFaceX } from './goals';
import { arenaRoofStore } from './arenaRoofStore';
import { burstRoofOpenSmoke, burstRoofSeamSmoke } from './pillarSmokePuffs';
import { arenaCeilingMaterial } from './arenaMaterials';
import { createMeterTiledBoxGeometry } from './arenaConcreteTexture';

const ROOF_COLLISION = interactionGroups(2, [0, 1, 2]);
/** Past walls/pillars so sky does not leak at corners (invisible overshoot) */
const ROOF_OVERSHOOT_X = 14;
const ROOF_OVERSHOOT_Z = 18;
/** Sit slightly below cap top — blocks edge light at wall joints */
const ROOF_LOWER_M = 1.1;

export function arenaRoofLayout() {
  const face = goalEndFaceX();
  const spanX = face * 2 - 1 + ROOF_OVERSHOOT_X * 2;
  const spanZ = ARENA.hexRadius * 1.82 + ROOF_OVERSHOOT_Z * 2;
  const halfZ = spanZ / 2;
  const thickness = 2.4;
  const pillarTopY = arenaPillarTopWorldY();
  const centerY = pillarTopY - ROOF_LOWER_M + thickness / 2;
  const separateM = halfZ * 0.95;
  return {
    spanX,
    halfZ,
    spanZ,
    thickness,
    centerY,
    separateM,
    closedNearZ: -halfZ / 2,
    closedFarZ: halfZ / 2,
  };
}

/**
 * Two roof slabs meeting at midfield (z = 0), full goal-to-goal span. Press R to slide
 * apart along ±Z over {@link ARENA.roofRetractSec}s so the opening runs red → blue.
 * Colliders stay mounted — kinematic translation only (avoids Rapier crash on toggle).
 */
export function ArenaRetractableRoof() {
  const nearBodyRef = useRef<RapierRigidBody>(null);
  const farBodyRef = useRef<RapierRigidBody>(null);
  const nearMeshRef = useRef<THREE.Group>(null);
  const farMeshRef = useRef<THREE.Group>(null);
  const roofSmokeRef = useRef({ prevOpen: 0, wasOpening: false });

  const layout = useMemo(() => arenaRoofLayout(), []);
  const panelGeo = useMemo(
    () =>
      createMeterTiledBoxGeometry(
        layout.spanX,
        layout.thickness,
        layout.halfZ,
      ),
    [layout.spanX, layout.thickness, layout.halfZ],
  );

  useFrame((_, dt) => {
    arenaRoofStore.step(dt);
    const { open, target } = arenaRoofStore.getState();
    const slide = layout.separateM * open;
    const nearZ = layout.closedNearZ - slide;
    const farZ = layout.closedFarZ + slide;
    const y = layout.centerY;
    const halfDepth = layout.halfZ / 2;
    const nearInnerZ = nearZ + halfDepth;
    const farInnerZ = farZ - halfDepth;
    const smokeY = y - layout.thickness * 0.38;

    const opening = target > 0.5 && open < 0.995;
    const openDelta = open - roofSmokeRef.current.prevOpen;
    if (opening && openDelta > 0.00015) {
      if (!roofSmokeRef.current.wasOpening && open < 0.08) {
        burstRoofOpenSmoke(nearInnerZ, farInnerZ, smokeY, layout.spanX);
      }
      const puffs = Math.min(
        22,
        Math.max(2, Math.round(openDelta * 520 + dt * 14)),
      );
      burstRoofSeamSmoke(nearInnerZ, farInnerZ, smokeY, layout.spanX, puffs);
      roofSmokeRef.current.wasOpening = true;
    } else if (target < 0.5) {
      roofSmokeRef.current.wasOpening = false;
    }
    roofSmokeRef.current.prevOpen = open;

    nearMeshRef.current?.position.set(0, y, nearZ);
    farMeshRef.current?.position.set(0, y, farZ);

    const nearBody = nearBodyRef.current;
    if (nearBody) {
      nearBody.setNextKinematicTranslation({ x: 0, y, z: nearZ });
    }
    const farBody = farBodyRef.current;
    if (farBody) {
      farBody.setNextKinematicTranslation({ x: 0, y, z: farZ });
    }
  });

  return (
    <>
      <group
        ref={nearMeshRef}
        position={[0, layout.centerY, layout.closedNearZ]}
      >
        <mesh
          geometry={panelGeo}
          material={arenaCeilingMaterial}
          castShadow={false}
          receiveShadow={false}
        />
      </group>
      <RigidBody
        ref={nearBodyRef}
        type="kinematicPosition"
        colliders={false}
        position={[0, layout.centerY, layout.closedNearZ]}
      >
        <CuboidCollider
          args={[layout.spanX / 2, layout.thickness / 2, layout.halfZ / 2]}
          friction={0.2}
          restitution={0.55}
          collisionGroups={ROOF_COLLISION}
        />
      </RigidBody>

      <group
        ref={farMeshRef}
        position={[0, layout.centerY, layout.closedFarZ]}
      >
        <mesh
          geometry={panelGeo}
          material={arenaCeilingMaterial}
          castShadow={false}
          receiveShadow={false}
        />
      </group>
      <RigidBody
        ref={farBodyRef}
        type="kinematicPosition"
        colliders={false}
        position={[0, layout.centerY, layout.closedFarZ]}
      >
        <CuboidCollider
          args={[layout.spanX / 2, layout.thickness / 2, layout.halfZ / 2]}
          friction={0.2}
          restitution={0.55}
          collisionGroups={ROOF_COLLISION}
        />
      </RigidBody>
    </>
  );
}
