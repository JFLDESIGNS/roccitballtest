import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { gameStore } from './gameStore';
import { stadiumLightStore } from './stadiumLightStore';
import type {
  StadiumLightAddKind,
  StadiumLightDef,
  StadiumLightGizmoMode,
} from './stadiumLightTypes';

const ADD_KINDS: {
  id: StadiumLightAddKind;
  label: string;
  blurb: string;
}[] = [
  { id: 'point', label: 'Point', blurb: 'Omni — fills space evenly' },
  { id: 'spot', label: 'Spot', blurb: 'Cone — stage / key light' },
  {
    id: 'directional',
    label: 'Sun',
    blurb: 'Parallel rays — outdoor key',
  },
  {
    id: 'rectArea',
    label: 'Rect',
    blurb: 'Soft panel — ceiling wash',
  },
];

const GIZMO_MODES: { id: StadiumLightGizmoMode; label: string }[] = [
  { id: 'translate', label: 'Move' },
  { id: 'rotate', label: 'Rotate' },
  { id: 'scale', label: 'Scale' },
];

const RAD = 180 / Math.PI;
const toDeg = (r: number) => +(r * RAD).toFixed(2);
const toRad = (d: number) => (d * Math.PI) / 180;

function stopPanelKeys(e: ReactKeyboardEvent) {
  e.stopPropagation();
}

function EditableText({
  value,
  resetKey,
  disabled,
  onCommit,
}: {
  value: string;
  resetKey: string;
  disabled?: boolean;
  onCommit: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value, resetKey]);

  return (
    <input
      type="text"
      value={text}
      disabled={disabled}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        onCommit(text);
      }}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        stopPanelKeys(e);
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

function EditableNumber({
  value,
  resetKey,
  min,
  max,
  step,
  disabled,
  onCommit,
}: {
  value: number;
  resetKey: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onCommit: (n: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value, resetKey]);

  const commit = () => {
    const n = Number(text);
    if (Number.isFinite(n)) onCommit(n);
    else setText(String(value));
  };

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step ?? 0.1}
      value={text}
      disabled={disabled}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        commit();
      }}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        stopPanelKeys(e);
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

function Vec3Fields({
  title,
  values,
  resetKey,
  step,
  onCommit,
}: {
  title: string;
  values: [number, number, number];
  resetKey: string;
  step?: number;
  onCommit: (v: [number, number, number]) => void;
}) {
  const axes = ['X', 'Y', 'Z'] as const;
  const [draft, setDraft] = useState(values.map(String) as [string, string, string]);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) {
      setDraft(values.map(String) as [string, string, string]);
    }
  }, [values, resetKey]);

  const commitAxis = (index: number) => {
    const next = [...values] as [number, number, number];
    const n = Number(draft[index]);
    if (Number.isFinite(n)) next[index] = n;
    else setDraft(values.map(String) as [string, string, string]);
    onCommit(next);
  };

  return (
    <fieldset className="stadium-light-editor__fieldset">
      <legend>{title}</legend>
      <div className="stadium-light-editor__vec3">
        {axes.map((axis, i) => (
          <label key={axis} className="stadium-light-editor__vec3-axis">
            {axis}
            <input
              type="number"
              step={step ?? (title.includes('Rotation') ? 1 : 0.5)}
              value={draft[i]}
              onFocus={() => {
                focused.current = true;
              }}
              onBlur={() => {
                focused.current = false;
                commitAxis(i);
              }}
              onChange={(e) => {
                const next = [...draft] as [string, string, string];
                next[i] = e.target.value;
                setDraft(next);
              }}
              onKeyDown={(e) => {
                stopPanelKeys(e);
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SelectedLightFields({
  light,
  gizmoMode,
}: {
  light: StadiumLightDef;
  gizmoMode: StadiumLightGizmoMode;
}) {
  const menuLocked = !!light.brightnessMenuKey || !!light.stripMenu;
  const patch = (partial: Partial<StadiumLightDef>) =>
    stadiumLightStore.patchLight(light.id, partial);
  const fieldKey = light.id;

  return (
    <div className="stadium-light-editor__selected">
      <div className="stadium-light-editor__selected-head">
        <strong>{light.name}</strong>
        <span className="stadium-light-editor__kind">{light.kind}</span>
      </div>
      {menuLocked ? (
        <p className="stadium-light-editor__locked">
          Color / intensity follow graphics menu for this preset light.
        </p>
      ) : null}

      <div className="stadium-light-editor__gizmo-modes">
        {GIZMO_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={
              gizmoMode === m.id
                ? 'stadium-light-editor__gizmo-btn stadium-light-editor__gizmo-btn--on'
                : 'stadium-light-editor__gizmo-btn'
            }
            onClick={() => stadiumLightStore.setGizmoMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="stadium-light-editor__gizmo-hint">
        {gizmoMode === 'translate' && 'Drag arrows on the light, or type position below.'}
        {gizmoMode === 'rotate' && 'Drag rotation rings, or type rotation (degrees) below.'}
        {gizmoMode === 'scale' &&
          (light.kind === 'rectArea'
            ? 'Drag scale handles — updates panel width & height.'
            : light.kind === 'point' || light.kind === 'spot'
              ? 'Drag scale handles — updates distance / reach.'
              : 'Drag scale handles — updates intensity.')}
      </p>

      <label className="stadium-light-editor__label">
        Name
        <EditableText
          value={light.name}
          resetKey={fieldKey}
          onCommit={(name) => patch({ name })}
        />
      </label>

      <label className="stadium-light-editor__label">
        Color
        <input
          type="color"
          value={light.color}
          disabled={!!light.brightnessMenuKey}
          onChange={(e) => patch({ color: e.target.value })}
          onKeyDown={stopPanelKeys}
        />
      </label>

      <label className="stadium-light-editor__label">
        Intensity
        <EditableNumber
          value={light.intensity}
          resetKey={`${fieldKey}-intensity`}
          min={0}
          max={2000}
          step={1}
          disabled={menuLocked}
          onCommit={(n) => patch({ intensity: n })}
        />
      </label>

      {(light.kind === 'point' || light.kind === 'spot') && (
        <>
          <label className="stadium-light-editor__label">
            Distance (falloff range)
            <EditableNumber
              value={light.distance ?? 80}
              resetKey={`${fieldKey}-dist`}
              min={1}
              max={500}
              step={1}
              onCommit={(n) => patch({ distance: n })}
            />
          </label>
          {light.kind === 'point' && (
            <label className="stadium-light-editor__label">
              Decay
              <EditableNumber
                value={light.decay ?? 1.2}
                resetKey={`${fieldKey}-decay`}
                min={0}
                max={3}
                step={0.05}
                onCommit={(n) => patch({ decay: n })}
              />
            </label>
          )}
        </>
      )}

      {light.kind === 'spot' && (
        <>
          <label className="stadium-light-editor__label">
            Cone angle (rad)
            <EditableNumber
              value={light.angle ?? 0.6}
              resetKey={`${fieldKey}-angle`}
              min={0.05}
              max={1.5}
              step={0.02}
              onCommit={(n) => patch({ angle: n })}
            />
          </label>
          <label className="stadium-light-editor__label">
            Penumbra (soft edge)
            <EditableNumber
              value={light.penumbra ?? 0.4}
              resetKey={`${fieldKey}-pen`}
              min={0}
              max={1}
              step={0.05}
              onCommit={(n) => patch({ penumbra: n })}
            />
          </label>
        </>
      )}

      {light.kind === 'rectArea' && (
        <>
          <label className="stadium-light-editor__label">
            Panel width (m)
            <EditableNumber
              value={light.rectWidth ?? 20}
              resetKey={`${fieldKey}-rw`}
              min={1}
              max={200}
              step={1}
              onCommit={(n) => patch({ rectWidth: n })}
            />
          </label>
          <label className="stadium-light-editor__label">
            Panel height (m)
            <EditableNumber
              value={light.rectHeight ?? 20}
              resetKey={`${fieldKey}-rh`}
              min={1}
              max={200}
              step={1}
              onCommit={(n) => patch({ rectHeight: n })}
            />
          </label>
        </>
      )}

      <Vec3Fields
        title="Position (m)"
        values={light.position}
        resetKey={`${fieldKey}-pos`}
        step={0.5}
        onCommit={(position) =>
          stadiumLightStore.updateTransform(light.id, position, light.rotation)
        }
      />

      <Vec3Fields
        title="Rotation (degrees)"
        values={[
          toDeg(light.rotation[0]),
          toDeg(light.rotation[1]),
          toDeg(light.rotation[2]),
        ]}
        resetKey={`${fieldKey}-rot`}
        step={1}
        onCommit={(deg) =>
          stadiumLightStore.updateTransform(light.id, light.position, [
            toRad(deg[0]),
            toRad(deg[1]),
            toRad(deg[2]),
          ])
        }
      />

      <label className="stadium-light-editor__label stadium-light-editor__label--row">
        <input
          type="checkbox"
          checked={light.castShadow}
          onChange={(e) => patch({ castShadow: e.target.checked })}
          onKeyDown={stopPanelKeys}
        />
        Cast shadow
      </label>

      <label className="stadium-light-editor__label stadium-light-editor__label--row">
        <input
          type="checkbox"
          checked={light.enabled}
          onChange={(e) => patch({ enabled: e.target.checked })}
          onKeyDown={stopPanelKeys}
        />
        Enabled
      </label>

      {!light.brightnessMenuKey && !light.stripMenu && (
        <label className="stadium-light-editor__label stadium-light-editor__label--row">
          <input
            type="checkbox"
            checked={!!light.roofGated}
            onChange={(e) => patch({ roofGated: e.target.checked })}
            onKeyDown={stopPanelKeys}
          />
          Fade with roof open
        </label>
      )}

      <div className="stadium-light-editor__row-btns">
        <button
          type="button"
          className="stadium-light-editor__btn"
          onClick={() => stadiumLightStore.duplicateLight(light.id)}
        >
          Duplicate
        </button>
        <button
          type="button"
          className="stadium-light-editor__btn stadium-light-editor__btn--danger"
          onClick={() => stadiumLightStore.deleteSelected()}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

/** Fly-mode stadium light editor panel */
export function StadiumLightEditorPanel() {
  const panelId = useId();
  const debugFly = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().debugFreelook,
  );
  const lightState = useSyncExternalStore(
    stadiumLightStore.subscribe,
    stadiumLightStore.getState,
  );
  const [addKind, setAddKind] = useState<StadiumLightAddKind>('point');
  const [exportMsg, setExportMsg] = useState('');

  const selected = lightState.lights.find((l) => l.id === lightState.selectedId);

  const handleExport = useCallback(async () => {
    const ok = await stadiumLightStore.copyExportToClipboard();
    setExportMsg(ok ? 'Copied TS to clipboard' : 'Copy failed — logged to console');
    if (!ok) console.log(stadiumLightStore.exportToCode());
    window.setTimeout(() => setExportMsg(''), 2500);
  }, []);

  const placeNewLight = () => {
    stadiumLightStore.addLightAheadOfCamera(addKind);
  };

  if (!debugFly) return null;

  return (
    <div
      id={panelId}
      className="stadium-light-editor"
      role="region"
      aria-label="Light editor"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <h3 className="stadium-light-editor__title">Light editor</h3>
      <p className="stadium-light-editor__hint">
        Click light to select · empty arena to deselect · type in fields here ·
        RMB hold on canvas to look
      </p>

      <label className="stadium-light-editor__label stadium-light-editor__label--row">
        <input
          type="checkbox"
          checked={lightState.showWireframes}
          onChange={(e) => stadiumLightStore.setShowWireframes(e.target.checked)}
          onKeyDown={stopPanelKeys}
        />
        Show all wireframes
      </label>

      {selected ? (
        <SelectedLightFields light={selected} gizmoMode={lightState.gizmoMode} />
      ) : (
        <p className="stadium-light-editor__none">No light selected — click one in the arena</p>
      )}

      <section className="stadium-light-editor__add-section">
        <h4 className="stadium-light-editor__add-title">Add new light</h4>
        <p className="stadium-light-editor__add-hint">
          Places 12 m in front of your camera, then selects it for editing.
        </p>
        <div className="stadium-light-editor__kind-grid">
          {ADD_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className={
                addKind === k.id
                  ? 'stadium-light-editor__kind-card stadium-light-editor__kind-card--on'
                  : 'stadium-light-editor__kind-card'
              }
              onClick={() => setAddKind(k.id)}
            >
              <span className="stadium-light-editor__kind-card-label">{k.label}</span>
              <span className="stadium-light-editor__kind-card-blurb">{k.blurb}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="stadium-light-editor__btn stadium-light-editor__btn--primary"
          onClick={placeNewLight}
        >
          Place {ADD_KINDS.find((k) => k.id === addKind)?.label ?? 'light'} here
        </button>
      </section>

      <div className="stadium-light-editor__list">
        <h4>Lights ({lightState.lights.length})</h4>
        <ul>
          {lightState.lights.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                className={
                  lightState.selectedId === l.id
                    ? 'stadium-light-editor__list-item stadium-light-editor__list-item--on'
                    : 'stadium-light-editor__list-item'
                }
                onClick={() => stadiumLightStore.select(l.id)}
              >
                {l.name} <span>{l.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="stadium-light-editor__actions">
        <button type="button" className="stadium-light-editor__btn" onClick={handleExport}>
          Copy positions to code
        </button>
        <button
          type="button"
          className="stadium-light-editor__btn stadium-light-editor__btn--muted"
          onClick={() => stadiumLightStore.resetToDefaults()}
        >
          Reset defaults
        </button>
      </div>
      {exportMsg ? <p className="stadium-light-editor__export-msg">{exportMsg}</p> : null}
    </div>
  );
}
