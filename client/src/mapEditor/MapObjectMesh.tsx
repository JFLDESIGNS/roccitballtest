import { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { MapLight, MapObject } from './mapEditorTypes';
import {
  ALPHA_SHADOW_RENDER_ORDER,
  createAlphaShadowMaterial,
} from './alphaShadowMaterial';
import { getMapObjectMaterial } from './mapEditorMaterials';
import { LightGlowBillboard, lightGlowSizeForRect } from './LightGlowBillboard';
import { initStadiumRectAreaLights } from '../game/stadiumRectAreaLightInit';
import { MAP_LIGHT_SHADOW_PROPS } from './mapLightDefaults';

type MapObjectMeshProps = {
  object: MapObject;
  selected?: boolean;
  onSelect?: () => void;
};

export function MapObjectMesh({ object, selected, onSelect }: MapObjectMeshProps) {
  const isAlphaShadow = object.kind === 'alphaShadow';

  const material = useMemo(
    () =>
      isAlphaShadow
        ? createAlphaShadowMaterial()
        : getMapObjectMaterial(object.textureId, object.color),
    [isAlphaShadow, object.textureId, object.color],
  );

  const geometry = useMemo(() => {
    switch (object.kind) {
      case 'sphere':
        return new THREE.SphereGeometry(0.5, 24, 16);
      case 'cylinder':
        return new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
      case 'plane':
      case 'alphaShadow':
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
      renderOrder={isAlphaShadow ? ALPHA_SHADOW_RENDER_ORDER : undefined}
      castShadow={!isAlphaShadow}
      receiveShadow={!isAlphaShadow}
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
  /** Editor sphere gizmo vs play-mode camera-facing glow plane */
  showBulb?: boolean;
};

function MapRectAreaLight({ light }: { light: MapLight }) {
  useLayoutEffect(() => {
    initStadiumRectAreaLights();
  }, []);

  return (
    <rectAreaLight
      color={light.color}
      intensity={light.intensity}
      width={light.rectWidth}
      height={light.rectHeight}
    />
  );
}

function MapLightContent({
  light,
  selected,
  onSelect,
  castShadow = false,
  showBulb = true,
}: Omit<MapLightNodeProps, 'embedded'>) {
  const bulbColor = selected ? '#ffee66' : light.color;

  return (
    <>
      {light.kind === 'point' && (
        <pointLight
          color={light.color}
          intensity={light.intensity}
          distance={light.distance}
          castShadow={castShadow}
          {...(castShadow ? MAP_LIGHT_SHADOW_PROPS : {})}
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
          {...(castShadow ? MAP_LIGHT_SHADOW_PROPS : {})}
        />
      )}
      {light.kind === 'directional' && (
        <directionalLight
          color={light.color}
          intensity={light.intensity}
          castShadow={castShadow}
          {...(castShadow
            ? {
                ...MAP_LIGHT_SHADOW_PROPS,
                'shadow-camera-far': 120,
                'shadow-camera-left': -60,
                'shadow-camera-right': 60,
                'shadow-camera-top': 60,
                'shadow-camera-bottom': -60,
              }
            : {})}
        />
      )}
      {light.kind === 'rectArea' && <MapRectAreaLight light={light} />}
      {showBulb ? (
        light.kind === 'rectArea' ? (
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.();
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelect?.();
            }}
          >
            <planeGeometry args={[light.rectWidth, light.rectHeight]} />
            <meshBasicMaterial
              color={bulbColor}
              wireframe
              transparent
              opacity={0.9}
              depthWrite={false}
            />
          </mesh>
        ) : (
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.();
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelect?.();
          }}
        >
          <sphereGeometry args={[0.35, 12, 12]} />
          <meshBasicMaterial
            color={bulbColor}
            transparent
            opacity={0.85}
          />
        </mesh>
        )
      ) : light.kind === 'rectArea' ? (
        <group
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.();
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelect?.();
          }}
        >
          <LightGlowBillboard
            color={light.color}
            size={lightGlowSizeForRect(light.rectWidth, light.rectHeight)}
          />
        </group>
      ) : (
        <group
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.();
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelect?.();
          }}
        >
          <LightGlowBillboard color={light.color} />
        </group>
      )}
    </>
  );
}

export function MapLightNode({
  light,
  selected,
  onSelect,
  embedded,
  castShadow = false,
  showBulb = true,
}: MapLightNodeProps) {
  if (embedded) {
    return (
      <MapLightContent
        light={light}
        selected={selected}
        onSelect={onSelect}
        castShadow={castShadow}
        showBulb={showBulb}
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
        showBulb={showBulb}
      />
    </group>
  );
}
