import { memo, useMemo } from 'react';
import * as THREE from 'three';
import { ARENA } from '../shared/Constants';
import { buildHexWallSegments, createHexShape } from '../game/arenaHex';
import { arenaHexFloorMaterial, arenaWallMaterial } from '../game/arenaMaterials';

/** Static arena visuals for the map editor — no Rapier / colliders. */
export const EditorArenaBackdrop = memo(function EditorArenaBackdrop() {
  const { hexRadius, wallHeight, wallThickness } = ARENA;

  const floorGeo = useMemo(() => {
    const geo = new THREE.ShapeGeometry(createHexShape(hexRadius));
    geo.rotateX(-Math.PI / 2);
    geo.scale(1, 1, -1);
    geo.computeVertexNormals();
    return geo;
  }, [hexRadius]);

  const wallSegments = useMemo(
    () => buildHexWallSegments(hexRadius, wallThickness),
    [hexRadius, wallThickness],
  );

  return (
    <>
      <hemisphereLight args={['#c8daf0', '#5a6878', 0.85]} />
      <ambientLight intensity={0.42} color="#eef2fa" />
      <directionalLight position={[36, 58, 22]} intensity={1.35} color="#fff4e6" />

      <mesh geometry={floorGeo} receiveShadow material={arenaHexFloorMaterial} />

      {wallSegments.map((w, i) => (
        <mesh
          key={i}
          position={[w.x, w.y, w.z]}
          rotation={[0, w.yaw, 0]}
          castShadow
          receiveShadow
          material={arenaWallMaterial}
        >
          <boxGeometry args={[w.length, wallHeight, wallThickness]} />
        </mesh>
      ))}
    </>
  );
});
