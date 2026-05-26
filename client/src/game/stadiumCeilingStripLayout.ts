import { ARENA } from '../shared/Constants';

const FT = 0.3048;

/** Ceiling strip point lights — height above platform deck (feet) */
export const STADIUM_CEILING_STRIP_HEIGHT_FT = 142;

export const STADIUM_CEILING_STRIP_LENGTH_M = ARENA.hexRadius * 2.45;

export function stadiumCeilingStripWorldY(): number {
  return ARENA.platformTopHeight + STADIUM_CEILING_STRIP_HEIGHT_FT * FT;
}
