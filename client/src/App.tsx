import { useState } from 'react';
import { GameCanvas } from './game/GameCanvas';
import { GamePointerCapture } from './game/GamePointerCapture';
import { HUD } from './game/HUD';
import { MatchIntroSplash } from './game/MatchIntroSplash';
import { gameStore } from './game/gameStore';
import { MapEditor } from './mapEditor/MapEditor';
import { MainMenu } from './ui/MainMenu';
import { TuningMenu } from './ui/TuningMenu';
import './App.css';

type AppMode = 'menu' | 'game' | 'editor';

function App() {
  const [mode, setMode] = useState<AppMode>('menu');

  const startGame = () => {
    gameStore.startMatch();
    setMode('game');
  };

  const startEditor = () => {
    setMode('editor');
  };

  const exitGame = () => {
    document.exitPointerLock();
    gameStore.setPhase('menu');
    setMode('menu');
  };

  const exitEditor = () => {
    setMode('menu');
  };

  return (
    <div className="app">
      {mode === 'menu' && (
        <MainMenu onPlay={startGame} onEditMap={startEditor} />
      )}
      {mode === 'game' && (
        <>
          <GameCanvas onExit={exitGame} />
          <GamePointerCapture />
          <MatchIntroSplash />
          <HUD onMainMenu={exitGame} />
          <TuningMenu />
        </>
      )}
      {mode === 'editor' && <MapEditor onExit={exitEditor} />}
    </div>
  );
}

export default App;
