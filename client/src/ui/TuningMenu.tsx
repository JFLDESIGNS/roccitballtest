import { useSyncExternalStore } from 'react';
import { gameStore } from '../game/gameStore';
import {
  tuningStore,
  TUNING_TABS,
  type TuningTabId,
} from '../game/tuningStore';
import { MOVEMENT } from '../shared/Constants';
import { BrightnessControls } from './BrightnessControls';
import { GraphicsControls } from './GraphicsControls';

const TUNING_SPRINT_RATIO = MOVEMENT.sprintSpeed / MOVEMENT.walkSpeed;

type SliderRowProps = {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
};

function SliderRow({
  label,
  hint,
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
      {hint ? <p className="tuning-sub">{hint}</p> : null}
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

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="tuning-toggle-row">
      <div className="tuning-row-head">
        <span>{label}</span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
      </div>
      {hint ? <p className="tuning-sub">{hint}</p> : null}
    </label>
  );
}

function SelectRow<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="tuning-row menu-option">
      <div className="tuning-row-head">
        <span>{label}</span>
      </div>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <p className="tuning-sub">{hint}</p> : null}
    </label>
  );
}

function TabPanel({ tab, tune }: { tab: TuningTabId; tune: ReturnType<typeof tuningStore.getState> }) {
  const showGoalZones = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().showGoalZoneDebug,
  );
  const playerVisualProxy = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().playerVisualProxy,
  );
  const showPhysicsBall = useSyncExternalStore(
    gameStore.subscribe,
    () => gameStore.getState().showPhysicsBall,
  );

  switch (tab) {
    case 'player':
      return (
        <>
          <ToggleRow
            label="Smooth player model (proxy)"
            hint="On = silky follow visual. Off = model locked to physics capsule. Press 4 in-game."
            checked={playerVisualProxy}
            onChange={gameStore.setPlayerVisualProxy}
          />
          <ToggleRow
            label="Show physics ball"
            hint="Shows the real ball mesh instead of the loose proxy. Press 2 in-game."
            checked={showPhysicsBall}
            onChange={(v) => gameStore.setShowPhysicsBall(v)}
          />
          <ToggleRow
            label="WW dash (double-tap W)"
            hint="Off by default. Forward burst when you double-tap W."
            checked={tune.wwDashEnabled}
            onChange={tuningStore.setWwDashEnabled}
          />
          <SliderRow
            label="Jump height"
            value={tune.jumpForce}
            min={6}
            max={32}
            step={0.5}
            onChange={tuningStore.setJumpForce}
          />
          <SliderRow
            label="Walk speed"
            value={tune.walkSpeed}
            min={3}
            max={22}
            step={0.5}
            onChange={tuningStore.setWalkSpeed}
            format={(v) =>
              `${v.toFixed(1)} (sprint ${(v * TUNING_SPRINT_RATIO).toFixed(1)})`
            }
          />
          <SliderRow
            label="Mouse sensitivity"
            value={tune.mouseSensitivity}
            min={0.25}
            max={2}
            step={0.05}
            onChange={tuningStore.setMouseSensitivity}
            format={(v) => `${(v * 100).toFixed(0)}%`}
          />
          <SliderRow
            label="Gravity"
            value={tune.gravity}
            min={-24}
            max={-3}
            step={0.5}
            onChange={tuningStore.setGravity}
          />
          <SliderRow
            label="Fall speed"
            hint="Only affects downward motion — jump height and pads stay the same. 2× = heavier drop."
            value={tune.fallGravityMult}
            min={1}
            max={4}
            step={0.1}
            onChange={tuningStore.setFallGravityMult}
            format={(v) => `${v.toFixed(1)}×`}
          />
        </>
      );
    case 'rockets':
      return (
        <>
          <ToggleRow
            label="Bouncy rockets (hold LMB)"
            hint="Off = only explosive tap shots. Saved automatically."
            checked={tune.bouncyRocketsEnabled}
            onChange={tuningStore.setBouncyRocketsEnabled}
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
            label="Ball knock strength"
            value={tune.ballKnockStrength}
            min={0.1}
            max={4}
            step={0.05}
            onChange={tuningStore.setBallKnockStrength}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </>
      );
    case 'ball':
      return (
        <>
          <SelectRow
            label="Ball type"
            hint="Superball deflects sideways on glancing rocket hits; rear-center hits still fly forward."
            value={tune.ballType}
            options={[
              { value: 'original', label: 'Original ball' },
              { value: 'superball', label: 'Superball' },
            ]}
            onChange={tuningStore.setBallType}
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
            label="Hold rocket immunity"
            hint="After grabbing the ball, rockets can't knock it loose from your body or the ball for this long."
            value={tune.holdConnectImmunitySec}
            min={0}
            max={3}
            step={0.1}
            onChange={tuningStore.setHoldConnectImmunitySec}
            format={(v) => `${v.toFixed(1)}s`}
          />
          <h3 className="tuning-section">Carry ball visual</h3>
          <SliderRow
            label="Hold reach (extra)"
            hint="How far the smooth carry ball sits beyond the hold socket."
            value={tune.holdVisualExtraReachM}
            min={0}
            max={2.5}
            step={0.02}
            onChange={tuningStore.setHoldVisualExtraReachM}
            format={(v) => `${v.toFixed(2)} m`}
          />
          <SliderRow
            label="Carry lag smooth"
            hint="Higher = snappier follow; lower = softer trailing attach."
            value={tune.holdVisualLagSmooth}
            min={4}
            max={60}
            step={1}
            onChange={tuningStore.setHoldVisualLagSmooth}
            format={(v) => v.toFixed(1)}
          />
          <h3 className="tuning-section">Loose proxy ball</h3>
          <SliderRow
            label="Physics jitter filter"
            hint="Smooths raw body position before display follow. Lower = silkier, higher = tighter."
            value={tune.looseVisualTargetSmooth}
            min={4}
            max={120}
            step={1}
            onChange={tuningStore.setLooseVisualTargetSmooth}
            format={(v) => v.toFixed(0)}
          />
          <SliderRow
            label="Display follow"
            hint="How fast the visible ball catches the filtered path. Press 2 to show physics ball (yellow P)."
            value={tune.looseVisualPosSmooth}
            min={4}
            max={120}
            step={1}
            onChange={tuningStore.setLooseVisualPosSmooth}
            format={(v) => v.toFixed(0)}
          />
          <SliderRow
            label="Spin follow"
            hint="Rotation smoothing — higher tracks physics spin more closely."
            value={tune.looseVisualRotSmooth}
            min={8}
            max={160}
            step={1}
            onChange={tuningStore.setLooseVisualRotSmooth}
            format={(v) => v.toFixed(0)}
          />
          <SliderRow
            label="Max trail distance"
            hint="Gentle extra catch-up if the proxy trails too far (m)."
            value={tune.looseVisualMaxLagM}
            min={0.05}
            max={2}
            step={0.02}
            onChange={tuningStore.setLooseVisualMaxLagM}
            format={(v) => `${v.toFixed(2)} m`}
          />
          <SliderRow
            label="High-speed follow boost"
            hint="Extra follow on fast shots — lower can look smoother."
            value={tune.looseVisualSpeedBoostMax}
            min={0}
            max={32}
            step={1}
            onChange={tuningStore.setLooseVisualSpeedBoostMax}
            format={(v) => v.toFixed(0)}
          />
          <h3 className="tuning-section">Hold &amp; release shot</h3>
          <SelectRow
            label="Release system"
            hint="Super release inherits movement like classic Rokkit Ball; classic uses swing + carry momentum."
            value={tune.releaseSystem}
            options={[
              { value: 'superrelease', label: 'Super release (default)' },
              { value: 'classic', label: 'Classic release' },
            ]}
            onChange={tuningStore.setReleaseSystem}
          />
          {tune.releaseSystem === 'superrelease' ? (
            <>
              <SliderRow
                label="Shot strength"
                hint="Multiplies super release throw power on LMB."
                value={tune.superReleaseShotStrength}
                min={0.25}
                max={2.5}
                step={0.05}
                onChange={tuningStore.setSuperReleaseShotStrength}
                format={(v) => `${Math.round(v * 100)}%`}
              />
              <SliderRow
                label="Inherited player speed"
                value={tune.superReleaseInheritedVel}
                min={0}
                max={1.2}
                step={0.05}
                onChange={tuningStore.setSuperReleaseInheritedVel}
                format={(v) => `${Math.round(v * 100)}%`}
              />
              <SliderRow
                label="Throw power"
                value={tune.superReleaseThrowPower}
                min={6}
                max={48}
                step={1}
                onChange={tuningStore.setSuperReleaseThrowPower}
                format={(v) => `${v.toFixed(0)} m/s`}
              />
              <SliderRow
                label="Arc lift"
                value={tune.superReleaseArcLift}
                min={-6}
                max={12}
                step={0.25}
                onChange={tuningStore.setSuperReleaseArcLift}
                format={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)} m/s`}
              />
              <SliderRow
                label="Hold forward offset"
                value={tune.superReleaseForwardOffset}
                min={0.5}
                max={4}
                step={0.1}
                onChange={tuningStore.setSuperReleaseForwardOffset}
                format={(v) => `${v.toFixed(1)} m`}
              />
              <SliderRow
                label="Hold height"
                value={tune.superReleaseUpOffset}
                min={0.4}
                max={2.5}
                step={0.05}
                onChange={tuningStore.setSuperReleaseUpOffset}
                format={(v) => `${v.toFixed(2)} m`}
              />
              <SliderRow
                label="Thrower no-collide window"
                value={tune.superReleaseThrowerGraceSec}
                min={0.05}
                max={0.6}
                step={0.05}
                onChange={tuningStore.setSuperReleaseThrowerGraceSec}
                format={(v) => `${v.toFixed(2)}s`}
              />
              <SliderRow
                label="Short arc (extra lift)"
                value={tune.shortArc}
                min={-18}
                max={18}
                step={0.25}
                onChange={tuningStore.setShortArc}
                format={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)} m/s`}
              />
            </>
          ) : (
            <>
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
                label="Short arc (vertical lift)"
                value={tune.shortArc}
                min={-18}
                max={18}
                step={0.25}
                onChange={tuningStore.setShortArc}
                format={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)} m/s`}
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
              <h3 className="tuning-section">Beam release (RMB)</h3>
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
            </>
          )}
        </>
      );
    case 'bots':
      return (
        <>
          <p className="tuning-sub">
            Bot pressure scales many behaviors below. Settings persist between sessions.
          </p>
          <SliderRow
            label="Bot pressure"
            value={tune.botPressure}
            min={0.25}
            max={2}
            step={0.05}
            onChange={tuningStore.setBotPressure}
            format={(v) => {
              if (Math.abs(v - 1) < 0.03) return 'Normal (1.0)';
              if (v < 1) return `Easier (${v.toFixed(2)})`;
              return `Harder (${v.toFixed(2)})`;
            }}
          />
          <SliderRow
            label="Bot walk / sprint scale"
            value={tune.botWalkSpeedScale}
            min={0.5}
            max={1.5}
            step={0.05}
            onChange={tuningStore.setBotWalkSpeedScale}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <SliderRow
            label="Bot shot power scale"
            value={tune.botLaunchForceScale}
            min={0.5}
            max={1.5}
            step={0.05}
            onChange={tuningStore.setBotLaunchForceScale}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <SliderRow
            label="Bot beam pull (base)"
            value={tune.botBeamPullScale}
            min={0.4}
            max={1.4}
            step={0.02}
            onChange={tuningStore.setBotBeamPullScale}
          />
          <SliderRow
            label="Bot beam capture latch"
            value={tune.botBeamCaptureLatchSec}
            min={0.1}
            max={2}
            step={0.05}
            onChange={tuningStore.setBotBeamCaptureLatchSec}
            format={(v) => `${v.toFixed(2)}s`}
          />
          <SliderRow
            label="Ally bot beam scale"
            value={tune.botAllyBeamScale}
            min={0.5}
            max={1.6}
            step={0.02}
            onChange={tuningStore.setBotAllyBeamScale}
          />
          <SliderRow
            label="Enemy bot beam scale"
            value={tune.botEnemyBeamScale}
            min={0.5}
            max={1.6}
            step={0.02}
            onChange={tuningStore.setBotEnemyBeamScale}
          />
          <SliderRow
            label="Bot rocket aim error (m)"
            value={tune.botRocketAimErrorM}
            min={2}
            max={14}
            step={0.2}
            onChange={tuningStore.setBotRocketAimErrorM}
          />
          <SliderRow
            label="Bot ball shot aim error (m)"
            value={tune.botBallLaunchAimErrorM}
            min={1}
            max={8}
            step={0.2}
            onChange={tuningStore.setBotBallLaunchAimErrorM}
          />
          <SliderRow
            label="Chase rocket chance"
            value={tune.botFollowRocketChance}
            min={0.05}
            max={0.85}
            step={0.02}
            onChange={tuningStore.setBotFollowRocketChance}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <SliderRow
            label="Enemy volley chance"
            value={tune.botEnemyVolleyChance}
            min={0.05}
            max={0.85}
            step={0.02}
            onChange={tuningStore.setBotEnemyVolleyChance}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <SliderRow
            label="Shoot player with ball"
            value={tune.botPlayerCarrierShotChance}
            min={0.05}
            max={0.95}
            step={0.02}
            onChange={tuningStore.setBotPlayerCarrierShotChance}
            format={(v) => `${Math.round(v * 100)}% per bot roll`}
          />
        </>
      );
    case 'arena':
      return (
        <>
          <ToggleRow
            label="Show goal zone volumes"
            hint="Scoring sensors, shoot zone, and net-finish cylinders (debug only)."
            checked={showGoalZones}
            onChange={gameStore.setShowGoalZoneDebug}
          />
          <SliderRow
            label="Trampoline strength"
            value={tune.trampolineStrength}
            min={0.5}
            max={15}
            step={0.25}
            onChange={tuningStore.setTrampolineStrength}
            format={(v) => `${v.toFixed(1)}×`}
          />
          <p className="tuning-sub">
            Jump pads — height &amp; launch power. Rockets bounce off the concrete deck.
          </p>
        </>
      );
    case 'brightness':
      return <BrightnessControls compact />;
    case 'graphics':
      return <GraphicsControls compact />;
    case 'audio':
      return (
        <>
          <SliderRow
            label="Master volume"
            value={tune.masterVolume}
            min={0}
            max={1}
            step={0.05}
            onChange={tuningStore.setMasterVolume}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <p className="tuning-sub">
            Scales all game audio — match music, jumps, fan-glass crowd, shots,
            impacts, beam, and goal stings (per-sound sliders multiply on top).
          </p>
          <SliderRow
            label="Shot / launch volume"
            value={tune.shotVolume}
            min={0}
            max={1}
            step={0.05}
            onChange={tuningStore.setShotVolume}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <p className="tuning-sub">
            Ball release &amp; rocket fire (shot.flac).
          </p>
          <SliderRow
            label="Goal score sting (goal1)"
            value={tune.goal1Volume}
            min={0}
            max={1}
            step={0.05}
            onChange={tuningStore.setGoal1Volume}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <p className="tuning-sub">
            Short horn when a goal registers (default 55% — stacks with crowd cheer).
          </p>
          <SliderRow
            label="Fan glass crowd (cheer / panic)"
            value={tune.fanGlassCrowdVolume}
            min={0}
            max={1.5}
            step={0.05}
            onChange={tuningStore.setFanGlassCrowdVolume}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <p className="tuning-sub">
            Home cheer and away panic when rockets hit stand glass (default 65%, up to 150%).
          </p>
          <SliderRow
            label="Hit reward ching"
            value={tune.chingVolume}
            min={0}
            max={1}
            step={0.05}
            onChange={tuningStore.setChingVolume}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <p className="tuning-sub">
            Plays when your shot connects with a bot.
          </p>
          <SliderRow
            label="Projectile impact"
            value={tune.impactVolume}
            min={0}
            max={1}
            step={0.05}
            onChange={tuningStore.setImpactVolume}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </>
      );
    default:
      return null;
  }
}

export function TuningMenu() {
  const tune = useSyncExternalStore(tuningStore.subscribe, tuningStore.getState);

  if (!tune.showMenu) return null;

  return (
    <div className="tuning-menu">
      <div className="tuning-panel tuning-panel-wide">
        <div className="tuning-panel-header">
          <h2>Gameplay tuning</h2>
          <p className="tuning-sub">
            Press <kbd>1</kbd> to close · opens <strong>Brightness</strong> tab · settings save
            automatically
          </p>
        </div>

        <div className="tuning-tabs" role="tablist">
          {TUNING_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tune.menuTab === t.id}
              className={`tuning-tab${tune.menuTab === t.id ? ' tuning-tab-active' : ''}`}
              onClick={() => tuningStore.setMenuTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="tuning-panel-scroll" role="tabpanel">
          <TabPanel tab={tune.menuTab} tune={tune} />
        </div>

        <div className="tuning-panel-footer">
          <button
            type="button"
            className="tuning-reset"
            onClick={() => tuningStore.resetDefaults()}
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}
