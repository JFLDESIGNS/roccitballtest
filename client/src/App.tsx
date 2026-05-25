import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { restartGameplayBackgroundMusic, returnToMenuAudio } from './game/audio';
import { MATCH } from './shared/Constants';
import { GameCanvas } from './game/GameCanvas';
import { GamePointerCapture } from './game/GamePointerCapture';
import { HUD } from './game/HUD';
import { ArenaLoadScreen } from './game/ArenaLoadScreen';
import { MapLoadTimer } from './game/MapLoadTimer';
import { MatchIntroSplash } from './game/MatchIntroSplash';
import { MatchIntroTimer } from './game/MatchIntroTimer';
import { gameStore } from './game/gameStore';
import { MapEditor } from './mapEditor/MapEditor';
import { MainMenu } from './ui/MainMenu';
import { TuningMenu } from './ui/TuningMenu';
import { GamePreloadHost } from './game/GamePreloadHost';
import { gamePreloadStore } from './game/gamePreloadStore';
import './App.css';

type AppMode = 'menu' | 'game' | 'editor';

function isArenaGameplayPhase(phase: string): boolean {
  return phase === 'playing' || phase === 'countdown' || phase === 'paused';
}

function App() {
  const [mode, setMode] = useState<AppMode>('menu');
  const lastPregameMusicMatch = useRef(-1);
  const gamePhase = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().phase,
  );
  const preloadReady = useSyncExternalStore(
    gamePreloadStore.subscribe,
    () => gamePreloadStore.isReady(),
  );
  const mountArena =
    isArenaGameplayPhase(gamePhase) ||
    (gamePhase === 'loading' && preloadReady);

  useEffect(() => {
    const unsub = gameStore.subscribe(() => {
      if (mode !== 'game') return;
      const { phase, matchGeneration, loadCountdown } = gameStore.getState();
      if (phase !== 'loading') return;
      if (loadCountdown !== MATCH.mapLoadSec) return;
      if (matchGeneration === lastPregameMusicMatch.current) return;
      lastPregameMusicMatch.current = matchGeneration;
      restartGameplayBackgroundMusic();
    });
    return () => {
      unsub();
    };
  }, [mode]);

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
    returnToMenuAudio();
    setMode('menu');
  };

  const exitEditor = () => {
    setMode('menu');
  };

  return (
    <div className="app">
      <GamePreloadHost />
      {mode === 'menu' && (
        <MainMenu onPlay={startGame} onEditMap={startEditor} />
      )}
      {mode === 'game' && (
        <>
          <MatchIntroSplash />
          <ArenaLoadScreen />
          <MatchIntroTimer />
          <MapLoadTimer />
          {mountArena && <GameCanvas onExit={exitGame} />}
          {isArenaGameplayPhase(gamePhase) && (
            <>
              <GamePointerCapture />
              <HUD onMainMenu={exitGame} />
              <TuningMenu />
            </>
          )}
        </>
      )}
      {mode === 'editor' && <MapEditor onExit={exitEditor} />}
    </div>
  );
}

export default App;
