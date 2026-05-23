import { RENDER } from '../shared/Constants';

const span = RENDER.shadowCameraSpan;

function SunLight() {
  if (!RENDER.enableShadows) {
    return (
      <directionalLight
        position={[38, 62, 24]}
        intensity={1.55}
        color="#fff6e8"
      />
    );
  }
  return (
    <directionalLight
      position={[38, 62, 24]}
      intensity={1.55}
      color="#fff6e8"
      castShadow
      shadow-mapSize={[RENDER.shadowMapSize, RENDER.shadowMapSize]}
      shadow-camera-left={-span}
      shadow-camera-right={span}
      shadow-camera-top={span}
      shadow-camera-bottom={-span}
      shadow-camera-near={4}
      shadow-camera-far={RENDER.shadowCameraFar}
      shadow-bias={-0.00018}
      shadow-normalBias={0.018}
      shadow-radius={RENDER.shadowRadius}
    />
  );
}

export function ArenaLighting() {
  return (
    <>
      <hemisphereLight args={['#b8d4f8', '#3a4558', 0.72]} />
      <ambientLight intensity={0.28} color="#dce4f4" />
      <SunLight />
      <directionalLight position={[-32, 26, -26]} intensity={0.28} color="#7a9acc" />
    </>
  );
}
