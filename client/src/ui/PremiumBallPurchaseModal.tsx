import { useEffect, useRef, useState } from 'react';
import { unlockPremium8Ball } from '../game/premiumBall';

type PremiumBallPurchaseModalProps = {
  onClose: () => void;
};

const START_MONEY = 50;
/** Total time from $50 → $0 */
const COUNTDOWN_MS = 1300;
const HOLD_AT_ZERO_MS = 840;

export function PremiumBallPurchaseModal({
  onClose,
}: PremiumBallPurchaseModalProps) {
  const [money, setMoney] = useState(START_MONEY);
  const closedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const start = performance.now();
    let raf = 0;

    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / COUNTDOWN_MS);
      const remaining = Math.max(0, Math.ceil(START_MONEY * (1 - t)));
      setMoney(remaining);

      if (t < 1) {
        raf = requestAnimationFrame(tick);
        return;
      }

      setMoney(0);
      unlockPremium8Ball();
      window.setTimeout(() => {
        if (!closedRef.current) onCloseRef.current();
      }, HOLD_AT_ZERO_MS);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleClose = () => {
    closedRef.current = true;
    onClose();
  };

  return (
    <div
      className="premium-ball-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-ball-modal-title"
      onClick={handleClose}
    >
      <div
        className="premium-ball-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="premium-ball-modal-title" className="premium-ball-modal-title">
          thanks sucker
        </h2>
        <p className="premium-ball-modal-money-label">Your Money</p>
        <p className="premium-ball-modal-money" aria-live="polite">
          ${money}
        </p>
      </div>
    </div>
  );
}
