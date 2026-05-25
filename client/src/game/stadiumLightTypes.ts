export type StadiumLightKind = 'point' | 'spot' | 'directional' | 'rectArea';

/** Links rect + omni pairs — moving one moves all in the group */
export type StadiumLightLinkGroup = 'key2' | 'key3';

export type StadiumLightDef = {
  id: string;
  name: string;
  kind: StadiumLightKind;
  position: [number, number, number];
  rotation: [number, number, number];
  color: string;
  /** Base intensity before arena / roof / menu multipliers */
  intensity: number;
  distance?: number;
  decay?: number;
  angle?: number;
  penumbra?: number;
  castShadow: boolean;
  rectWidth?: number;
  rectHeight?: number;
  enabled: boolean;
  /** Scale intensity with roof open amount */
  roofGated?: boolean;
  /** Use brightness menu sliders from graphicsStore */
  brightnessMenuKey?: 'keyLight2' | 'keyLight3';
  /** Strip intensity uses stadiumStripLightIntensity slider */
  stripMenu?: boolean;
  linkGroup?: StadiumLightLinkGroup;
};

export type StadiumLightAddKind = StadiumLightKind;

export type StadiumLightGizmoMode = 'translate' | 'rotate' | 'scale';
