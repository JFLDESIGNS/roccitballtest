import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { getRocccitLogoUrl } from '../game/roccitLogo';

const MAX_TILT_DEG = 28;
/** Both shine bars offset together from this center (0–1 across logo width). */
const SHINE_CENTER_BASE = 0.5;
const SHINE_SHIFT_X = 0.09;
const SHINE_SHIFT_Y = 0.032;
/** Fixed spacing between the two shine bars (moves as one unit). */
const SHINE_PAIR_SPREAD = 0.2;
const SMOOTH = 0.11;

type Tilt = {
  rotateX: number;
  rotateY: number;
  shineCenter: number;
};

const NEUTRAL: Tilt = {
  rotateX: 0,
  rotateY: 0,
  shineCenter: SHINE_CENTER_BASE,
};

function clampNorm(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

function lerpTilt(current: Tilt, target: Tilt, alpha: number): Tilt {
  return {
    rotateX: current.rotateX + (target.rotateX - current.rotateX) * alpha,
    rotateY: current.rotateY + (target.rotateY - current.rotateY) * alpha,
    shineCenter:
      current.shineCenter + (target.shineCenter - current.shineCenter) * alpha,
  };
}

export function MenuLogoTilt() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const targetRef = useRef<Tilt>(NEUTRAL);
  const currentRef = useRef<Tilt>(NEUTRAL);
  const [tilt, setTilt] = useState<Tilt>(NEUTRAL);
  const [clipSize, setClipSize] = useState({ w: 0, h: 0 });
  const logoUrl = getRocccitLogoUrl();

  const shinePositions = useMemo(() => {
    const half = SHINE_PAIR_SPREAD * 0.5;
    return {
      a: (tilt.shineCenter - half) * 100,
      b: (tilt.shineCenter + half) * 100,
    };
  }, [tilt.shineCenter]);

  const syncClipSize = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const w = img.offsetWidth;
    const h = img.offsetHeight;
    if (w > 0 && h > 0) setClipSize({ w, h });
  }, []);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    syncClipSize();
    const ro = new ResizeObserver(syncClipSize);
    ro.observe(img);
    return () => ro.disconnect();
  }, [syncClipSize]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const next = lerpTilt(currentRef.current, targetRef.current, SMOOTH);
      currentRef.current = next;
      setTilt(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const clipMaskStyle = useMemo(
    (): CSSProperties => ({
      WebkitMaskImage: `url("${logoUrl}")`,
      maskImage: `url("${logoUrl}")`,
      WebkitMaskSize: '100% 100%',
      maskSize: '100% 100%',
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
      maskPosition: 'center',
      maskMode: 'alpha',
    }),
    [logoUrl],
  );

  const updateFromPointer = useCallback((clientX: number, clientY: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const nx = clampNorm((clientX - cx) / (rect.width * 0.5));
    const ny = clampNorm((clientY - cy) / (rect.height * 0.5));

    targetRef.current = {
      rotateY: nx * MAX_TILT_DEG,
      rotateX: -ny * MAX_TILT_DEG,
      shineCenter:
        SHINE_CENTER_BASE + nx * SHINE_SHIFT_X + ny * SHINE_SHIFT_Y,
    };
  }, []);

  const onMouseMove = (e: React.MouseEvent) => {
    updateFromPointer(e.clientX, e.clientY);
  };

  const onMouseLeave = () => {
    targetRef.current = NEUTRAL;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) updateFromPointer(t.clientX, t.clientY);
  };

  return (
    <div
      ref={wrapRef}
      className="main-menu-logo-wrap"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onTouchMove={onTouchMove}
      onTouchEnd={onMouseLeave}
    >
      <div
        className="main-menu-logo-tilt"
        style={{
          transform: `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
        }}
      >
        <div
          className="main-menu-logo-clip"
          style={{
            ...clipMaskStyle,
            ...(clipSize.w > 0
              ? { width: clipSize.w, height: clipSize.h }
              : undefined),
          }}
        >
          <img
            ref={imgRef}
            className="main-menu-logo"
            src={logoUrl}
            alt="Rocccit Ball"
            draggable={false}
            onLoad={syncClipSize}
          />
          <div className="main-menu-logo-shines" aria-hidden>
            <span
              className="main-menu-logo-shine main-menu-logo-shine--a"
              style={{ left: `${shinePositions.a}%` }}
            />
            <span
              className="main-menu-logo-shine main-menu-logo-shine--b"
              style={{ left: `${shinePositions.b}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
