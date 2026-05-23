/** Arena — hexagonal Neon Foundry */
export const ARENA = {
  hexRadius: 64,
  wallHeight: 44,
  wallThickness: 1.2,
  /** Flat octagon cap on center platform */
  octagonTopRadius: 11,
  /** Outer edge of ramp slopes down to arena floor */
  octagonSlopeRadius: 28,
  /** Center deck height — all platforms (1.5× original) */
  platformTopHeight: 4.575,
  /** Top/bottom hex corners (field midline, x ≈ 0) — 2× footprint */
  midWallOctagonSizeScale: 2,
  floorY: 0,
  /** Black drop tube — world Y of cylinder center (high in arena) */
  ballDropCylinderCenterY: 34,
  ballDropCylinderRadius: 3.1,
  ballDropCylinderHeight: 11,
  /** Spawn inset from top inside the drop tube (m) */
  ballDropSpawnInset: 1.2,
  /** Point + emissive rings around the drop tube */
  ballDropLightCount: 8,
  ballDropLightRadius: 3.85,
} as const;

export const BALL_SPAWN = { x: 0, y: 2.05, z: 0 } as const;

/** Red defends −X (left), blue defends +X (right) — matches goals.getTeamSpawn() */
export const TEAM_SPAWN = {
  red: { x: -39.8, y: 2, z: 0 },
  blue: { x: 39.8, y: 2, z: 0 },
} as const;

/** Fall-through detection & recovery */
export const FALL_RECOVERY = {
  recordInterval: 0.12,
} as const;

/** Practice bots (enemy team vs local player) */
export const BOT = {
  walkSpeed: 8.5,
  sprintSpeed: 11.5,
  jumpForce: 14,
  doubleJumpForce: 11,
  groundAccel: 16,
  aimSmoothing: 11,
  airControl: 0.9,
  maxJumps: 2,
  beamDrain: 12,
  /** Bot beam = tuning pullStrength × this (player uses 1.0) */
  beamPullScale: 0.78,
  /** Red/blue enemy bots — stronger beam to win loose ball */
  enemyBeamPullScale: 1.12,
  /** Teammate bot: only beam when ball is on/near the floor (not mid-air shots) */
  allyBeamMaxHeightAboveFloor: 2.6,
  allyBeamLowMaxHeight: 1.1,
  allyBeamMaxVerticalSpeed: 5.5,
  allyBeamMaxSpeedForBeam: 24,
  /** Brief latch before pass / shot / loft */
  releaseMinHoldSec: 0.12,
  /** After pass/shoot — no beam pull or capture */
  postReleaseBeamCooldownSec: 2,
  /** Dribble before release roll when far from the net */
  holdCarryMinSec: 1.75,
  /** 50/50 goal vs teammate movement while carrying (if teammate exists) */
  holdCarryTeammateChance: 0.5,
  /** After holdCarryMinSec — shoot / keep carrying / pass */
  holdReleaseShootChance: 0.58,
  holdReleaseCarryChance: 0.14,
  holdReleasePassChance: 0.28,
  /** Absolute max seconds holding (forces shoot if still carrying) */
  holdMaxCarrySec: 8,
  shootMinHoldSec: 0.14,
  holdSetupMaxSec: 0.5,
  holdShootAfterJumpSec: 0.15,
  holdForceShootSec: 0.4,
  holdForceLooseShootSec: 0.2,
  holdFarDecisionSec: 0.35,
  goalQuickShotDist: 26,
  quickShotMinHoldSec: 0.14,
  /** Distance bands for release odds (m from enemy goal center) */
  releaseCloseDist: 14,
  releaseMidDist: 24,
  releaseFarDist: 34,
  holdSprintSpeedScale: 0.92,
  /** Lateral weave while dribbling toward goal */
  carryStrafeAmplitude: 5.5,
  carryStrafeHz: 0.32,
  carryAdvanceStep: 11,
  /** ~50 ft — prefer looking at goal (or closer teammate) inside this range */
  carryNearGoalLookDist: 15.24,
  /** Min seconds to keep near-goal look focus (stops teammate/goal flicker) */
  carryNearGoalLookHoldSec: 1.35,
  /** Seconds to hold a far-carry look focus before switching */
  carryLookFocusHoldSec: 2.6,
  /** World-space blend toward the active carry look point */
  carryLookPointSmooth: 2.4,
  /** Slower aim blend while carrying (more natural head turn) */
  carryAimSmoothing: 4,
  /** Slower ball follow while bots carry (reduces side-to-side jerk) */
  holdBotFollowSmooth: 14,
  holdSocketTargetSmooth: 3.2,
  launchForce: 24,
  launchUp: 4.5,
  /** Extra look pitch on goal shots (degrees) */
  shotPitchOffsetDeg: 10,
  /** Offensive cylinder at enemy net (~120 ft diameter × 1.5) */
  shootZoneRadiusM: ((120 * 0.3048) / 2) * 1.5,
  modeRunPlayerDist: 38,
  /** Max seconds chasing the player (runToPlayer / moveAndShoot) without them holding */
  followPlayerBurstSec: 5,
  /** Cooldown before another player-chase burst */
  followPlayerCooldownSec: 20,
  /** While chasing the player — harass rockets (non-explosive) */
  followPlayerProjectileIntervalSec: 1.25,
  /** While chasing — explosive rocket at player */
  followPlayerRocketIntervalSec: 1,
  followPlayerRocketChance: 0.5,
  /** Min gap between any follow-mode rockets (harass + explosive) */
  followPlayerRocketCooldownSec: 1,
  /** Aim offset as fraction of distance to target (1%–10%) */
  followPlayerAimErrorMinPct: 0.01,
  followPlayerAimErrorMaxPct: 0.1,
  moveShootPlayerDist: 48,
  moveShootBias: 0.62,
  shootZoneHeightM: 22,
  shootZoneVisualOpacity: 0.26,
  shootZoneCapOpacity: 0.22,
  shootZoneEdgeOpacity: 0.72,
  shootZoneInsetFromWall: 7,
  /** Teammate in shoot zone with ball — only this often beam-steal (else give space) */
  allyShootZoneMagnetChance: 0.3,
  /** After a teammate's goal shot, wait before beaming the ball */
  allyWaitAfterTeammateShotSec: 3,
  /** How long pass/shot intent stays visible to teammates */
  teamReleaseSignalTTL: 6,
  /** Stand-off distance when not magneting onto shooter */
  allyShootZoneGiveSpaceM: 11,
  /** Depth (m) of steer volume along each goal back wall (~32 ft) */
  backWallEscapeDepthM: 32 * 0.3048,
  /** Half-width along Z for back-wall escape boxes */
  backWallEscapeHalfWidthZ: 48,
  /** Stay at least this far from the goal end face (~15 ft) */
  backWallKeepOutFromWallM: 15 * 0.3048,
  backWallKeepOutHalfWidthZ: 48,
  backWallEscapeVisualOpacity: 0.1,
  backWallEscapeCooldownSec: 0.35,
  /** Pass / loft arc — keeps lobs out of the floor */
  passLoftYOffset: 5.5,
  passLoftPerMeter: 0.16,
  passLaunchUpMult: 2.35,
  loftLaunchUpMult: 2.6,
  shootLaunchUpMult: 1.2,
  /** Random spread on carried-ball passes / goal shots (m) */
  ballLaunchAimErrorM: 2.1,
  /** Launch speed variance (±) */
  ballLaunchForceJitter: 0.14,
  celebrateCenterX: 0,
  celebrateCenterZ: 0,
  celebrateRadius: 5,
  spacingX: 32,
  spawnZOffset: 8,
  chaseRadius: 55,
  rocketHitRadius: 1.35,
  minBotSeparation: 7,
  separationWeight: 1.35,
  flankOffset: 9,
  /** Lane spread for paired bots chasing the same ball */
  chaseLaneScale: 1.65,
  /**
   * Ball engagement (dist = BALL.radius × radii).
   * Chase / contest only inside chase radii; beam only inside attract radii.
   */
  ballChaseBallRadii: 18,
  ballAttractBallRadii: 10,
  /** Only rocket / harass local player when this close and they hold the ball */
  playerRocketCloseDist: 20,
  botRocketCooldownSec: 0.85,
  botRocketIntervalSec: 1.05,
  /** Extra knockback when bot rockets hit the local player */
  botRocketOnPlayerForceScale: 1.25,
  /** Carry: advance to goal, jump, shoot (never at player) */
  goalAdvanceMaxDist: 42,
  goalShootMaxDist: 36,
  goalShootCloseDist: 28,
  goalSetupJumpDist: 24,
  /** Beyond this = “far” for pass / loft decisions */
  passToTeammateMaxDist: 26,
  passPreferDist: 16,
  passHoldMinSec: 0.28,
  passToTeammateCooldownSec: 0.35,
  passToTeammateChance: 0.74,
  passChanceFar: 0.7,
  passChanceMid: 0.55,
  passChanceBase: 0.35,
  passTeammateCloserBias: 2.5,
  /** Hysteresis: teammate must be this much closer to steal near-goal look */
  passTeammateLookExitBias: 5.5,
  passMinDistFromGoal: 4,
  looseShootChanceFar: 0.4,
  looseShootChanceMid: 0.34,
  looseShootMinHoldSec: 0.15,
  /** Loft only when farther than rim range */
  goalShootMinLooseDist: 14,
  /** Knockback from rockets (explosion + direct hit) */
  rocketKnockForce: 18,
  rocketKnockUp: 9,
  /** Min seconds on ground before a hop roll (~70% run / ~30% jump) */
  groundJumpIntervalSec: 1.1,
  chaseJumpIntervalSec: 1.45,
  /** Chance to hop when interval elapses while chasing */
  chaseJumpChance: 0.3,
  /** Chance a chase hop chains into double jump */
  chaseDoubleJumpChance: 0.42,
  /** Extra delay variance after each hop (0–1 × interval) */
  jumpIntervalJitter: 0.4,
  /** Seconds after a ground jump before the double jump */
  doubleJumpDelaySec: 0.18,
  /** Hop cadence while carrying */
  carryJumpIntervalSec: 1.35,
  carryJumpChance: 0.26,
  /** Reactive hop when ball is above chest */
  ballAboveJumpChance: 0.5,
  /** Wall stuck: min horizontal move (m) to reset timer */
  stuckMoveThreshold: 0.55,
  stuckTimeSec: 1.05,
  stuckEscapeCooldownSec: 2.2,
  stuckEscapePush: 12,
  stuckBoundaryMargin: 4,
  /** Seconds before floor grounded checks resume after a jump */
  jumpAirGraceSec: 0.5,
  /** Lift body on jump so the capsule clears the floor */
  jumpLiftY: 0.14,
  /** Ally bot only — periodic harass rockets */
  periodicProjectileIntervalSec: 5.5,
  periodicFireAtLooseBallChance: 0.1,
  periodicFireAtPlayerCarrierChance: 0.2,
  periodicFireAtBotCarrierChance: 0.08,
  periodicProjectileBallBias: 0.12,
  periodicProjectilePlayerBias: 0.35,
  /** Enemy team: every N sec, chance one bot fires at ball or player */
  enemyRocketVolleyIntervalSec: 10,
  enemyRocketVolleyChance: 0.5,
  /** Random aim offset (m) — lowers direct hit rate */
  rocketAimErrorM: 3.2,
} as const;

/** Third-person camera */
export const CAMERA = {
  distance: 7,
  height: 1.2,
  pivotHeight: 1.5,
  shoulderOffset: 0,
  lookAhead: 24,
  smooth: 20,
  /** Min height above arena floor (m) */
  groundClearance: 0.55,
  /** Stop camera this far before geometry along pivot→cam ray */
  collisionPadding: 0.45,
  /** Max meters camera may sit below pivot (looking up) */
  maxDropBelowPivot: 2.6,
  /** How much vertical offset follows aim pitch (lower = less ground dip) */
  verticalInfluence: 0.55,
  /** Ignore mouse deltas briefly after pointer lock (browser spike) */
  lockWarmupMs: 220,
  maxMouseDelta: 90,
  mouseSensitivityX: 0.0026,
  mouseSensitivityY: 0.002,
} as const;

/** Aim pitch (full range for shooting) */
export const AIM = {
  defaultPitch: 0.1,
  pitchMin: -1.15,
  pitchMax: 1.15,
} as const;

/** Player movement */
export const MOVEMENT = {
  walkSpeed: 9.5,
  sprintSpeed: 14,
  jumpForce: 18,
  doubleJumpForce: 14,
  maxJumps: 2,
  gravity: -11,
  airControl: 0.95,
  jumpMomentumBoost: 1.12,
  groundAccel: 22,
  capsuleHeight: 1.8,
  capsuleRadius: 0.35,
  /** Max gap (m) between feet and surface to count as grounded */
  groundProbeDist: 0.62,
  /** |vy| must be below this to land (higher while carrying ball) */
  groundMaxVerticalSpeed: 11,
  groundMaxVerticalSpeedWithBall: 12,
  /** After jumping, ignore ground probe briefly */
  jumpAirGraceSec: 0.32,
  /** Rocket blast — do not treat high vy as a space jump; refill air jumps */
  rocketKnockGraceSec: 0.5,
  /** Can still jump shortly after leaving ground */
  coyoteTimeSec: 0.14,
  /** Auto step-up onto platform lips / ramp edges */
  stepHeight: 0.48,
  stepProbeAhead: 0.42,
  /** Small upward nudge so capsule clears floor on jump */
  jumpLiftY: 0.12,
} as const;

/** Energy */
export const ENERGY = {
  max: 100,
  sprintDrain: 14,
  beamDrain: 17,
  /** No drain while carrying — beam only costs energy while pulling */
  holdBallDrain: 0,
  regen: 26,
  regenDelay: 0.75,
  minBeam: 15,
} as const;

/** Ball */
export const BALL = {
  radius: 1.6,
  mass: 30,
  restitution: 0.31,
  friction: 0.24,
  linearDamping: 0.022,
  angularDamping: 0.07,
  /** Roll rate scale on LMB / bot release (ω ≈ v/R) */
  launchSpinScale: 0.78,
  /** Scales world gravity on the ball (1 = match arena gravity) */
  gravityScale: 1,
  maxSpeed: 80,
  holdDistance: 1.8,
  throwForce: 18,
  launchForce: 20,
  /** Pre-launch carrier velocity: 4 samples over this window (seconds) */
  launchMomentumWindowSec: 0.5,
  launchMomentumSampleCount: 4,
  launchSpawnOffset: 3.2,
  /** Extra clearance beyond capsule when releasing (avoids snagging on player) */
  launchClearancePad: 0.55,
  /** Skip player–ball separation push right after a shot */
  postLaunchSeparationGraceSec: 0.35,
  /** After drop/shot — blocks beam grab and pull on loose ball */
  beamRegrabLockSec: 0.35,
  spawnCooldownSec: 1.2,
  /** Smooth snap when ball first latches to hold socket */
  holdLatchDurationSec: 0.24,
  holdLatchSmooth: 16,
  holdFollowSmooth: 26,
  /** Aim smoothing while carrying — lower = snappier */
  holdSocketTargetSmooth: 8,
  /** How long Space stays buffered if jump was early (seconds) */
  jumpBufferSec: 0.28,
} as const;

/** Magnetic beam */
export const BEAM = {
  range: 42,
  captureDistance: 5.2,
  /** Must be this close to lock after winning tug-of-war */
  tightCaptureDistance: 3.55,
  botTightCaptureDistance: 3.35,
  botCaptureReachScale: 1.28,
  botMinCapturePull: 0.14,
  botCaptureDominanceRatio: 0.34,
  /** Ball center within this of body/chest counts as touching */
  contactStickDistance: BALL.radius + MOVEMENT.capsuleRadius + 0.55,
  contactChestDistance: BALL.radius + 0.75,
  /** Legacy hint band for “pulled” UI */
  contactCaptureDistance:
    BALL.radius + MOVEMENT.capsuleRadius + 1.35,
  maxContactCaptureSpeed: 44,
  /** Soft lock-in before full capture */
  stickyAttachDistance: 4.2,
  stickyAttachSpeed: 14,
  /** Beam tug-of-war */
  contestDecay: 9,
  minContestGlow: 0.12,
  minCapturePull: 0.28,
  captureDominanceRatio: 0.48,
  captureLeadRatio: 1.12,
  contestTieRatio: 0.62,
  /** Acceleration toward puller (m/s²) while beaming */
  pullAccel: 39,
  pullVerticalAssist: 7,
  pullCounterAway: 0.95,
  pullMaxDeltaPerFrame: 34,
  /** Extra pull when close — scales up sharply near contact (full beam range) */
  closePullBoost: 1.42,
  /** Center distance for max close boost (~2 ball diameters / ~21 ft) */
  closePullDistance: BALL.radius * 4,
  /** Pull multiplier at contact inside closePullDistance (rest of beam unchanged) */
  closePullStrengthMult: 1.5,
  spinDamp: 3.4,
  maxCaptureSpeed: 34,
  maxPullEffectSpeed: 68,
  holdDistance: 3.2,
  chestHeight: 1.15,
} as const;

/** Rocket */
export const ROCKET = {
  /** Min seconds between rocket clicks (click-paced rapid fire) */
  cooldown: 0.05,
  /** Hold LMB this long to fire a bouncer (tap release = explosive) */
  chargedHoldSec: 0.14,
  /** Max rockets from local player in flight at once */
  maxActive: 8,
  speed: 144,
  velocityInherit: 1,
  maxSpeed: 210,
  surfaceBounces: 2,
  bounceRestitution: 0.68,
  ownerGraceSec: 0.18,
  /** Must leave muzzle sphere before it can detonate on the shooter */
  minTravelBeforePlayerHit: 4,
  /** Same for ball hits — stops instant detonate when firing past a nearby ball */
  minTravelBeforeBallHit: 3.2,
  explosionRadius: 7,
  /** No beam on ball / bots inside this radius after a rocket blast */
  beamDenyRadius: 7,
  beamDenyDurationSec: 1,
  explosionVisualDuration: 0.38,
  playerForce: 14,
  rocketJumpUp: 13,
  ballForce: 62,
  /** Direct rocket→ball: fraction of rocket speed added along travel axis */
  ballRocketMomentumTransfer: 0.62,
  ballVelocityInherit: 0.9,
  ballMinKnockSpeed: 26,
  /** 0–1 blend toward knock velocity */
  ballKnockBlend: 0.94,
  ballUpBoost: 11,
  ballSplashMinFalloff: 0.52,
  /** Extra knock when ball is off the ground (units above floor + radius) */
  ballAirMinHeight: 1.0,
  ballAirKnockMult: 1.55,
  ballAirVelocityInheritMult: 1.4,
  ballAirUpMult: 1.35,
  playerHitRadius: 1.4,
  energyDamageDirect: 35,
  energyDamageSplashMin: 10,
  energyDamageSplashMax: 25,
  lifetime: 3,
} as const;

/** Match */
export const MATCH = {
  durationSec: 300,
  scoreLimit: 30,
  scorePauseSec: 1,
  /** 3-2-1 before kickoff and after each goal */
  startCountdownSec: 3,
  resetCountdownSec: 3,
} as const;

/** Goal point values (bottom / middle / top ring) */
export const GOAL_POINTS = {
  large: 1,
  medium: 2,
  small: 5,
} as const;

/** Vertical ring goals on end walls */
export const GOAL_RINGS = {
  baseRadius: 7.6,
  tierScale: 0.7,
  /**
   * Side-view tilt (degrees, CCW +): bottom ring up toward ceiling,
   * middle face-on, top ring opposite.
   */
  ringTiltBottomDeg: -20,
  ringTiltMidDeg: 0,
  ringTiltTopDeg: 20,
  /** Only count when ball center is inside this fraction of ring radius */
  centerScoreRadiusScale: 0.62,
  /** Minimum gap between ring outer edges (m) */
  ringGap: 0.75,
  /** Center of bottom ring above floor (lifted off ground) */
  floorClearance: 3.75,
  /** Torus tube thickness relative to ring radius */
  tubeScale: 0.14,
  tubeMin: 0.24,
  emissiveIntensity: 4.6,
  glowTubeScale: 1.45,
  glowOpacity: 0.42,
  torusRadialSegments: 20,
  torusTubularSegments: 40,
  /** Distance from flat end face toward arena center (rings stay visible in play space) */
  faceInsetFromWall: 1.6,
  sensorDepth: 1.85,
} as const;

/** Renderer / lighting */
export const RENDER = {
  dprMin: 1,
  dprMax: 1.35,
  antialias: true,
  enableShadows: true,
  shadowMapSize: 1536,
  shadowCameraSpan: 78,
  shadowCameraFar: 150,
  /** PCF soft shadow blur (directional) */
  shadowRadius: 5,
  beamTubeSegments: 48,
  beamTubeRadial: 4,
  beamTraceLayers: 4,
  hexFloorTileStep: 10,
  ballPolkaTextureSize: 256,
  rocketMaxSmoke: 56,
  /** Smoke puff spacing along flight path (m) */
  rocketTrailStep: 0.16,
  rocketTrailBehind: 0.05,
  goalFireworkParticles: 48,
} as const;
