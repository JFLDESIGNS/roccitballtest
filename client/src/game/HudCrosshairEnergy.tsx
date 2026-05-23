type HudCrosshairEnergyProps = {
  energy: number;
  lowEnergy?: boolean;
};

const SIZE = 56;
const CX = SIZE / 2;
const RING_R = 22;
const RING_C = 2 * Math.PI * RING_R;

export function HudCrosshairEnergy({ energy, lowEnergy }: HudCrosshairEnergyProps) {
  const pct = Math.max(0, Math.min(100, energy));
  const offset = RING_C * (1 - pct / 100);
  const stroke = lowEnergy ? '#ffaa44' : 'url(#hudEnergyGrad)';

  return (
    <div className="hud-aim" aria-hidden>
      <svg
        className="hud-aim-svg"
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
      >
        <defs>
          <linearGradient id="hudEnergyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#44aaff" />
            <stop offset="100%" stopColor="#66ffcc" />
          </linearGradient>
        </defs>
        <circle
          cx={CX}
          cy={CX}
          r={RING_R}
          className="hud-aim-ring-bg"
          fill="none"
          strokeWidth="3"
        />
        <circle
          cx={CX}
          cy={CX}
          r={RING_R}
          className="hud-aim-ring-energy"
          fill="none"
          stroke={stroke}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={RING_C}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${CX} ${CX})`}
        />
        <circle
          cx={CX}
          cy={CX}
          r={4}
          className="hud-aim-dot"
          fill="none"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}
