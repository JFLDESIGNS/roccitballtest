import * as THREE from 'three';

export type ShadowMapTypeId = 'basic' | 'pcf' | 'pcfsoft' | 'vsm';

export const SHADOW_MAP_TYPE_OPTIONS: {
  id: ShadowMapTypeId;
  label: string;
  hint: string;
}[] = [
  {
    id: 'basic',
    label: 'Basic (hard edges, fastest)',
    hint: 'Crisp blocky shadows — lowest GPU cost',
  },
  {
    id: 'pcf',
    label: 'PCF (filtered)',
    hint: 'Softer edges — good default balance',
  },
  {
    id: 'pcfsoft',
    label: 'PCF soft (smooth)',
    hint: 'Smoothest penumbra — higher cost',
  },
  {
    id: 'vsm',
    label: 'VSM (blur)',
    hint: 'Very soft — can show light leaks on thin geometry',
  },
];

export function isShadowMapTypeId(v: string): v is ShadowMapTypeId {
  return SHADOW_MAP_TYPE_OPTIONS.some((o) => o.id === v);
}

export function shadowMapTypeToThree(id: ShadowMapTypeId): THREE.ShadowMapType {
  switch (id) {
    case 'pcf':
      return THREE.PCFShadowMap;
    case 'pcfsoft':
      return THREE.PCFSoftShadowMap;
    case 'vsm':
      return THREE.VSMShadowMap;
    default:
      return THREE.BasicShadowMap;
  }
}
