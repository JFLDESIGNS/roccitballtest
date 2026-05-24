import { useSyncExternalStore } from 'react';
import { graphicsStore } from '../game/graphicsStore';

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
};

function GfxSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => v.toFixed(2),
}: SliderProps) {
  return (
    <label className="menu-field menu-field--range">
      <span>
        {label} <em className="menu-range-val">{format(value)}</em>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

function GfxToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="menu-option">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

/** Shared graphics settings block for main + tuning menus */
export function GraphicsControls({ compact }: { compact?: boolean }) {
  const gfx = useSyncExternalStore(
    graphicsStore.subscribe,
    graphicsStore.getState,
  );

  return (
    <div className={compact ? 'graphics-controls graphics-controls--compact' : 'graphics-controls'}>
      {!compact ? <h3 className="menu-section-title">Graphics</h3> : null}
      <GfxToggle
        label="Shadows"
        checked={gfx.shadows}
        onChange={graphicsStore.setShadows}
      />
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
      <GfxToggle
        label="Ambient occlusion"
        checked={gfx.ao ?? true}
        onChange={graphicsStore.setAo}
      />
      {gfx.ao !== false ? (
        <GfxSlider
          label="AO strength"
          value={gfx.aoIntensity ?? 1.15}
          min={0}
          max={2.5}
          step={0.05}
          onChange={graphicsStore.setAoIntensity}
        />
      ) : null}
      <GfxSlider
        label="Arena brightness"
        value={gfx.arenaBrightness ?? 1.35}
        min={0.5}
        max={2}
        step={0.05}
        onChange={graphicsStore.setArenaBrightness}
        format={(v) => `${Math.round(v * 100)}%`}
      />
      <GfxSlider
        label="Exposure"
        value={gfx.exposure}
        min={0.7}
        max={2}
        step={0.05}
        onChange={graphicsStore.setExposure}
      />
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
            max={80}
            step={20}
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
