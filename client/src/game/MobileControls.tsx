import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { gameStore } from './gameStore';
import { inputManager } from './InputManager';
import { tuningStore } from './tuningStore';
import { isMobileControlsLikely } from './mobileInput';

const STICK_RADIUS = 56;
const LOOK_SCALE = 1.25;

function useMobileControlsAvailable(): boolean {
  const [available, setAvailable] = useState(isMobileControlsLikely);

  useEffect(() => {
    const update = () => setAvailable(isMobileControlsLikely());
    const coarse = window.matchMedia?.('(pointer: coarse)');
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    coarse?.addEventListener?.('change', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      coarse?.removeEventListener?.('change', update);
    };
  }, []);

  return available;
}

function stopTouch(e: ReactPointerEvent<HTMLElement>) {
  e.preventDefault();
  e.stopPropagation();
}

function HoldButton({
  className,
  label,
  button,
}: {
  className: string;
  label: string;
  button: 'fire' | 'beam' | 'sprint';
}) {
  const activePointer = useRef<number | null>(null);
  const release = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (activePointer.current !== e.pointerId) return;
    stopTouch(e);
    activePointer.current = null;
    inputManager.setVirtualButton(button, false);
  };

  return (
    <button
      type="button"
      className={className}
      onPointerDown={(e) => {
        stopTouch(e);
        activePointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        inputManager.setVirtualButton(button, true);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={() => {
        activePointer.current = null;
        inputManager.setVirtualButton(button, false);
      }}
    >
      {label}
    </button>
  );
}

function TapButton({
  className,
  label,
  button,
}: {
  className: string;
  label: string;
  button: 'jump' | 'throw' | 'grapple' | 'spawnBall' | 'downSmash';
}) {
  return (
    <button
      type="button"
      className={className}
      onPointerDown={(e) => {
        stopTouch(e);
        inputManager.tapVirtualButton(button);
      }}
    >
      {label}
    </button>
  );
}

function MobileMoveStick() {
  const knobRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });

  const updateStick = (clientX: number, clientY: number) => {
    const dx = clientX - origin.current.x;
    const dy = clientY - origin.current.y;
    const len = Math.hypot(dx, dy);
    const scale = len > STICK_RADIUS ? STICK_RADIUS / len : 1;
    const kx = dx * scale;
    const ky = dy * scale;
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${kx}px, ${ky}px)`;
    }
    inputManager.setVirtualMove(kx / STICK_RADIUS, -ky / STICK_RADIUS);
  };

  const release = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== e.pointerId) return;
    stopTouch(e);
    activePointer.current = null;
    inputManager.setVirtualMove(0, 0);
    if (knobRef.current) knobRef.current.style.transform = 'translate(0, 0)';
  };

  return (
    <div
      className="mobile-stick"
      onPointerDown={(e) => {
        stopTouch(e);
        activePointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        const rect = e.currentTarget.getBoundingClientRect();
        origin.current = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
        updateStick(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (activePointer.current !== e.pointerId) return;
        stopTouch(e);
        updateStick(e.clientX, e.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={() => {
        activePointer.current = null;
        inputManager.setVirtualMove(0, 0);
        if (knobRef.current) knobRef.current.style.transform = 'translate(0, 0)';
      }}
      aria-label="Move"
    >
      <div className="mobile-stick-knob" ref={knobRef} />
    </div>
  );
}

function MobileLookPad() {
  const activePointer = useRef<number | null>(null);
  const last = useRef({ x: 0, y: 0 });

  const release = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== e.pointerId) return;
    stopTouch(e);
    activePointer.current = null;
  };

  return (
    <div
      className="mobile-look-pad"
      onPointerDown={(e) => {
        stopTouch(e);
        activePointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        last.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (activePointer.current !== e.pointerId) return;
        stopTouch(e);
        inputManager.applyVirtualLook(
          (e.clientX - last.current.x) * LOOK_SCALE,
          (e.clientY - last.current.y) * LOOK_SCALE,
        );
        last.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={() => {
        activePointer.current = null;
      }}
      aria-label="Look"
    />
  );
}

export function MobileControls() {
  const available = useMobileControlsAvailable();
  const phase = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().phase,
  );
  const debugFreelook = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().debugFreelook,
  );
  const showMenu = useSyncExternalStore(
    tuningStore.subscribe,
    () => tuningStore.getState().showMenu,
  );
  const visible =
    available &&
    !showMenu &&
    !debugFreelook &&
    (phase === 'playing' || phase === 'countdown');

  useEffect(
    () => () => {
      inputManager.resetVirtualControls();
    },
    [],
  );

  useEffect(() => {
    if (!visible) inputManager.resetVirtualControls();
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="mobile-controls" aria-label="Mobile controls">
      <MobileLookPad />
      <MobileMoveStick />
      <div className="mobile-actions mobile-actions--primary">
        <HoldButton className="mobile-btn mobile-btn--fire" label="Fire" button="fire" />
        <HoldButton className="mobile-btn mobile-btn--beam" label="Beam" button="beam" />
        <TapButton className="mobile-btn" label="Jump" button="jump" />
        <HoldButton className="mobile-btn" label="Boost" button="sprint" />
      </div>
      <div className="mobile-actions mobile-actions--utility">
        <TapButton className="mobile-mini-btn" label="Grapple" button="grapple" />
        <TapButton className="mobile-mini-btn" label="Throw" button="throw" />
        <TapButton className="mobile-mini-btn" label="Drop" button="downSmash" />
        <TapButton className="mobile-mini-btn" label="Ball" button="spawnBall" />
      </div>
    </div>
  );
}
