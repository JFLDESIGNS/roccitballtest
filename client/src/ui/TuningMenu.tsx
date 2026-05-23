import { useSyncExternalStore } from 'react';
import { tuningStore } from '../game/tuningStore';

type SliderRowProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
};

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => v.toFixed(1),
}: SliderRowProps) {
  return (
    <label className="tuning-row">
      <div className="tuning-row-head">
        <span>{label}</span>
        <span className="tuning-value">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

export function TuningMenu() {
  const tune = useSyncExternalStore(tuningStore.subscribe, tuningStore.getState);

  if (!tune.showMenu) return null;

  return (
    <div className="tuning-menu">
      <div className="tuning-panel">
        <div className="tuning-panel-header">
          <h2>Gameplay tuning</h2>
          <p className="tuning-sub">Press <kbd>1</kbd> to close · changes apply live</p>
        </div>

        <div className="tuning-panel-scroll" role="region" aria-label="Tuning options">
        <SliderRow
          label="Jump height"
          value={tune.jumpForce}
          min={6}
          max={32}
          step={0.5}
          onChange={tuningStore.setJumpForce}
        />
        <SliderRow
          label="Player speed"
          value={tune.walkSpeed}
          min={3}
          max={22}
          step={0.5}
          onChange={tuningStore.setWalkSpeed}
          format={(v) => `${v.toFixed(1)} (sprint ${(v * 1.43).toFixed(1)})`}
        />
        <SliderRow
          label="Projectile speed"
          value={tune.rocketSpeed}
          min={40}
          max={240}
          step={1}
          onChange={tuningStore.setRocketSpeed}
          format={(v) => String(Math.round(v))}
        />
        <SliderRow
          label="Beam pull strength"
          value={tune.pullStrength}
          min={0.15}
          max={2.5}
          step={0.05}
          onChange={tuningStore.setPullStrength}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <SliderRow
          label="Ball knock strength"
          value={tune.ballKnockStrength}
          min={0.1}
          max={2}
          step={0.05}
          onChange={tuningStore.setBallKnockStrength}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <h3 className="tuning-section">Ball shot (hold &amp; release)</h3>
        <SliderRow
          label="Base launch power"
          value={tune.baseLaunchForce}
          min={0.2}
          max={2}
          step={0.05}
          onChange={tuningStore.setBaseLaunchForce}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <SliderRow
          label="Swing → shot"
          value={tune.swingToShot}
          min={0}
          max={3}
          step={0.05}
          onChange={tuningStore.setSwingToShot}
          format={(v) => `${v.toFixed(2)}×`}
        />
        <SliderRow
          label="Move speed → shot"
          value={tune.moveSpeedToShot}
          min={0}
          max={3}
          step={0.05}
          onChange={tuningStore.setMoveSpeedToShot}
          format={(v) => `${v.toFixed(2)}×`}
        />
        <SliderRow
          label="Carry momentum → shot"
          value={tune.carryMomentumToShot}
          min={0}
          max={3}
          step={0.05}
          onChange={tuningStore.setCarryMomentumToShot}
          format={(v) => `${v.toFixed(2)}×`}
        />
        <SliderRow
          label="Shot upward boost"
          value={tune.launchUpBoost}
          min={0}
          max={14}
          step={0.5}
          onChange={tuningStore.setLaunchUpBoost}
        />
        <h3 className="tuning-section">Beam release (RMB let go)</h3>
        <p className="tuning-sub">
          Still uses Swing / Carry / Move sliders above when you release with momentum.
        </p>
        <SliderRow
          label="Swing threshold"
          value={tune.releaseSwingMinSpeed}
          min={0}
          max={10}
          step={0.25}
          onChange={tuningStore.setReleaseSwingMinSpeed}
        />
        <SliderRow
          label="Active release scale"
          value={tune.releaseMomentumScale}
          min={0}
          max={1.5}
          step={0.05}
          onChange={tuningStore.setReleaseMomentumScale}
          format={(v) => `${v.toFixed(2)}×`}
        />
        <SliderRow
          label="Idle swing carry"
          value={tune.releaseIdleSwingScale}
          min={0}
          max={0.6}
          step={0.02}
          onChange={tuningStore.setReleaseIdleSwingScale}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <SliderRow
          label="Idle move carry"
          value={tune.releaseIdlePlayerScale}
          min={0}
          max={0.4}
          step={0.02}
          onChange={tuningStore.setReleaseIdlePlayerScale}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <SliderRow
          label="Idle max speed"
          value={tune.releaseIdleMaxSpeed}
          min={0}
          max={8}
          step={0.25}
          onChange={tuningStore.setReleaseIdleMaxSpeed}
        />
        <SliderRow
          label="Active release max speed"
          value={tune.releaseMaxActiveSpeed}
          min={4}
          max={28}
          step={0.5}
          onChange={tuningStore.setReleaseMaxActiveSpeed}
        />
        <SliderRow
          label="Gravity"
          value={tune.gravity}
          min={-24}
          max={-3}
          step={0.5}
          onChange={tuningStore.setGravity}
        />
        <h3 className="tuning-section">Audio</h3>
        <SliderRow
          label="Master volume"
          value={tune.masterVolume}
          min={0}
          max={1}
          step={0.05}
          onChange={tuningStore.setMasterVolume}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <SliderRow
          label="Projectile impact"
          value={tune.impactVolume}
          min={0}
          max={1}
          step={0.05}
          onChange={tuningStore.setImpactVolume}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        </div>

        <div className="tuning-panel-footer">
          <button
            type="button"
            className="tuning-reset"
            onClick={() => tuningStore.resetDefaults()}
          >
            Reset defaults
          </button>
        </div>
      </div>
    </div>
  );
}
