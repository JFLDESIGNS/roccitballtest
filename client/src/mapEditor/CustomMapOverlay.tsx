import { useSyncExternalStore } from 'react';
import { DEFAULT_MAP_ID } from './mapEditorTypes';
import { cloneDefaultArenaMapLights } from './defaultArenaMapLights';
import { MapLightNode, MapObjectMesh } from './MapObjectMesh';
import { mapRegistryStore } from './mapEditorStore';
import {
  getPlayModeStadiumGroups,
} from './stadiumLayout';
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
  const activeMapId = useSyncExternalStore(
    mapRegistryStore.subscribe,
    () => mapRegistryStore.getActiveMapId(),
  );
  const doc = useSyncExternalStore(
    mapRegistryStore.subscribe,
    () => mapRegistryStore.getActiveMapDocument(),
  );

  const isDefault = activeMapId === DEFAULT_MAP_ID;
  if (!doc && !isDefault) return null;

  const lights = doc?.lights ?? (isDefault ? cloneDefaultArenaMapLights() : []);
  const groups = getPlayModeStadiumGroups(doc);
  const objects = doc?.objects ?? [];

  const rootObjects = objects.filter((o) => !o.groupId);
  const groupedObjects = groups
    .filter((g) => !g.stadiumKey)
    .map((group) => ({
      group,
      objects: objects.filter((o) => o.groupId === group.id),
    }));

  return (
    <>
      <StadiumGroupLayer groups={groups} />
      {groupedObjects.map(({ group, objects: grouped }) => (
        <group
          key={group.id}
          position={group.position}
          rotation={group.rotation}
          scale={group.scale}
        >
          {grouped.map((obj) => (
            <GroupedObject key={obj.id} object={obj} />
          ))}
        </group>
      ))}
      {rootObjects.map((obj) => (
        <MapObjectMesh key={obj.id} object={obj} />
      ))}
      {lights.map((light) => (
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
