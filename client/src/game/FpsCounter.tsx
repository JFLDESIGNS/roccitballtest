import { useEffect, useState } from 'react';

/** Smoothed FPS readout for the HUD (updates ~2× per second). */
export function FpsCounter() {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let frames = 0;
    let lastSample = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      frames += 1;
      const elapsed = now - lastSample;
      if (elapsed >= 500) {
        setFps(Math.round((frames * 1000) / elapsed));
        frames = 0;
        lastSample = now;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="hud-fps" aria-label={`${fps} frames per second`}>
      {fps} FPS
    </div>
  );
}
