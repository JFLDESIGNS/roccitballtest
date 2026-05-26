import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useRef } from 'react';
import * as THREE from 'three';
import { BotDroneVisual } from '../game/BotDroneVisual';
import type { Team } from '../shared/Types';

const HOVER_AMP = 0.42;
const HOVER_SPEED = 1.2;
/** In-menu scale (30% smaller than previous 1.05 × 1.4). */
const BOT_SCALE = 1.05 * 1.4 * 0.7;
/** Face camera, then 35° counter-clockwise (yaw only — no pitch). */
const MENU_BOT_YAW = Math.PI - (35 * Math.PI) / 180;

function MenuBotModel({ team }: { team: Team }) {
  const rootRef = useRef<THREE.Group>(null);
  const throttleRef = useRef(0.5);

  useFrame((state) => {
    const root = rootRef.current;
    if (!root) return;
    const t = state.clock.elapsedTime;
    root.position.y = Math.sin(t * HOVER_SPEED) * HOVER_AMP;
    root.rotation.x = 0;
    root.rotation.y = MENU_BOT_YAW + Math.sin(t * 0.45) * 0.06;
    throttleRef.current = 0.42 + Math.sin(t * Math.PI * 2) * 0.38;
  });

  return (
    <group ref={rootRef} scale={BOT_SCALE}>
      <BotDroneVisual team={team} throttleRef={throttleRef} />
    </group>
  );
}

/** Hovering practice bot for the main menu */
export function MenuBotPreview({ team = 'blue' }: { team?: Team }) {
  return (
    <div className="main-menu-bot-canvas" aria-hidden>
      <Canvas
        dpr={[1, 1.5]}
        gl={{
          alpha: true,
          antialias: true,
          premultipliedAlpha: true,
        }}
        camera={{ position: [0, 0.95, 4.65], fov: 40, near: 0.1, far: 40 }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 8, 5]} intensity={1.35} />
        <directionalLight position={[-3, 2, -2]} intensity={0.32} color="#88bbff" />
        <Suspense fallback={null}>
          <MenuBotModel team={team} />
        </Suspense>
      </Canvas>
    </div>
  );
}
