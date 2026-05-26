import { useSyncExternalStore } from 'react';
import { MapLightNode, MapObjectMesh } from './MapObjectMesh';
import { mapRegistryStore } from './mapEditorStore';
import { StadiumGroupLayer } from './StadiumGroupLayer';

function GroupedObject({ object }: { object: Parameters<typeof MapObjectMesh>[0]['object'] }) {
  const meshData = {
    ...object,
    position: [0, 0, 0] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    scale: [1, 1, 1] as [number, number, number],
  };
  return (
    <group position={object.position} rotation={object.rotation} scale={object.scale}>
      <MapObjectMesh object={meshData} />
    </group>
  );
}

/** Custom map props layered on top of the default arena during play. */
export function CustomMapOverlay() {
  const doc = useSyncExternalStore(
    mapRegistryStore.subscribe,
    () => mapRegistryStore.getActiveMapDocument(),
  );

  if (!doc) return null;

  const rootObjects = doc.objects.filter((o) => !o.groupId);
  const groupedObjects = doc.groups
    .filter((g) => !g.stadiumKey)
    .map((group) => ({
      group,
      objects: doc.objects.filter((o) => o.groupId === group.id),
    }));

  return (
    <>
      <StadiumGroupLayer groups={doc.groups} />
      {groupedObjects.map(({ group, objects }) => (
        <group
          key={group.id}
          position={group.position}
          rotation={group.rotation}
          scale={group.scale}
        >
          {objects.map((obj) => (
            <GroupedObject key={obj.id} object={obj} />
          ))}
        </group>
      ))}
      {rootObjects.map((obj) => (
        <MapObjectMesh key={obj.id} object={obj} />
      ))}
      {doc.lights.map((light) => (
        <MapLightNode
          key={light.id}
          light={light}
          showBulb={false}
          castShadow={light.castShadow}
        />
      ))}
    </>
  );
}
