import { useEffect, useState, useSyncExternalStore } from 'react';
import { gameStore } from './gameStore';

/** Top-left debug flash when post-step ball boundary assist runs */
export function BallBoundaryHelpBadge() {
  const helpUntil = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().ballBoundaryHelpUntil,
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const show = performance.now() < helpUntil;
      setVisible(show);
      if (show) frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [helpUntil]);

  if (!visible) return null;

  return (
    <div className="ball-boundary-help" role="status" aria-live="polite">
      helping
    </div>
  );
}
