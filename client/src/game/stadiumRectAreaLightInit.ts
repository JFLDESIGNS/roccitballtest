import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

let rectAreaLightUniformsReady = false;

/** Call during preload so opening the roof (R) does not hitch on first RectAreaLight shader compile */
export function initStadiumRectAreaLights(): void {
  if (rectAreaLightUniformsReady) return;
  RectAreaLightUniformsLib.init();
  rectAreaLightUniformsReady = true;
}

export function isStadiumRectAreaLightsReady(): boolean {
  return rectAreaLightUniformsReady;
}
