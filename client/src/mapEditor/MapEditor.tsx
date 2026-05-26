import { useEffect } from 'react';
import { initStadiumRectAreaLights } from '../game/stadiumRectAreaLightInit';
import { stadiumLightStore } from '../game/stadiumLightStore';
import { MapEditorCanvas } from './MapEditorCanvas';
import { MapEditorUI } from './MapEditorUI';
import { mapEditorSession } from './mapEditorSession';
import { mapEditorStore, mapRegistryStore } from './mapEditorStore';
import './mapEditor.css';

type MapEditorProps = {
  onExit: () => void;
};

export function MapEditor({ onExit }: MapEditorProps) {
  useEffect(() => {
    initStadiumRectAreaLights();
    mapEditorSession.setActive(true);
    stadiumLightStore.setShowWireframes(true);
    return () => {
      mapEditorSession.setActive(false);
      stadiumLightStore.deselect();
    };
  }, []);

  const handleExit = () => {
    mapRegistryStore.refresh();
    onExit();
  };

  return (
    <div className="map-editor-root">
      <MapEditorCanvas />
      <MapEditorUI onExit={handleExit} />
    </div>
  );
}

export function openMapEditorFromMenu(mapId?: string): void {
  mapEditorStore.openEditor(mapId);
}
