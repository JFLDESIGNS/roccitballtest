/** Proximity fade edge — feet beyond the lamp core before glow reaches full strength. */
export const MAP_LIGHT_GLOW_PROXIMITY_FADE_FT = 80;

export const MAP_LIGHT_GLOW_PROXIMITY_FADE_FT_MIN = 6;
export const MAP_LIGHT_GLOW_PROXIMITY_FADE_FT_MAX = 160;

/**
 * Only inside this horizontal radius (ft) of the lamp center does glow fade toward zero.
 * Must stay small — do not tie to billboard diameter or blobs vanish across the whole halo.
 */
export const MAP_LIGHT_GLOW_ZERO_CORE_FT = 5;

/** UV scale for alpha hole noise — lower = bigger transparent punches */
export const MAP_LIGHT_GLOW_NOISE_SCALE = 2.1;
/** How much B&W noise cuts alpha (0 = smooth disk, 1 = full hole mask) */
export const MAP_LIGHT_GLOW_ALPHA_HOLE_STRENGTH = 0.72;
/** Noise below this → more transparent (0–1) */
export const MAP_LIGHT_GLOW_ALPHA_HOLE_CUTOFF = 0.5;
/** Softness of hole edges (wider = softer holes) */
export const MAP_LIGHT_GLOW_ALPHA_HOLE_SOFT = 0.24;
/** Fade alpha from floor Y over this height (m) — hides ground seam */
export const MAP_LIGHT_GLOW_GROUND_FADE_M = 2.4;

/** Distance where glow billboards start to shimmer/distort (full strength at lamp). */
export const MAP_LIGHT_GLOW_WOBBLE_RADIUS_FT = 30;
/** Peak shader distortion strength at the lamp core (smoke warp + ripple). */
export const MAP_LIGHT_GLOW_WOBBLE_STRENGTH = 1.35;
