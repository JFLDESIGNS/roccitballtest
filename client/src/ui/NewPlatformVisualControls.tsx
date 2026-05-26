import { useState, useSyncExternalStore } from 'react';
import {
  formatNewPlatformVisualForCopy,
  newPlatformVisualStore,
} from '../game/newPlatformVisualStore';

type NewPlatformVisualControlsProps = {
  /** main-menu | map-editor | tuning */
  variant?: 'main-menu' | 'map-editor' | 'tuning';
};

function NumField({
  label,
  value,
  step,
  min,
  max,
  onChange,
  className = 'menu-field',
}: {
  label: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <label className={className}>
      <span>{label}</span>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={Number(value.toFixed(4))}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function NewPlatformVisualControls({
  variant = 'main-menu',
}: NewPlatformVisualControlsProps) {
  const tune = useSyncExternalStore(
    newPlatformVisualStore.subscribe,
    newPlatformVisualStore.getState,
  );
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const copyValues = async () => {
    const text = formatNewPlatformVisualForCopy();
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg('Copied');
    } catch {
      setCopyMsg('Select & copy below');
    }
    window.setTimeout(() => setCopyMsg(null), 2200);
  };

  const fields = (
    <>
      <NumField
        label="Lower (ft)"
        value={tune.offsetLowerFt}
        step={0.25}
        min={-20}
        max={30}
        onChange={newPlatformVisualStore.setOffsetLowerFt}
        className={
          variant === 'map-editor' ? 'map-editor-field' : 'menu-field'
        }
      />
      <NumField
        label="Scale"
        value={tune.uniformScale}
        step={0.05}
        min={0.25}
        max={3}
        onChange={newPlatformVisualStore.setUniformScale}
        className={
          variant === 'map-editor' ? 'map-editor-field' : 'menu-field'
        }
      />
      <div
        className={
          variant === 'map-editor'
            ? 'map-editor-scale-row'
            : 'main-menu-platform-rot-row'
        }
      >
        <NumField
          label="Rot X°"
          value={tune.rotXDeg}
          step={1}
          min={-180}
          max={180}
          onChange={newPlatformVisualStore.setRotXDeg}
          className={
            variant === 'map-editor'
              ? 'map-editor-field map-editor-field--compact'
              : 'menu-field menu-field--compact'
          }
        />
        <NumField
          label="Rot Y°"
          value={tune.rotYDeg}
          step={1}
          min={-180}
          max={180}
          onChange={newPlatformVisualStore.setRotYDeg}
          className={
            variant === 'map-editor'
              ? 'map-editor-field map-editor-field--compact'
              : 'menu-field menu-field--compact'
          }
        />
        <NumField
          label="Rot Z°"
          value={tune.rotZDeg}
          step={1}
          min={-180}
          max={180}
          onChange={newPlatformVisualStore.setRotZDeg}
          className={
            variant === 'map-editor'
              ? 'map-editor-field map-editor-field--compact'
              : 'menu-field menu-field--compact'
          }
        />
      </div>
    </>
  );

  const actions = (
    <div
      className={
        variant === 'map-editor' ? 'map-editor-btn-row' : 'main-menu-platform-tune-actions'
      }
    >
      <button
        type="button"
        className={variant === 'map-editor' ? 'map-editor-btn' : 'btn-secondary'}
        onClick={() => void copyValues()}
      >
        Copy values
      </button>
      <button
        type="button"
        className={variant === 'map-editor' ? 'map-editor-btn' : 'btn-secondary'}
        onClick={() => newPlatformVisualStore.reset()}
      >
        Reset
      </button>
      {copyMsg ? (
        <span
          className={
            variant === 'map-editor' ? 'map-editor-muted' : 'menu-platform-tune-status'
          }
        >
          {copyMsg}
        </span>
      ) : null}
    </div>
  );

  const hint = (
    <p
      className={
        variant === 'map-editor'
          ? 'map-editor-muted'
          : variant === 'tuning'
            ? 'tuning-sub'
            : 'menu-platform-tune-hint'
      }
    >
      New platform mesh only (all octagon decks). Physics stays on the old ramp
      shape. Play or open Map Editor to preview — then copy values for the
      agent.
    </p>
  );

  if (variant === 'tuning') {
    return (
      <>
        <h3 className="tuning-section">Platform mesh (FBX)</h3>
        {hint}
        {fields}
        {actions}
        <pre className="menu-platform-tune-dump" aria-label="Current values">
          {formatNewPlatformVisualForCopy()}
        </pre>
      </>
    );
  }

  if (variant === 'map-editor') {
    return (
      <section>
        <h3>Platform mesh</h3>
        {hint}
        {fields}
        {actions}
        <pre className="map-editor-code-block">{formatNewPlatformVisualForCopy()}</pre>
      </section>
    );
  }

  return (
    <div className="main-menu-platform-tune">
      <h4 className="menu-section-title">Platform mesh</h4>
      {hint}
      {fields}
      {actions}
    </div>
  );
}
