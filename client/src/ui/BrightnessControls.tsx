import { useSyncExternalStore } from 'react';
import { graphicsStore } from '../game/graphicsStore';
import { MAP_LIGHT_GLOW_BLEND_OPTIONS } from '../game/mapLightGlowBlend';
import {
  MAP_LIGHT_GLOW_PROXIMITY_FADE_FT,
  MAP_LIGHT_GLOW_PROXIMITY_FADE_FT_MAX,
  MAP_LIGHT_GLOW_PROXIMITY_FADE_FT_MIN,
} from '../game/mapLightGlowSettings';
import {
  getLightGlowProximityDebug,
  subscribeLightGlowProximityDebug,
} from '../game/lightGlowProximityDebug';
import { GfxColorInput, GfxSelect, GfxSlider, GfxToggle } from './gfxMenuFields';

/** Stadium ceiling strips + scene exposure — press 1, Brightness tab */
export function BrightnessControls({ compact }: { compact?: boolean }) {
  const gfx = useSyncExternalStore(
    graphicsStore.subscribe,
    graphicsStore.getState,
  );
  const glowDebug = useSyncExternalStore(
    subscribeLightGlowProximityDebug,
    getLightGlowProximityDebug,
  );

  return (
    <div
      className={
        compact
          ? 'graphics-controls graphics-controls--compact brightness-controls'
          : 'graphics-controls brightness-controls'
      }
    >
      {!compact ? <h3 className="menu-section-title">Brightness</h3> : null}
      <p className="tuning-sub">
        Key 2 &amp; Key 3 use a wide down-facing rect panel plus an omni point
        at each ceiling mount (always on). Orange/blue wireframes show the rect
        and omni reach. Global Shadows must be on for point-light shadows.
      </p>

      <GfxToggle
        label="Show key light wireframes"
        checked={gfx.keyLightWireframe ?? true}
        onChange={graphicsStore.setKeyLightWireframe}
      />

      <h4 className="menu-section-title">Key 2 (interior)</h4>
      <GfxColorInput
        label="Key 2 color"
        value={gfx.keyLight2Color ?? '#fff0e0'}
        onChange={graphicsStore.setKeyLight2Color}
      />
      <GfxSlider
        label="Key 2 brightness"
        value={gfx.keyLight2Brightness ?? 280}
        min={1}
        max={1000}
        step={1}
        onChange={graphicsStore.setKeyLight2Brightness}
        format={(v) => String(Math.round(v))}
      />
      <GfxToggle
        label="Key 2 omni shadow"
        checked={gfx.keyLight2CastShadow ?? false}
        onChange={graphicsStore.setKeyLight2CastShadow}
      />

      <h4 className="menu-section-title">Key 3 (interior)</h4>
      <GfxColorInput
        label="Key 3 color"
        value={gfx.keyLight3Color ?? '#dfe8f5'}
        onChange={graphicsStore.setKeyLight3Color}
      />
      <GfxSlider
        label="Key 3 brightness"
        value={gfx.keyLight3Brightness ?? 240}
        min={1}
        max={1000}
        step={1}
        onChange={graphicsStore.setKeyLight3Brightness}
        format={(v) => String(Math.round(v))}
      />
      <GfxToggle
        label="Key 3 omni shadow"
        checked={gfx.keyLight3CastShadow ?? false}
        onChange={graphicsStore.setKeyLight3CastShadow}
      />

      <h4 className="menu-section-title">Ceiling strips (roof open)</h4>
      <GfxSlider
        label="Strip brightness"
        value={gfx.stadiumStripLightIntensity ?? 6}
        min={0}
        max={24}
        step={0.25}
        onChange={graphicsStore.setStadiumStripLightIntensity}
      />
      <GfxSlider
        label="Strip gap (midfield)"
        value={gfx.stadiumStripGapFt ?? 34}
        min={8}
        max={80}
        step={1}
        onChange={graphicsStore.setStadiumStripGapFt}
        format={(v) => `${Math.round(v)} ft`}
      />
      <GfxSlider
        label="Strip plane width"
        value={gfx.stadiumStripPlaneWidthFt ?? 150}
        min={24}
        max={220}
        step={2}
        onChange={graphicsStore.setStadiumStripPlaneWidthFt}
        format={(v) => `${Math.round(v)} ft`}
      />

      <h4 className="menu-section-title">Scene</h4>
      <GfxSlider
        label="Arena brightness"
        value={gfx.arenaBrightness ?? 1}
        min={0.25}
        max={2}
        step={0.05}
        onChange={graphicsStore.setArenaBrightness}
        format={(v) => `${Math.round(v * 100)}%`}
      />
      <GfxSlider
        label="Exposure"
        value={gfx.exposure}
        min={0.35}
        max={2}
        step={0.05}
        onChange={graphicsStore.setExposure}
      />

      <h4 className="menu-section-title">Map light glow (custom maps)</h4>
      <p className="tuning-sub">
        Soft radial halos on placed point, spot, and rect lights in play mode
        (not the editor bulb mesh). Fade uses your distance to the glow edge,
        not the light center — walk into the bright blob to test.
      </p>
      <GfxSlider
        label="Glow opacity"
        value={gfx.mapLightGlowOpacity ?? 0.3}
        min={0.02}
        max={1}
        step={0.02}
        onChange={graphicsStore.setMapLightGlowOpacity}
        format={(v) => `${Math.round(v * 100)}%`}
      />
      <GfxSlider
        label="Glow size"
        value={gfx.mapLightGlowSizeScale ?? 1}
        min={0.25}
        max={2.5}
        step={0.05}
        onChange={graphicsStore.setMapLightGlowSizeScale}
        format={(v) => `${Math.round(v * 100)}%`}
      />
      <GfxSelect
        label="Glow blend mode"
        value={gfx.mapLightGlowBlendMode ?? 'normal'}
        options={MAP_LIGHT_GLOW_BLEND_OPTIONS.map((o) => ({
          id: o.id,
          label: o.label,
        }))}
        onChange={graphicsStore.setMapLightGlowBlendMode}
        hint={
          MAP_LIGHT_GLOW_BLEND_OPTIONS.find(
            (o) => o.id === (gfx.mapLightGlowBlendMode ?? 'normal'),
          )?.hint
        }
      />
      <GfxSlider
        label="Proximity fade edge (ft)"
        value={gfx.mapLightGlowProximityFadeFt ?? MAP_LIGHT_GLOW_PROXIMITY_FADE_FT}
        min={MAP_LIGHT_GLOW_PROXIMITY_FADE_FT_MIN}
        max={MAP_LIGHT_GLOW_PROXIMITY_FADE_FT_MAX}
        step={1}
        onChange={graphicsStore.setMapLightGlowProximityFadeFt}
        format={(v) => `${Math.round(v)} ft`}
      />
      <GfxToggle
        label="Show proximity debug (nearest glow)"
        checked={gfx.mapLightGlowProximityDebug ?? false}
        onChange={graphicsStore.setMapLightGlowProximityDebug}
      />
      {gfx.mapLightGlowProximityDebug ? (
        <p className="tuning-sub tuning-sub--debug">
          Nearest glow edge:{' '}
          <strong>
            {glowDebug.distFt >= 900
              ? '— (enter match / custom map with lights)'
              : `${glowDebug.distFt.toFixed(1)} ft`}
          </strong>
          {' · '}
          fade {Math.round(glowDebug.opacityFactor * 100)}% · applied{' '}
          {Math.round(glowDebug.appliedOpacity * 100)}%
          {glowDebug.listenerUsesPlayer ? ' · player' : ' · camera'}
        </p>
      ) : null}

      <h4 className="menu-section-title">Highlights</h4>
      <GfxToggle
        label="Bloom glow"
        checked={gfx.bloom}
        onChange={graphicsStore.setBloom}
      />
      {gfx.bloom ? (
        <GfxSlider
          label="Bloom strength"
          value={gfx.bloomIntensity}
          min={0}
          max={1.5}
          step={0.05}
          onChange={graphicsStore.setBloomIntensity}
        />
      ) : null}

      <button
        type="button"
        className="btn-secondary menu-graphics-reset"
        onClick={() => graphicsStore.resetBrightnessDefaults()}
      >
        Reset brightness
      </button>
    </div>
  );
}
