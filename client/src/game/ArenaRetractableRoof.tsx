import { useFrame } from '@react-three/fiber';
import { CuboidCollider, interactionGroups, RigidBody } from '@react-three/rapier';
import { useMemo, useSyncExternalStore } from 'react';
import { ARENA } from '../shared/Constants';
import { goalEndFaceX } from './goals';
import { arenaRoofStore } from './arenaRoofStore';
import { arenaCeilingMaterial } from './arenaMaterials';
import { createMeterTiledBoxGeometry } from './arenaConcreteTexture';

const ROOF_COLLISION = interactionGroups(2, [0, 1, 2]);

export function arenaRoofLayout() {
  const face = goalEndFaceX();
  const spanX = face * 2 - 1;
  const halfW = spanX / 2;
  const spanZ = ARENA.hexRadius * 1.82;
  const thickness = 2.4;
  const ceilingY = ARENA.wallHeight + ARENA.ceilingOverlapM;
  const centerY = ceilingY - thickness / 2;
  const separateM = halfW * 0.95;
  return {
    halfW,
    spanZ,
    thickness,
    centerY,
    separateM,
    closedLeftX: -halfW / 2,
    closedRightX: halfW / 2,
  };
}

/**
 * Two roof slabs meeting at the goal center line (x = 0). Press R to slide apart over
 * {@link ARENA.roofRetractSec}s and reveal the sky.
 */
export function ArenaRetractableRoof() {
  const open = useSyncExternalStore(
    arenaRoofStore.subscribe,
    () => arenaRoofStore.getState().open,
  );

  const layout = useMemo(() => arenaRoofLayout(), []);
  const leftGeo = useMemo(
    () => createMeterTiledBoxGeometry(layout.halfW, layout.thickness, layout.spanZ),
    [layout.halfW, layout.thickness, layout.spanZ],
  );
  const rightGeo = useMemo(
    () => createMeterTiledBoxGeometry(layout.halfW, layout.thickness, layout.spanZ),
    [layout.halfW, layout.thickness, layout.spanZ],
  );

  useFrame((_, dt) => {
    arenaRoofStore.step(dt);
  });

  const slide = layout.separateM * open;
  const leftX = layout.closedLeftX - slide;
  const rightX = layout.closedRightX + slide;
  const collidersOn = open < 0.12;

  return (
    <group>
      <group position={[leftX, layout.centerY, 0]}>
        {collidersOn && (
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider
              args={[layout.halfW / 2, layout.thickness / 2, layout.spanZ / 2]}
              friction={0.2}
              restitution={0.55}
              collisionGroups={ROOF_COLLISION}
            />
          </RigidBody>
        )}
        <mesh
          geometry={leftGeo}
          material={arenaCeilingMaterial}
          castShadow={false}
          receiveShadow
        />
      </group>

      <group position={[rightX, layout.centerY, 0]}>
        {collidersOn && (
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider
              args={[layout.halfW / 2, layout.thickness / 2, layout.spanZ / 2]}
              friction={0.2}
              restitution={0.55}
              collisionGroups={ROOF_COLLISION}
            />
          </RigidBody>
        )}
        <mesh
          geometry={rightGeo}
          material={arenaCeilingMaterial}
          castShadow={false}
          receiveShadow
        />
      </group>
    </group>
  );
}
