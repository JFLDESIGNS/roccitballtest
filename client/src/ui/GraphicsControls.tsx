import { useSyncExternalStore } from 'react';
import { graphicsStore } from '../game/graphicsStore';
import { SHADOW_MAP_TYPE_OPTIONS } from '../game/shadowMapType';
import { GfxSelect, GfxSlider, GfxToggle } from './gfxMenuFields';

/** Visual effects — brightness lives in the Brightness tab (press 1) */
export function GraphicsControls({ compact }: { compact?: boolean }) {
  const gfx = useSyncExternalStore(
    graphicsStore.subscribe,
    graphicsStore.getState,
  );

  return (
    <div className={compact ? 'graphics-controls graphics-controls--compact' : 'graphics-controls'}>
      {!compact ? <h3 className="menu-section-title">Graphics</h3> : null}
      <p className="tuning-sub">
        Shadows, fog, and post effects. Ceiling strip lights are on the{' '}
        <strong>Brightness</strong> tab.
      </p>
      <GfxToggle
        label="Shadows"
        checked={gfx.shadows}
        onChange={graphicsStore.setShadows}
      />
      {gfx.shadows ? (
        <GfxSelect
          label="Shadow type"
          value={gfx.shadowMapType}
          options={SHADOW_MAP_TYPE_OPTIONS.map((o) => ({
            id: o.id,
            label: o.label,
          }))}
          onChange={graphicsStore.setShadowMapType}
          hint={
            SHADOW_MAP_TYPE_OPTIONS.find((o) => o.id === gfx.shadowMapType)?.hint
          }
        />
      ) : null}
      <GfxToggle
        label="Ambient occlusion"
        checked={gfx.ao ?? true}
        onChange={graphicsStore.setAo}
      />
      {gfx.ao !== false ? (
        <>
          <GfxSlider
            label="AO strength"
            value={gfx.aoIntensity ?? 1.15}
            min={0}
            max={2.5}
            step={0.05}
            onChange={graphicsStore.setAoIntensity}
          />
          <GfxSlider
            label="AO size (radius)"
            value={gfx.aoRadius ?? 10}
            min={2}
            max={40}
            step={0.5}
            onChange={graphicsStore.setAoRadius}
            format={(v) => `${v.toFixed(1)} m`}
          />
          <GfxSlider
            label="AO distance falloff"
            value={gfx.aoDistanceFalloff ?? 0.8}
            min={0}
            max={1.5}
            step={0.05}
            onChange={graphicsStore.setAoDistanceFalloff}
          />
          <GfxSlider
            label="AO samples"
            value={gfx.aoSamples ?? 8}
            min={2}
            max={24}
            step={1}
            onChange={graphicsStore.setAoSamples}
            format={(v) => String(Math.round(v))}
          />
          <GfxSlider
            label="AO denoise radius"
            value={gfx.aoDenoiseRadius ?? 8}
            min={2}
            max={20}
            step={1}
            onChange={graphicsStore.setAoDenoiseRadius}
            format={(v) => String(Math.round(v))}
          />
          <GfxSlider
            label="AO denoise samples"
            value={gfx.aoDenoiseSamples ?? 3}
            min={1}
            max={12}
            step={1}
            onChange={graphicsStore.setAoDenoiseSamples}
            format={(v) => String(Math.round(v))}
          />
          <GfxSelect
            label="AO quality"
            value={gfx.aoQuality ?? 'performance'}
            options={[
              { id: 'performance' as const, label: 'Performance' },
              { id: 'low' as const, label: 'Low' },
              { id: 'medium' as const, label: 'Medium' },
              { id: 'high' as const, label: 'High' },
            ]}
            onChange={graphicsStore.setAoQuality}
          />
          <GfxToggle
            label="AO half resolution (faster)"
            checked={gfx.aoHalfRes ?? true}
            onChange={graphicsStore.setAoHalfRes}
          />
        </>
      ) : null}
      <GfxToggle
        label="Arena fog"
        checked={gfx.fog}
        onChange={graphicsStore.setFog}
      />
      {gfx.fog ? (
        <GfxSlider
          label="Fog density"
          value={gfx.fogDensity}
          min={0.001}
          max={0.02}
          step={0.0005}
          onChange={graphicsStore.setFogDensity}
          format={(v) => v.toFixed(4)}
        />
      ) : null}
      <GfxToggle
        label="Atmosphere particles"
        checked={gfx.atmosphere}
        onChange={graphicsStore.setAtmosphere}
      />
      {gfx.atmosphere ? (
        <>
          <GfxSlider
            label="Particle count"
            value={gfx.particleCount}
            min={0}
            max={160}
            step={16}
            onChange={graphicsStore.setParticleCount}
            format={(v) => String(Math.round(v))}
          />
          <GfxSlider
            label="Particle size"
            value={gfx.particleSize}
            min={0.08}
            max={0.5}
            step={0.02}
            onChange={graphicsStore.setParticleSize}
          />
          <GfxSlider
            label="Particle brightness"
            value={gfx.particleOpacity}
            min={0.1}
            max={1}
            step={0.05}
            onChange={graphicsStore.setParticleOpacity}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </>
      ) : null}
      <GfxToggle
        label="Chromatic aberration"
        checked={gfx.chromaticAberration}
        onChange={graphicsStore.setChromaticAberration}
      />
      {gfx.chromaticAberration ? (
        <GfxSlider
          label="Chromatic strength"
          value={gfx.chromaticAberrationIntensity}
          min={0.05}
          max={1}
          step={0.05}
          onChange={graphicsStore.setChromaticAberrationIntensity}
          format={(v) => `${Math.round(v * 100)}%`}
        />
      ) : null}
      <GfxToggle
        label="Fisheye lens"
        checked={gfx.fisheye}
        onChange={graphicsStore.setFisheye}
      />
      {gfx.fisheye ? (
        <GfxSlider
          label="Fisheye strength"
          value={gfx.fisheyeIntensity}
          min={0.05}
          max={1}
          step={0.05}
          onChange={graphicsStore.setFisheyeIntensity}
          format={(v) => `${Math.round(v * 100)}%`}
        />
      ) : null}
      <GfxToggle
        label="Lens flare"
        checked={gfx.lensFlare}
        onChange={graphicsStore.setLensFlare}
      />
      {!compact ? (
        <button
          type="button"
          className="btn-secondary menu-graphics-reset"
          onClick={() => graphicsStore.resetDefaults()}
        >
          Reset graphics
        </button>
      ) : null}
    </div>
  );
}
