import {
  useCallback,
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { isMobileControlsLikely } from './mobileInput';

async function lockLandscapeIfMobile(): Promise<void> {
  if (!isMobileControlsLikely()) return;
  const orientation = screen.orientation;
  if (!orientation || typeof orientation.lock !== 'function') return;
  try {
    await orientation.lock('landscape');
  } catch {
    /* Mobile browsers may reject orientation lock unless fullscreen is active. */
  }
}

function unlockOrientationIfMobile(): void {
  if (!isMobileControlsLikely()) return;
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* Not supported everywhere. */
  }
}

async function requestGameFullscreen(): Promise<void> {
  const target =
    document.querySelector<HTMLElement>('.app') ?? document.documentElement;
  if (!document.fullscreenElement) {
    await target.requestFullscreen?.();
    await lockLandscapeIfMobile();
    return;
  }
  unlockOrientationIfMobile();
  await document.exitFullscreen?.();
}

export function FullscreenButton() {
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));

  useEffect(() => {
    const onChange = () => {
      const active = Boolean(document.fullscreenElement);
      setFullscreen(active);
      if (active) {
        void lockLandscapeIfMobile();
      } else {
        unlockOrientationIfMobile();
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const onPress = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    void requestGameFullscreen();
  }, []);

  return (
    <button
      type="button"
      className="hud-fullscreen-btn"
      onPointerDown={onPress}
      title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
    >
      <span aria-hidden>{fullscreen ? 'Exit' : 'Full'}</span>
      <svg viewBox="0 0 24 24" aria-hidden>
        {fullscreen ? (
          <>
            <path d="M9 4v5H4" />
            <path d="M15 4v5h5" />
            <path d="M9 20v-5H4" />
            <path d="M15 20v-5h5" />
          </>
        ) : (
          <>
            <path d="M4 9V4h5" />
            <path d="M20 9V4h-5" />
            <path d="M4 15v5h5" />
            <path d="M20 15v5h-5" />
          </>
        )}
      </svg>
    </button>
  );
}
