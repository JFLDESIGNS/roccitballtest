import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { graphicsStore } from './graphicsStore';
import { initStadiumRectAreaLights } from './stadiumRectAreaLightInit';
import {
  STADIUM_KEY_LIGHT_OMNI_RADIUS,
  STADIUM_KEY_LIGHT_PANEL,
  stadiumKeyLightGroundY,
  stadiumKeyLightWorldPosition,
  STADIUM_KEY_LIGHT_2,
  STADIUM_KEY_LIGHT_3,
} from './stadiumKeyLightLayout';

/** Map menu brightness (1–1000) to down-facing rect intensity */
export function keyLightRectIntensityFromMenu(
  brightness: number,
  arenaBrightness: number,
): number {
  return (brightness / 98) * (arenaBrightness ?? 1);
}

/** Map menu brightness (1–1000) to omni point intensity (+ shadows) */
export function keyLightPointIntensityFromMenu(
  brightness: number,
  arenaBrightness: number,
): number {
  return (brightness / 34) * (arenaBrightness ?? 1);
}

const POINT_SHADOW_PROPS = {
  'shadow-mapSize': [1024, 1024] as [number, number],
  'shadow-bias': -0.0003,
  'shadow-normalBias': 0.018,
} as const;

function RectOmniWireframe({
  position,
  panelW,
  panelH,
  omniRadius,
  groundY,
  color,
}: {
  position: THREE.Vector3;
  panelW: number;
  panelH: number;
  omniRadius: number;
  groundY: number;
  color: string;
}) {
  const panelGeo = useMemo(
    () => new THREE.PlaneGeometry(panelW, panelH),
    [panelW, panelH],
  );

  const dropLine = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.45,
    });
    const geo = new THREE.BufferGeometry().setFromPoints([
      position.clone(),
      new THREE.Vector3(position.x, groundY, position.z),
    ]);
    return new THREE.Line(geo, mat);
  }, [position, groundY, color]);

  const ringLine = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segs = 32;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push(
        new THREE.Vector3(
          position.x + Math.cos(a) * omniRadius,
          groundY + 0.04,
          position.z + Math.sin(a) * omniRadius,
        ),
      );
    }
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.35,
    });
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      mat,
    );
  }, [position, omniRadius, groundY, color]);

  return (
    <group renderOrder={200}>
      <primitive object={dropLine} renderOrder={200} />
      <primitive object={ringLine} renderOrder={200} />
      <mesh
        position={[position.x, position.y, position.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        geometry={panelGeo}
        renderOrder={201}
      >
        <meshBasicMaterial
          color={color}
          wireframe
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[position.x, position.y - 0.35, position.z]} renderOrder={201}>
        <sphereGeometry args={[0.55, 10, 8]} />
        <meshBasicMaterial color={color} wireframe />
      </mesh>
    </group>
  );
}

type InteriorKeyLightProps = {
  name: string;
  rectRef: RefObject<THREE.RectAreaLight | null>;
  pointRef: RefObject<THREE.PointLight | null>;
  position: THREE.Vector3;
  rectColor: THREE.Color;
  wireColor: string;
  readBrightness: () => number;
  readColor: () => string;
  readCastShadow: () => boolean;
  showWireframe: boolean;
};

function InteriorKeyLight({
  name,
  rectRef,
  pointRef,
  position,
  rectColor,
  wireColor,
  readBrightness,
  readColor,
  readCastShadow,
  showWireframe,
}: InteriorKeyLightProps) {
  const warm = useMemo(() => rectColor.clone(), [rectColor]);

  useLayoutEffect(() => {
    initStadiumRectAreaLights();
  }, []);

  useFrame(() => {
    const g = graphicsStore.getState();
    const b = g.arenaBrightness ?? 1;
    const bright = readBrightness();
    const col = readColor();

    const rect = rectRef.current;
    if (rect) {
      rect.intensity = keyLightRectIntensityFromMenu(bright, b);
      rect.color.set(col);
    }

    const point = pointRef.current;
    if (point) {
      point.intensity = keyLightPointIntensityFromMenu(bright, b);
      point.color.set(col);
      point.castShadow = readCastShadow();
    }
  });

  const groundY = stadiumKeyLightGroundY();

  return (
    <>
      <rectAreaLight
        ref={rectRef}
        name={`${name} rect`}
        position={position.toArray()}
        width={STADIUM_KEY_LIGHT_PANEL.width}
        height={STADIUM_KEY_LIGHT_PANEL.height}
        rotation={[-Math.PI / 2, 0, 0]}
        color={warm}
        intensity={keyLightRectIntensityFromMenu(
          readBrightness(),
          graphicsStore.getState().arenaBrightness ?? 1,
        )}
      />
      <pointLight
        ref={pointRef}
        name={`${name} omni`}
        position={position.toArray()}
        color={warm}
        intensity={keyLightPointIntensityFromMenu(
          readBrightness(),
          graphicsStore.getState().arenaBrightness ?? 1,
        )}
        distance={118}
        decay={1.05}
        castShadow={readCastShadow()}
        {...POINT_SHADOW_PROPS}
      />
      {showWireframe ? (
        <RectOmniWireframe
          position={position}
          panelW={STADIUM_KEY_LIGHT_PANEL.width}
          panelH={STADIUM_KEY_LIGHT_PANEL.height}
          omniRadius={STADIUM_KEY_LIGHT_OMNI_RADIUS}
          groundY={groundY}
          color={wireColor}
        />
      ) : null}
    </>
  );
}

/** Interior stadium Key 2 & Key 3 — rect wash + omni point (always on) */
export function ArenaStadiumKeyLights() {
  const gfx = useSyncExternalStore(
    graphicsStore.subscribe,
    graphicsStore.getState,
  );

  const rect2Ref = useRef<THREE.RectAreaLight>(null);
  const rect3Ref = useRef<THREE.RectAreaLight>(null);
  const point2Ref = useRef<THREE.PointLight>(null);
  const point3Ref = useRef<THREE.PointLight>(null);

  const pos2 = useMemo(() => stadiumKeyLightWorldPosition(STADIUM_KEY_LIGHT_2), []);
  const pos3 = useMemo(() => stadiumKeyLightWorldPosition(STADIUM_KEY_LIGHT_3), []);

  const key2Color = useMemo(
    () => new THREE.Color(gfx.keyLight2Color),
    [gfx.keyLight2Color],
  );
  const key3Color = useMemo(
    () => new THREE.Color(gfx.keyLight3Color),
    [gfx.keyLight3Color],
  );

  const castShadow2 = () => {
    const g = graphicsStore.getState();
    return g.shadows && g.keyLight2CastShadow;
  };
  const castShadow3 = () => {
    const g = graphicsStore.getState();
    return g.shadows && g.keyLight3CastShadow;
  };

  return (
    <>
      <InteriorKeyLight
        name="Key 2"
        rectRef={rect2Ref}
        pointRef={point2Ref}
        position={pos2}
        rectColor={key2Color}
        wireColor="#ffb86a"
        readBrightness={() => graphicsStore.getState().keyLight2Brightness}
        readColor={() => graphicsStore.getState().keyLight2Color}
        readCastShadow={castShadow2}
        showWireframe={gfx.keyLightWireframe ?? true}
      />
      <InteriorKeyLight
        name="Key 3"
        rectRef={rect3Ref}
        pointRef={point3Ref}
        position={pos3}
        rectColor={key3Color}
        wireColor="#8ec8ff"
        readBrightness={() => graphicsStore.getState().keyLight3Brightness}
        readColor={() => graphicsStore.getState().keyLight3Color}
        readCastShadow={castShadow3}
        showWireframe={gfx.keyLightWireframe ?? true}
      />
    </>
  );
}
