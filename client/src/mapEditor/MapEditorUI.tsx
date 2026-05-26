import { useRef, useSyncExternalStore, useState, type ReactNode } from 'react';
import { MAP_TEXTURE_OPTIONS, type MapLightKind, type MapPrimitiveKind } from './mapEditorTypes';
import { mapEditorStore } from './mapEditorStore';

type MapEditorUIProps = {
  onExit: () => void;
};

function BtnRow({ children }: { children: ReactNode }) {
  return <div className="map-editor-btn-row">{children}</div>;
}

function ScaleInputs({
  object,
}: {
  object: { id: string; scale: [number, number, number] };
}) {
  return (
    <div className="map-editor-scale-row">
      {(['X', 'Y', 'Z'] as const).map((axis, i) => (
        <label key={axis} className="map-editor-field map-editor-field--compact">
          <span>Scale {axis}</span>
          <input
            type="number"
            min={0.05}
            step={0.1}
            value={Number(object.scale[i].toFixed(2))}
            onChange={(e) => {
              const next = [...object.scale] as [number, number, number];
              next[i] = Math.max(0.05, Number(e.target.value) || 0.05);
              mapEditorStore.updateObject(object.id, { scale: next });
            }}
          />
        </label>
      ))}
    </div>
  );
}

export function MapEditorUI({ onExit }: MapEditorUIProps) {
  const editor = useSyncExternalStore(
    mapEditorStore.subscribe,
    () => mapEditorStore.getState(),
  );
  const [status, setStatus] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

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
          Full arena base map — click goals, pillars, or placed objects to move them.
          Drag empty space to orbit · right-click pan · scroll zoom.
          G / R / S — move, rotate, scale.
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
          <h3>Placed objects</h3>
          {editor.document.objects.length === 0 && (
            <p className="map-editor-muted">Add primitives above, then click to move again</p>
          )}
          <div className="map-editor-list">
            {editor.document.objects.map((obj) => (
              <button
                key={obj.id}
                type="button"
                className={`map-editor-list-item${editor.selectedId === obj.id || (editor.selectedId === obj.groupId && !editor.selectIndividual) ? ' map-editor-list-item--active' : ''}`}
                onClick={() => mapEditorStore.select(obj.id)}
              >
                {obj.name}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3>Stadium groups</h3>
          <div className="map-editor-list">
            {editor.document.groups
              .filter((g) => g.stadiumKey)
              .map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`map-editor-list-item${editor.selectedId === g.id ? ' map-editor-list-item--active' : ''}`}
                  onClick={() => mapEditorStore.select(g.id)}
                >
                  {g.name}
                </button>
              ))}
          </div>
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
        <h3>Selection</h3>
        {!selectedObject && !selectedGroup && !selectedLight && (
          <p className="map-editor-muted">Nothing selected — click a goal, pillar, or object</p>
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
            <ScaleInputs object={selectedObject} />
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
