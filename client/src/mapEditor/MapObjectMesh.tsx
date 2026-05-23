import { useMemo } from 'react';
import * as THREE from 'three';
import type { MapLight, MapObject } from './mapEditorTypes';
import { getMapObjectMaterial } from './mapEditorMaterials';

type MapObjectMeshProps = {
  object: MapObject;
  selected?: boolean;
  onSelect?: () => void;
};

export function MapObjectMesh({ object, selected, onSelect }: MapObjectMeshProps) {
  const material = useMemo(
    () => getMapObjectMaterial(object.textureId, object.color),
    [object.textureId, object.color],
  );

  const geometry = useMemo(() => {
    switch (object.kind) {
      case 'sphere':
        return new THREE.SphereGeometry(0.5, 24, 16);
      case 'cylinder':
        return new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
      case 'plane':
        return new THREE.PlaneGeometry(1, 1);
      default:
        return new THREE.BoxGeometry(1, 1, 1);
    }
  }, [object.kind]);

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={object.position}
      rotation={object.rotation}
      scale={object.scale}
      castShadow
      receiveShadow
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      {selected && (
        <mesh scale={[1.08, 1.08, 1.08]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            color="#44ddff"
            wireframe
            transparent
            opacity={0.55}
            depthTest={false}
          />
        </mesh>
      )}
    </mesh>
  );
}

type MapLightNodeProps = {
  light: MapLight;
  selected?: boolean;
  onSelect?: () => void;
  /** When true, render at group origin (parent supplies transform). */
  embedded?: boolean;
  castShadow?: boolean;
};

function MapLightContent({
  light,
  selected,
  onSelect,
  castShadow = true,
}: Omit<MapLightNodeProps, 'embedded'>) {
  return (
    <>
      {light.kind === 'point' && (
        <pointLight
          color={light.color}
          intensity={light.intensity}
          distance={light.distance}
          castShadow={castShadow}
        />
      )}
      {light.kind === 'spot' && (
        <spotLight
          color={light.color}
          intensity={light.intensity}
          distance={light.distance}
          angle={light.angle}
          penumbra={light.penumbra}
          castShadow={castShadow}
        />
      )}
      {light.kind === 'directional' && (
        <directionalLight
          color={light.color}
          intensity={light.intensity}
          castShadow={castShadow}
        />
      )}
      <mesh onClick={(e) => { e.stopPropagation(); onSelect?.(); }} onPointerDown={(e) => { e.stopPropagation(); onSelect?.(); }}>
        <sphereGeometry args={[0.35, 12, 12]} />
        <meshBasicMaterial
          color={selected ? '#ffee66' : light.color}
          transparent
          opacity={0.85}
        />
      </mesh>
    </>
  );
}

export function MapLightNode({
  light,
  selected,
  onSelect,
  embedded,
  castShadow = true,
}: MapLightNodeProps) {
  if (embedded) {
    return (
      <MapLightContent
        light={light}
        selected={selected}
        onSelect={onSelect}
        castShadow={castShadow}
      />
    );
  }
  return (
    <group
      position={light.position}
      rotation={light.rotation}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      <MapLightContent
        light={light}
        selected={selected}
        onSelect={onSelect}
        castShadow={castShadow}
      />
    </group>
  );
}
