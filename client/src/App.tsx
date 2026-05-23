import { useState } from 'react';
import { GameCanvas } from './game/GameCanvas';
import { GamePointerCapture } from './game/GamePointerCapture';
import { HUD } from './game/HUD';
import { MatchIntroSplash } from './game/MatchIntroSplash';
import { gameStore } from './game/gameStore';
import { MainMenu } from './ui/MainMenu';
import { TuningMenu } from './ui/TuningMenu';
import './App.css';

function App() {
  const [inGame, setInGame] = useState(false);

  const startGame = () => {
    gameStore.startMatch();
    setInGame(true);
  };

  const exitGame = () => {
    document.exitPointerLock();
    gameStore.setPhase('menu');
    setInGame(false);
  };

  return (
    <div className="app">
      {!inGame && <MainMenu onPlay={startGame} />}
      {inGame && (
        <>
          <GameCanvas onExit={exitGame} />
          <GamePointerCapture />
          <MatchIntroSplash />
          <HUD />
          <TuningMenu />
        </>
      )}
    </div>
  );
}

export default App;
