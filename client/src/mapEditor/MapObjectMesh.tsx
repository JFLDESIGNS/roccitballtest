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
import {
  editorDisabledRaycast,
  editorPickCallback,
  editorPickRaycast,
} from './editorPick';

type MapObjectMeshProps = {
  object: MapObject;
  selected?: boolean;
  /** When false (e.g. while gizmo is active), mesh cannot be re-picked. */
  pickEnabled?: boolean;
  onSelect?: () => void;
};

export function MapObjectMesh({
  object,
  selected,
  pickEnabled = true,
  onSelect,
}: MapObjectMeshProps) {
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
      raycast={editorPickRaycast(pickEnabled)}
      onClick={onSelect ? editorPickCallback(onSelect) : undefined}
      onPointerDown={onSelect ? editorPickCallback(onSelect) : undefined}
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
  pickEnabled?: boolean;
  onSelect?: () => void;
  /** When true, render at group origin (parent supplies transform). */
  embedded?: boolean;
  castShadow?: boolean;
  /** Wireframe pick gizmo at the lamp */
  showBulb?: boolean;
  /** Camera-facing glow blob (play + editor preview) */
  showGlow?: boolean;
  /** Full-opacity glow in editor (no player proximity fade) */
  editorGlowPreview?: boolean;
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
  pickEnabled = true,
  onSelect,
  castShadow = false,
  showBulb = true,
  showGlow = true,
  editorGlowPreview = false,
}: Omit<MapLightNodeProps, 'embedded'>) {
  const bulbColor = selected ? '#ffee66' : light.color;
  const pick = pickEnabled && onSelect ? editorPickCallback(onSelect) : undefined;
  const raycast = editorPickRaycast(Boolean(pickEnabled && onSelect));

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
      {showGlow ? (
        <group
          raycast={showBulb ? editorDisabledRaycast : raycast}
          onClick={showBulb ? undefined : pick}
          onPointerDown={showBulb ? undefined : pick}
        >
          {light.kind === 'rectArea' ? (
            <LightGlowBillboard
              color={light.color}
              size={lightGlowSizeForRect(light.rectWidth, light.rectHeight)}
              editorPreview={editorGlowPreview}
            />
          ) : (
            <LightGlowBillboard
              color={light.color}
              editorPreview={editorGlowPreview}
            />
          )}
        </group>
      ) : null}
      {showBulb ? (
        light.kind === 'rectArea' ? (
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            raycast={raycast}
            onClick={pick}
            onPointerDown={pick}
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
            raycast={raycast}
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
      ) : null}
    </>
  );
}

export function MapLightNode({
  light,
  selected,
  pickEnabled = true,
  onSelect,
  embedded,
  castShadow = false,
  showBulb = true,
  showGlow = true,
  editorGlowPreview = false,
}: MapLightNodeProps) {
  if (embedded) {
    return (
      <MapLightContent
        light={light}
        selected={selected}
        pickEnabled={pickEnabled}
        onSelect={onSelect}
        castShadow={castShadow}
        showBulb={showBulb}
        showGlow={showGlow}
        editorGlowPreview={editorGlowPreview}
      />
    );
  }
  const pick = pickEnabled && onSelect ? editorPickCallback(onSelect) : undefined;
  return (
    <group
      position={light.position}
      rotation={light.rotation}
      raycast={editorPickRaycast(pickEnabled)}
      onClick={pick}
      onPointerDown={pick}
    >
      <MapLightContent
        light={light}
        selected={selected}
        pickEnabled={pickEnabled}
        onSelect={onSelect}
        castShadow={castShadow}
        showBulb={showBulb}
        showGlow={showGlow}
        editorGlowPreview={editorGlowPreview}
      />
    </group>
  );
}
