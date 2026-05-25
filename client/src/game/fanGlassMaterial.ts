import * as THREE from 'three';
import { ARENA_PADS } from '../shared/Constants';

const FAN_GLASS_GLSL = /* glsl */ `
float fanGlassEdge(vec2 uv) {
  vec2 vig = abs(uv - 0.5) * 2.0;
  return smoothstep(0.32, 0.98, max(vig.x, vig.y));
}
`;

/** Court-facing fan booth glass — darker rim vignette, clearer center */
export function createFanGlassMaterial(): THREE.MeshBasicMaterial {
  const baseOpacity = Math.min(
    0.5,
    ARENA_PADS.fanFacadeGlassOpacity * 1.42,
  );

  const mat = new THREE.MeshBasicMaterial({
    color: '#060a12',
    transparent: true,
    opacity: baseOpacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  mat.customProgramCacheKey = () => 'fan_glass_vignette_v2';

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCenterAlpha = { value: baseOpacity * 0.52 };
    shader.uniforms.uEdgeAlpha = { value: Math.min(0.58, baseOpacity * 1.35) };
    shader.uniforms.uEdgeDarken = { value: 0.72 };

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      varying vec2 vGlassUv;`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vGlassUv = uv;`,
    );

    shader.fragmentShader =
      FAN_GLASS_GLSL +
      shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
        varying vec2 vGlassUv;
        uniform float uCenterAlpha;
        uniform float uEdgeAlpha;
        uniform float uEdgeDarken;`,
      );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      {
        float edge = fanGlassEdge(vGlassUv);
        diffuseColor.a = mix(uCenterAlpha, uEdgeAlpha, edge);
        vec3 edgeTint = vec3(0.02, 0.03, 0.05);
        vec3 centerTint = vec3(0.05, 0.07, 0.11);
        diffuseColor.rgb = mix(centerTint, edgeTint, edge * uEdgeDarken);
      }`,
    );
  };

  return mat;
}
