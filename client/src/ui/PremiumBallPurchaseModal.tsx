import { useEffect, useRef, useState } from 'react';
import { unlockPremium8Ball } from '../game/premiumBall';

type PremiumBallPurchaseModalProps = {
  onClose: () => void;
};

const START_MONEY = 50;
const TICK_MS = 90;
const HOLD_AT_ZERO_MS = 840;

export function PremiumBallPurchaseModal({
  onClose,
}: PremiumBallPurchaseModalProps) {
  const [money, setMoney] = useState(START_MONEY);
  const closedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    let remaining = START_MONEY;
    setMoney(remaining);

    const id = window.setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setMoney(remaining);
        return;
      }

      setMoney(0);
      window.clearInterval(id);
      unlockPremium8Ball();
      window.setTimeout(() => {
        if (!closedRef.current) onCloseRef.current();
      }, HOLD_AT_ZERO_MS);
    }, TICK_MS);

    return () => window.clearInterval(id);
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
