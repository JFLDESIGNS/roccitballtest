import { useEffect } from 'react';
import { initStadiumRectAreaLights } from '../game/stadiumRectAreaLightInit';
import { MapEditorCanvas } from './MapEditorCanvas';
import { MapEditorUI } from './MapEditorUI';
import { mapEditorStore, mapRegistryStore } from './mapEditorStore';
import './mapEditor.css';

type MapEditorProps = {
  onExit: () => void;
};

export function MapEditor({ onExit }: MapEditorProps) {
  useEffect(() => {
    initStadiumRectAreaLights();
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
