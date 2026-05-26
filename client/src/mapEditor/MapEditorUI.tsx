import { useRef, useSyncExternalStore, useState, type ReactNode } from 'react';
import {
  MAP_TEXTURE_OPTIONS,
  type MapLightKind,
  type MapPrimitiveKind,
} from './mapEditorTypes';
import { stadiumLightStore } from '../game/stadiumLightStore';
import type { StadiumLightDef } from '../game/stadiumLightTypes';
import { mapEditorStore } from './mapEditorStore';

type EditorSnapshot = ReturnType<typeof mapEditorStore.getState>;

function ScaleInputs({
  scale,
  onChange,
}: {
  scale: [number, number, number];
  onChange: (next: [number, number, number]) => void;
}) {
  const uniform = Number(
    ((scale[0] + scale[1] + scale[2]) / 3).toFixed(3),
  );

  const setAxis = (index: number, raw: string) => {
    const next: [number, number, number] = [...scale];
    next[index] = Math.max(0.05, Number(raw) || 0.05);
    onChange(next);
  };

  return (
    <div className="map-editor-scale-block">
      <label className="map-editor-field">
        <span>Uniform scale</span>
        <input
          type="number"
          min={0.05}
          step={0.1}
          value={uniform}
          onChange={(e) => {
            const s = Math.max(0.05, Number(e.target.value) || 0.05);
            onChange([s, s, s]);
          }}
        />
      </label>
      <div className="map-editor-scale-row">
        {(['X', 'Y', 'Z'] as const).map((axis, i) => (
          <label key={axis} className="map-editor-field map-editor-field--compact">
            <span>Scale {axis}</span>
            <input
              type="number"
              min={0.05}
              step={0.1}
              value={Number(scale[i].toFixed(3))}
              onChange={(e) => setAxis(i, e.target.value)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function isBrowserItemActive(
  editor: EditorSnapshot,
  item: { id: string; groupId?: string },
): boolean {
  if (editor.selectedId === item.id) return true;
  if (
    !editor.selectIndividual &&
    item.groupId &&
    editor.selectedId === item.groupId
  ) {
    return true;
  }
  return false;
}

function lightKindShort(kind: string): string {
  if (kind === 'rectArea') return 'Rect';
  if (kind === 'directional') return 'Dir';
  if (kind === 'spot') return 'Spot';
  return 'Point';
}

function pickStadiumLight(id: string): void {
  const { selectedId } = stadiumLightStore.getState();
  if (selectedId !== null) {
    if (selectedId !== id) stadiumLightStore.deselect();
    return;
  }
  mapEditorStore.select(null);
  stadiumLightStore.select(id);
}

function SceneBrowser({
  editor,
  stadiumLights,
  stadiumSelectedId,
}: {
  editor: EditorSnapshot;
  stadiumLights: StadiumLightDef[];
  stadiumSelectedId: string | null;
}) {
  const { groups, objects, lights } = editor.document;

  return (
    <section className="map-editor-browser">
      <h3>Scene</h3>
      <p className="map-editor-muted map-editor-browser-hint">
        Arena lights (rect strips, keys) are built into the stadium. Map lights
        are saved with your custom map. While focused, another click only
        deselects.
      </p>
      <div className="map-editor-list map-editor-list--browser">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`map-editor-list-item${editor.selectedId === g.id ? ' map-editor-list-item--active' : ''}`}
            onClick={() => mapEditorStore.select(g.id)}
          >
            <span className="map-editor-list-kind">Group</span>
            {g.name}
          </button>
        ))}
        {objects.map((obj) => (
          <button
            key={obj.id}
            type="button"
            className={`map-editor-list-item${isBrowserItemActive(editor, obj) ? ' map-editor-list-item--active' : ''}`}
            onClick={() => mapEditorStore.select(obj.id)}
          >
            <span className="map-editor-list-kind">Object</span>
            {obj.name}
          </button>
        ))}
        {lights.length > 0 && (
          <p className="map-editor-list-heading">Map lights</p>
        )}
        {lights.map((light) => (
          <button
            key={light.id}
            type="button"
            className={`map-editor-list-item${editor.selectedId === light.id ? ' map-editor-list-item--active' : ''}`}
            onClick={() => mapEditorStore.select(light.id)}
          >
            <span className="map-editor-list-kind">
              {lightKindShort(light.kind)}
            </span>
            {light.name}
          </button>
        ))}
        {stadiumLights.length > 0 && (
          <p className="map-editor-list-heading">Arena lights</p>
        )}
        {stadiumLights.map((light) => (
          <button
            key={light.id}
            type="button"
            className={`map-editor-list-item${stadiumSelectedId === light.id ? ' map-editor-list-item--active' : ''}`}
            onClick={() => pickStadiumLight(light.id)}
          >
            <span className="map-editor-list-kind map-editor-list-kind--arena">
              {lightKindShort(light.kind)}
            </span>
            {light.name}
            {!light.enabled ? ' (off)' : ''}
          </button>
        ))}
        {groups.length === 0 &&
          objects.length === 0 &&
          lights.length === 0 &&
          stadiumLights.length === 0 && (
          <p className="map-editor-muted">No objects yet — add primitives or lights.</p>
        )}
      </div>
    </section>
  );
}

type MapEditorUIProps = {
  onExit: () => void;
};

function BtnRow({ children }: { children: ReactNode }) {
  return <div className="map-editor-btn-row">{children}</div>;
}

export function MapEditorUI({ onExit }: MapEditorUIProps) {
  const editor = useSyncExternalStore(
    mapEditorStore.subscribe,
    () => mapEditorStore.getState(),
  );
  const stadiumLightState = useSyncExternalStore(
    stadiumLightStore.subscribe,
    stadiumLightStore.getState,
  );
  const [status, setStatus] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const selectedStadiumLight = stadiumLightState.lights.find(
    (l) => l.id === stadiumLightState.selectedId,
  );

  const selectedObject = editor.document.objects.find(
    (o) => o.id === editor.selectedId,
  );
  const selectedGroup = editor.document.groups.find(
    (g) => g.id === editor.selectedId,
  );
  const selectedLight = editor.document.lights.find(
    (l) => l.id === editor.selectedId,
  );

  const flash = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 2200);
  };

  const handleSave = () => {
    if (mapEditorStore.canSaveInPlace()) {
      mapEditorStore.saveCurrent();
      flash('Map saved.');
      return;
    }
    handleSaveAs();
  };

  const handleSaveAs = () => {
    const name = window.prompt('Name for this map (cannot replace Default Arena):');
    if (!name?.trim()) return;
    try {
      mapEditorStore.saveAsNew(name.trim());
      flash(`Saved “${name.trim()}”.`);
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Save failed.');
    }
  };

  const downloadJson = (filename: string, json: string) => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    try {
      const doc = editor.document;
      const pretty = JSON.stringify(doc, null, 2);
      const safe = doc.name.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'map';
      downloadJson(`${safe}.json`, pretty);
      flash('Exported JSON.');
    } catch {
      flash('Export failed.');
    }
  };

  const handleImportJson = async (file: File | null) => {
    if (!file) return;
    try {
      const raw = await file.text();
      const saved = mapEditorStore.importFromJson(raw);
      flash(`Imported “${saved.name}”.`);
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      // Allow importing the same file again.
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const exit = () => {
    if (
      editor.dirty &&
      !window.confirm('Leave without saving? Unsaved changes will be lost.')
    ) {
      return;
    }
    onExit();
  };

  return (
    <>
      <header className="map-editor-topbar">
        <button type="button" className="btn-secondary" onClick={exit}>
          ← Main menu
        </button>
        {status && <span className="map-editor-status">{status}</span>}
      </header>

      <aside className="map-editor-panel map-editor-panel--left">
        <h2>Map Editor</h2>
        <p className="map-editor-hint">
          Click an object to focus and use the gizmo. While focused, another click
          only deselects — click empty space to exit focus.
          then click another object. Drag empty space to orbit · right-click pan ·
          scroll zoom. G / R / S — move, rotate, scale.
        </p>

        <label className="map-editor-checkbox">
          <input
            type="checkbox"
            checked={editor.selectIndividual}
            onChange={(e) => mapEditorStore.setSelectIndividual(e.target.checked)}
          />
          Select individual parts (off = move groups)
        </label>

        <label className="map-editor-checkbox">
          <input
            type="checkbox"
            checked={editor.showMoveGrid}
            onChange={(e) => mapEditorStore.setShowMoveGrid(e.target.checked)}
          />
          Show move grid (4 m cells)
        </label>
        <label className="map-editor-checkbox">
          <input
            type="checkbox"
            checked={editor.snapToMoveGrid}
            onChange={(e) => mapEditorStore.setSnapToMoveGrid(e.target.checked)}
          />
          Snap moves to grid
        </label>

        <section>
          <h3>Map JSON</h3>
          <BtnRow>
            <button type="button" className="map-editor-btn" onClick={handleExportJson}>
              Export JSON
            </button>
            <button
              type="button"
              className="map-editor-btn"
              onClick={() => importInputRef.current?.click()}
            >
              Import JSON
            </button>
          </BtnRow>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              void handleImportJson(e.target.files?.[0] ?? null);
            }}
          />
          <p className="map-editor-muted">
            Export downloads a `.json` you can re-import later. Imported maps become the active arena map for gameplay.
          </p>
        </section>

        <section>
          <h3>Primitives</h3>
          <BtnRow>
            {(
              [
                ['box', 'Box'],
                ['sphere', 'Sphere'],
                ['cylinder', 'Cylinder'],
                ['plane', 'Plane'],
                ['alphaShadow', 'Alpha shadow'],
              ] as [MapPrimitiveKind, string][]
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                className="map-editor-btn"
                onClick={() => mapEditorStore.addObject(kind)}
              >
                + {label}
              </button>
            ))}
          </BtnRow>
        </section>

        <section>
          <h3>Lights</h3>
          <BtnRow>
            {(
              [
                ['point', 'Point'],
                ['spot', 'Spot'],
                ['directional', 'Sun'],
                ['rectArea', 'Rect area'],
              ] as [MapLightKind, string][]
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                className="map-editor-btn"
                onClick={() => mapEditorStore.addLight(kind)}
              >
                + {label}
              </button>
            ))}
          </BtnRow>
        </section>

        <section>
          <h3>Gizmo</h3>
          <BtnRow>
            {(
              [
                ['translate', 'Move (G)'],
                ['rotate', 'Rotate (R)'],
                ['scale', 'Scale (S)'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={`map-editor-btn${editor.transformMode === mode ? ' map-editor-btn--active' : ''}`}
                onClick={() => mapEditorStore.setTransformMode(mode)}
              >
                {label}
              </button>
            ))}
          </BtnRow>
        </section>
      </aside>

      <aside className="map-editor-panel map-editor-panel--right">
        <SceneBrowser
          editor={editor}
          stadiumLights={stadiumLightState.lights}
          stadiumSelectedId={stadiumLightState.selectedId}
        />

        <section className="map-editor-selection-panel">
          <h3>Selection</h3>
          {!selectedObject &&
            !selectedGroup &&
            !selectedLight &&
            !selectedStadiumLight && (
            <p className="map-editor-muted">
              Nothing selected — pick from the scene list or click in the view
            </p>
          )}

        {selectedGroup && (
          <>
            <label className="map-editor-field">
              <span>Group name</span>
              <input
                value={selectedGroup.name}
                onChange={(e) =>
                  mapEditorStore.updateGroup(selectedGroup.id, {
                    name: e.target.value,
                  })
                }
              />
            </label>
            {selectedGroup.stadiumKey && (
              <p className="map-editor-muted">Stadium piece — moves as one group</p>
            )}
            <ScaleInputs
              scale={selectedGroup.scale}
              onChange={(scale) =>
                mapEditorStore.updateGroup(selectedGroup.id, { scale })
              }
            />
          </>
        )}

        {selectedObject && (
          <>
            <label className="map-editor-field">
              <span>Name</span>
              <input
                value={selectedObject.name}
                onChange={(e) =>
                  mapEditorStore.updateObject(selectedObject.id, {
                    name: e.target.value,
                  })
                }
              />
            </label>
            {selectedObject.kind !== 'alphaShadow' && (
              <>
                <label className="map-editor-field">
                  <span>Texture</span>
                  <select
                    value={selectedObject.textureId}
                    onChange={(e) =>
                      mapEditorStore.setObjectTexture(
                        selectedObject.id,
                        e.target.value as typeof selectedObject.textureId,
                      )
                    }
                  >
                    {MAP_TEXTURE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="map-editor-field">
                  <span>Color tint</span>
                  <input
                    type="color"
                    value={selectedObject.color}
                    onChange={(e) =>
                      mapEditorStore.updateObject(selectedObject.id, {
                        color: e.target.value,
                      })
                    }
                  />
                </label>
              </>
            )}
            {selectedObject.kind === 'alphaShadow' && (
              <p className="map-editor-muted">
                Black octagon decal — uses alphashadow.jpg for shape. Scale and move
                like other primitives.
              </p>
            )}
            <ScaleInputs
              scale={selectedObject.scale}
              onChange={(scale) =>
                mapEditorStore.updateObject(selectedObject.id, { scale })
              }
            />
            {!selectedObject.groupId && (
              <button
                type="button"
                className="map-editor-btn"
                onClick={() => mapEditorStore.createGroupFromSelected()}
              >
                Wrap in group
              </button>
            )}
          </>
        )}

        {selectedStadiumLight && (
          <>
            <p className="map-editor-muted">
              Arena light — shared across all maps (not in export JSON). Use G /
              R / S for gizmo mode.
            </p>
            <label className="map-editor-field">
              <span>Name</span>
              <input
                value={selectedStadiumLight.name}
                onChange={(e) =>
                  stadiumLightStore.patchLight(selectedStadiumLight.id, {
                    name: e.target.value,
                  })
                }
              />
            </label>
            <label className="map-editor-field">
              <span>Type</span>
              <input
                readOnly
                value={lightKindShort(selectedStadiumLight.kind)}
              />
            </label>
            <label className="map-editor-field">
              <span>Color</span>
              <input
                type="color"
                value={selectedStadiumLight.color}
                onChange={(e) =>
                  stadiumLightStore.patchLight(selectedStadiumLight.id, {
                    color: e.target.value,
                  })
                }
              />
            </label>
            <label className="map-editor-field">
              <span>Intensity</span>
              <input
                type="number"
                min={0}
                max={40}
                step={0.05}
                value={selectedStadiumLight.intensity}
                onChange={(e) =>
                  stadiumLightStore.patchLight(selectedStadiumLight.id, {
                    intensity: Number(e.target.value) || 0,
                  })
                }
              />
            </label>
            {selectedStadiumLight.kind === 'rectArea' && (
              <>
                <label className="map-editor-field">
                  <span>Panel width (m)</span>
                  <input
                    type="number"
                    min={0.5}
                    max={120}
                    step={0.5}
                    value={selectedStadiumLight.rectWidth ?? 20}
                    onChange={(e) =>
                      stadiumLightStore.patchLight(selectedStadiumLight.id, {
                        rectWidth: Number(e.target.value) || 1,
                      })
                    }
                  />
                </label>
                <label className="map-editor-field">
                  <span>Panel height (m)</span>
                  <input
                    type="number"
                    min={0.5}
                    max={120}
                    step={0.5}
                    value={selectedStadiumLight.rectHeight ?? 20}
                    onChange={(e) =>
                      stadiumLightStore.patchLight(selectedStadiumLight.id, {
                        rectHeight: Number(e.target.value) || 1,
                      })
                    }
                  />
                </label>
              </>
            )}
            <BtnRow>
              <button
                type="button"
                className="map-editor-btn map-editor-btn--danger"
                onClick={() => stadiumLightStore.deleteSelected()}
              >
                Delete arena light
              </button>
            </BtnRow>
          </>
        )}

        {selectedLight && (
          <>
            <label className="map-editor-field">
              <span>Name</span>
              <input
                value={selectedLight.name}
                onChange={(e) =>
                  mapEditorStore.updateLight(selectedLight.id, {
                    name: e.target.value,
                  })
                }
              />
            </label>
            <label className="map-editor-field">
              <span>Color</span>
              <input
                type="color"
                value={selectedLight.color}
                onChange={(e) =>
                  mapEditorStore.updateLight(selectedLight.id, {
                    color: e.target.value,
                  })
                }
              />
            </label>
            <label className="map-editor-field">
              <span>Intensity</span>
              <input
                type="number"
                min={0}
                max={20}
                step={0.1}
                value={selectedLight.intensity}
                onChange={(e) =>
                  mapEditorStore.updateLight(selectedLight.id, {
                    intensity: Number(e.target.value) || 0,
                  })
                }
              />
            </label>
            <label className="map-editor-field map-editor-field--row">
              <span>Cast shadows</span>
              <input
                type="checkbox"
                checked={selectedLight.castShadow}
                disabled={selectedLight.kind === 'rectArea'}
                onChange={(e) =>
                  mapEditorStore.updateLight(selectedLight.id, {
                    castShadow: e.target.checked,
                  })
                }
              />
            </label>
            {selectedLight.kind === 'rectArea' && (
              <p className="map-editor-muted">
                Rect area lights illuminate surfaces but do not cast shadows in
                Three.js.
              </p>
            )}
            {selectedLight.kind === 'spot' && (
              <>
                <label className="map-editor-field">
                  <span>Distance</span>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    step={1}
                    value={selectedLight.distance}
                    onChange={(e) =>
                      mapEditorStore.updateLight(selectedLight.id, {
                        distance: Number(e.target.value) || 1,
                      })
                    }
                  />
                </label>
                <label className="map-editor-field">
                  <span>Angle</span>
                  <input
                    type="number"
                    min={0.05}
                    max={1.5}
                    step={0.05}
                    value={selectedLight.angle}
                    onChange={(e) =>
                      mapEditorStore.updateLight(selectedLight.id, {
                        angle: Number(e.target.value) || 0.1,
                      })
                    }
                  />
                </label>
              </>
            )}
            {selectedLight.kind === 'point' && (
              <label className="map-editor-field">
                <span>Distance</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  step={1}
                  value={selectedLight.distance}
                  onChange={(e) =>
                    mapEditorStore.updateLight(selectedLight.id, {
                      distance: Number(e.target.value) || 1,
                    })
                  }
                />
              </label>
            )}
            {selectedLight.kind === 'rectArea' && (
              <>
                <label className="map-editor-field">
                  <span>Panel width (m)</span>
                  <input
                    type="number"
                    min={0.5}
                    max={80}
                    step={0.5}
                    value={selectedLight.rectWidth}
                    onChange={(e) =>
                      mapEditorStore.updateLight(selectedLight.id, {
                        rectWidth: Number(e.target.value) || 1,
                      })
                    }
                  />
                </label>
                <label className="map-editor-field">
                  <span>Panel height (m)</span>
                  <input
                    type="number"
                    min={0.5}
                    max={80}
                    step={0.5}
                    value={selectedLight.rectHeight}
                    onChange={(e) =>
                      mapEditorStore.updateLight(selectedLight.id, {
                        rectHeight: Number(e.target.value) || 1,
                      })
                    }
                  />
                </label>
                <p className="map-editor-muted">
                  Use Scale (S) on the gizmo to resize the rect panel.
                </p>
              </>
            )}
          </>
        )}

        {editor.selectedId && (
          <BtnRow>
            <button
              type="button"
              className="map-editor-btn map-editor-btn--danger"
              onClick={() => mapEditorStore.deleteSelected()}
              disabled={Boolean(selectedGroup?.stadiumKey)}
            >
              Delete
            </button>
            <button
              type="button"
              className="map-editor-btn"
              onClick={() => mapEditorStore.duplicateSelected()}
            >
              Duplicate
            </button>
          </BtnRow>
        )}
        </section>

        <section className="map-editor-save">
          <h3>Save</h3>
          <p className="map-editor-muted">
            Default Arena cannot be overwritten. Save updates your custom map or
            Save as… creates a new one.
          </p>
          <BtnRow>
            <button type="button" className="btn-primary map-editor-save-btn" onClick={handleSave}>
              {mapEditorStore.canSaveInPlace() ? 'Save map' : 'Save as new…'}
            </button>
            <button type="button" className="btn-secondary" onClick={handleSaveAs}>
              Save as…
            </button>
          </BtnRow>
          {editor.editingMapId && (
            <p className="map-editor-muted">Editing: {editor.document.name}</p>
          )}
          {editor.dirty && <p className="map-editor-dirty">Unsaved changes</p>}
        </section>
      </aside>
    </>
  );
}
