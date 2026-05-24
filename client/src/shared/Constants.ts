/** Arena — hexagonal Neon Foundry */
export const ARENA = {
  hexRadius: 64,
  wallHeight: 43.7,
  /** Ceiling hex sits this far above wall tops (lower = smaller gap; negative clips into walls) */
  ceilingOverlapM: -0.2,
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
  /** Scale for octagonal drum + pizza slices only (cube / TVs stay full size) */
  ballDropDrumScale: 0.6,
  /** Center Y of kickoff drop structure */
  ballDropCenterY: 42.2,
  /** Extra lift for cube + drum above prior height (feet) */
  ballDropRaiseFt: 30,
  /** Jumbotron bezel offset from cube face (feet) */
  ballDropScreenFaceOffsetFt: 2,
  /** Upper display cube (m) */
  ballDropCubeSize: 15.6,
  /** Lower jumbotron screens on cube faces (feet) */
  ballDropScreenLowerFt: 15,
  /** Bottom flap sequence after 3-2-1 (seconds) */
  /** Pause after 3-2-1 before slices open (0 = open immediately) */
  ballDropFlapHoldSec: 0,
  ballDropFlapOpenSec: 0.5,
  ballDropFlapCloseSec: 1,
  /** Jumbotron pitch toward arena floor (degrees) */
  ballDropScreenTiltDeg: 20,
  /** Logo screen size (m) */
  ballDropScreenWidthM: 13.8,
  ballDropScreenHeightM: 7.8,
  /** Octagonal lower drum (circumradius m, before ballDropDrumScale) */
  ballDropDrumRadius: 10.2,
  ballDropDrumHeight: 9.6,
  ballDropDoorCount: 8,
  /** Ball spawn inset below cube ceiling (m) */
  ballDropSpawnInset: 3.3,
  /** Seconds to hinge doors open on kickoff */
  ballDropDoorOpenSec: 0.85,
  /** Logo banners around the map (radius from center) */
  arenaLogoBannerRadius: 52,
  arenaLogoBannerY: 30,
  arenaLogoBannerWidthM: 14,
  arenaLogoBannerHeightM: 7,
} as const;

const FT = 0.3048;

/** Billboards, speed pads, bounce trampolines (see arenaPadLayout.ts) */
export const ARENA_PADS = {
  /** Upward launch target height (feet) for bounce pad */
  bounceLaunchHeightFt: 28,
  /** Floor cylinder diameter (feet) */
  bouncePadDiameterFt: 7,
  /** Floor cylinder height (feet) */
  bouncePadHeightFt: 2,
  bouncePadHeightM: 2 * FT,
  bouncePadRadiusM: (7 * FT) / 2,
  /** Trampoline deck + pedestal width multiplier */
  bouncePadWidthScale: 4,
  /** Visual + launch zone scale (2.25 = 1.5× previous 1.5 scale) */
  bouncePadSizeScale: 2.25,
  /** Shared raised platform under pads (m) */
  padPlatformHeightM: 1.4,
  /** Extra lift for all jump/boost platforms (feet) */
  padPlatformRaiseFt: 15,
  trampolinePedestalM: 0.35,
  /** Extra lift on top of platform for trampoline deck */
  trampolineDeckRaiseM: 0.25,
  /** Global bounce launch multiplier */
  trampolineStrengthScale: 1,
  /** Player trampoline peak height fraction of bounceLaunchHeightFt */
  playerBounceLaunchHeightScale: 0.32,
  /** Move trampoline pads toward center, away from corner pillars (m) */
  trampolinePillarClearanceM: 8,
  padCooldownMs: 0,
  billboardWidthM: 28.6,
  billboardHeightM: 13.65,
  billboardWallInsetM: 1.1,
  /** Push billboard face off the wall mesh to avoid z-fighting */
  billboardFaceOffsetM: 2.2,
  billboardCenterYM: 34,
  /** Shift recess toward court (+Z wall-local); was inverted before */
  fanBayForwardNudgeM: 0.52,
  /** Recessed fan bowl below each hex billboard screen */
  fanBayWidthM: 22,
  fanBayHeightM: 14,
  /** Recess depth into arena from inner wall face (feet) */
  fanBayDepthFt: 20,
  /** Vertical center of fan bowl on perimeter wall (m) */
  fanBayCenterYM: 18,
  fanBayGapBelowScreenM: 1.8,
  fanCols: 10,
  fanRows: 9,
  fanSphereRadiusM: 0.64,
  /** Keep sphere centers inside recess side walls (m beyond radius) */
  fanRowSideMarginM: 0.32,
  /** Peak jump height above seat (m) */
  fanBounceAmpM: 0.28,
  /** Normal cheer cycle speed (lower = slower bounce) */
  fanBounceSpeed: 2.1,
  /** Scoring / glass frenzy — bounce cycle speed (lower = slower hops) */
  fanCelebrateSpeedMult: 2.35,
  /** Glass-hit frenzy — slightly faster / bouncier than goal cheer */
  fanGlassCelebrateSpeedMult: 3.1,
  fanGlassCelebrateAmpMult: 2.6,
  fanGlassCelebrateHopPortion: 0.44,
  /** Taller hops for the scoring team's fans */
  fanCelebrateAmpMult: 2.35,
  fanCelebrateHopPortion: 0.36,
  /** Diagonal sway during celebration (m) */
  fanCelebrateDiagAmpM: 0.14,
  fanCelebrateDiagSpeed: 2.05,
  /** Black-tinted glass at the front of the fan recess (m) */
  fanFacadeGlassThicknessM: 0.06,
  /** Fan glass — higher = darker, fans harder to see */
  fanFacadeGlassOpacity: 0.84,
  fanFacadeGlassTransmission: 0.06,
  /** Push glass court face toward opening (+Z wall-local) */
  fanFacadeGlassForwardM: 0.58,
  /** Front-row fans sit this far behind glass back face (m) */
  fanGlassFanClearanceM: 0.78,
  /** Black trim frame on court-facing side of fan booth glass (m) */
  fanExteriorFrameWidthM: 0.4,
  fanExteriorFrameDepthM: 0.16,
  /** Side-to-side sway amplitude (m) */
  fanSwayAmpM: 0.11,
  fanSwaySpeed: 1.35,
  /** Rectangular crowd signs per fan bay */
  fanSignCount: 8,
  /** Home-team share of crowd color per bay (remainder green + away) */
  fanHomeTeamColorPct: 90,
  /** Crowd frenzy after rocket/ball hits this bay's glass (ms) */
  fanGlassCelebrateMs: 5000,
  /** Per-row bench rise + setback into recess (m) */
  fanRowRiseM: 0.38,
  fanRowDepthStrideM: 0.68,
  fanBenchHeightM: 0.36,
  /** Extra lift above bench top so spheres sit clear of the deck (m) */
  fanSeatLiftM: 0.22,
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
  /** Teammate bot (bot-2) — pull loose floor balls toward player */
  allyBeamPullScale: 1.08,
  /** Red/blue enemy bots — beam pull on loose balls */
  enemyBeamPullScale: 0.88,
  /** Seconds a bot must hold beam attract before socketing the ball */
  beamCaptureLatchSec: 0.75,
  /** Teammate bot: only beam when ball is on/near the floor (not mid-air shots) */
  allyBeamMaxHeightAboveFloor: 3.8,
  allyBeamLowMaxHeight: 1.6,
  allyBeamMaxVerticalSpeed: 7.5,
  allyBeamMaxSpeedForBeam: 34,
  /** Ally bot (bot-2) dribble / pass bias toward the local player */
  allyPassToPlayerChance: 0.82,
  allyCarryToPlayerChance: 0.62,
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
  /** After alley-oop catch at rim — prefer jam/shoot over passing back */
  allyDunkHoldPassChance: 0.14,
  /** Absolute max seconds holding (forces shoot if still carrying) */
  holdMaxCarrySec: 8,
  shootMinHoldSec: 0.14,
  holdSetupMaxSec: 0.5,
  holdShootAfterJumpSec: 0.15,
  holdForceShootSec: 0.4,
  holdForceLooseShootSec: 0.2,
  holdFarDecisionSec: 0.35,
  goalQuickShotDist: 26,
  /** Far from net — chance a hold release becomes a high arc (loft) */
  farHoldLoftShotChance: 0.3,
  farHoldLoftMinDist: 26,
  loftLaunchExtraLiftY: 3.4,
  loftPitchOffsetDeg: 10,
  /** Ally bot — one roll per opponent shot to rocket the loose ball */
  allySaveBallAfterOpponentShotChance: 0.3,
  allySaveAfterOpponentShotWindowSec: 2.4,
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
  shotPitchOffsetDeg: 17,
  /** Extra pitch on harass / volley rockets (degrees) */
  rocketPitchOffsetDeg: 14,
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
  followPlayerAimErrorMinPct: 0.05,
  followPlayerAimErrorMaxPct: 0.2,
  moveShootPlayerDist: 48,
  moveShootBias: 0.62,
  shootZoneHeightM: 22,
  shootZoneVisualOpacity: 0.26,
  shootZoneCapOpacity: 0.22,
  shootZoneEdgeOpacity: 0.72,
  shootZoneInsetFromWall: 7,
  /** In shoot zone with ball — attempt high dunk vs normal shot */
  shootZoneDunkChance: 0.6,
  /** Remaining shoot-zone rolls that jam instead of normal */
  shootZoneJamChance: 0.12,
  /** Close to net (outside zone) — drive jam into mouth */
  nearGoalJamChance: 0.38,
  goalJamMaxDist: 16,
  /** @deprecated — use goalRingApproachInset (was driving into back wall) */
  goalJamDriveInset: 2.8,
  /** Stand in front of ring center (toward court), not on the back plate */
  goalRingApproachInset: 5.2,
  goalDunkMidApproachInset: 4.1,
  /** Closer keep-out allowed while in shoot zone / attacking */
  goalApproachKeepFromWallM: 9 * 0.3048,
  /** Occasional dunk when close but outside shoot cylinder */
  nearGoalDunkChance: 0.22,
  goalDunkMaxDist: 22,
  dunkPitchOffsetDeg: 38,
  jamPitchOffsetDeg: -14,
  dunkTargetLiftY: 2.6,
  dunkLaunchUpMult: 1.55,
  dunkJumpForceScale: 1.14,
  /** Teammate without ball — post under rim for alley-oop */
  allyDunkPrepDist: 28,
  allyDunkSpotInset: 5.5,
  /** Extra keep-out from goal back wall for alley-oop posts (feet) */
  allyDunkWallStandoffFt: 10,
  /** Jump scale when catching a lob at the rim */
  allyDunkCatchJumpScale: 1.28,
  allyDunkPreJumpChance: 0.42,
  allyDunkLeapOnPassChance: 0.88,
  /** Kickoff — chance one bot runs alley-oop under the rim for ~15s */
  kickoffAllyOopChance: 0.3,
  kickoffAllyOopDurationSec: 15,
  /** At the rim — abandon alley-oop if no pass to this bot within this window */
  kickoffAllyOopPassWaitSec: 7,
  /** After abort — sprint here before normal bot brain resumes */
  kickoffAllyOopReturnArriveDist: 5.5,
  /** Countdown + flap hold — sprint under the drop and jump for the ball */
  kickoffContestSprintMult: 1.1,
  kickoffContestJumpForceScale: 1.12,
  kickoffContestJumpChance: 0.55,
  kickoffContestDoubleJumpChance: 0.62,
  kickoffContestArriveRadius: 6.5,
  kickoffAllyOopSpotRadius: 9,
  kickoffAllyOopJumpChance: 0.35,
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
  /** Second player hit within this window (seconds) triggers ragdoll */
  hitWindowSec: 4,
  hitsToRagdoll: 2,
  /** Min gap between counted hits (direct rocket + blast often land together) */
  hitRegisterCooldownMs: 650,
  /** Ragdoll tumble duration before respawn at spawn (seconds) */
  ragdollDurationSec: 3,
  ragdollGravityScale: 1,
  ragdollAngularDamping: 0.32,
  ragdollLinearDamping: 0.08,
  ragdollSpinRad: 5.5,
  /** After rocket hit — no beam / ball chase (seconds) */
  rocketBallDenySec: 2.5,
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
  ballAttractBallRadii: 4.5,
  /** Energy drain while a bot carries the ball (drops at 0 like the player) */
  holdBallEnergyDrain: 10,
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
  rocketKnockForce: 28,
  /** @deprecated use ROCKET knock stun — kept for tuning reference */
  rocketKnockUp: 12,
  knockStunLinearDamping: 0.12,
  knockStunAngularDamping: 0.36,
  knockStunSpinRad: 2.2,
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
  /** Holding ball — drop if moved less than this (ft) in botHoldStuckDropSec */
  botStuckMoveThresholdFt: 5,
  botHoldStuckDropSec: 4,
  /** Frozen in place — turn/jump, then respawn at spawn */
  botFrozenTurnJumpSec: 6,
  botFrozenRespawnSec: 6.5,
  stuckEscapeCooldownSec: 2.2,
  stuckEscapePush: 12,
  stuckBoundaryMargin: 4,
  /** Seconds before floor grounded checks resume after a jump */
  jumpAirGraceSec: 0.5,
  /** Lift body on jump so the capsule clears the floor */
  jumpLiftY: 0.14,
  /** Ally bot only — periodic harass rockets */
  periodicProjectileIntervalSec: 4.8,
  periodicFireAtLooseBallChance: 0.12,
  periodicFireAtPlayerCarrierChance: 0.22,
  periodicFireAtBotCarrierChance: 0.16,
  periodicProjectileBallBias: 0.2,
  periodicProjectilePlayerBias: 0.35,
  /** Enemy volley — aim at opposing bot instead of player/ball */
  enemyVolleyAtBotChance: 0.38,
  /** Enemy team: every N sec, chance one bot fires at ball or player */
  enemyRocketVolleyIntervalSec: 8.5,
  enemyRocketVolleyChance: 0.58,
  /** While local holds — per-bot reroll interval for shoot/pause dice (seconds) */
  enemyPlayerCarrierShotRerollSec: 4,
  /** How long a failed shoot roll pauses player-targeted rockets (seconds) */
  enemyPlayerCarrierShotPauseSec: 3.5,
  /**
   * Per-bot chance (0–1) to shoot at the local player while they hold the ball.
   * Each enemy bot rolls independently on its own timer.
   */
  enemyPlayerCarrierShotChance: 0.05,
  /** Rocket hit retaliation — max window (seconds) */
  retaliateDurationSec: 10,
  retaliateMaxShots: 3,
  /** Pause after aimed, before each shot */
  retaliatePauseMinSec: 0.7,
  retaliatePauseMaxSec: 1.5,
  /** Short wind-up before the guaranteed first revenge rocket */
  retaliateFirstShotPauseSec: 0.85,
  /** Roll after each shot (except max reached) for another pause+shot */
  /** Chance to fire rocket 2 or 3 after the guaranteed first revenge shot */
  retaliateContinueShotChance: 0.58,
  /** Brief tail after burst before normal AI resumes */
  retaliateAfterBurstSec: 0.35,
  /** Max yaw/pitch error (rad) before a shot is allowed */
  retaliateAimMaxErrorRad: 0.2,
  /** Vertical aim point — slightly below chest so rockets don't sail over */
  retaliateAimDropM: 0.22,
  /** Revenge uses line-of-sight pitch (rockets fly straight; no +14° harass offset) */
  retaliateRocketPitchOffsetDeg: 0,
  retaliatePitchAimMaxErrorRad: 0.12,
  /** Aim blend while turning to face the attacker before revenge fire */
  retaliateAimSmoothing: 10,
  /** Movement speed scale while retaliating */
  retaliateMoveSpeedScale: 0.42,
  /** Random aim offset (m) — lowers direct hit rate */
  rocketAimErrorM: 6.2,
  /** Bot rockets travel at ROCKET.speed × this (player unchanged) */
  rocketSpeedScale: 0.75,
} as const;

/** Third-person camera */
export const CAMERA = {
  distance: 7,
  height: 1.2,
  pivotHeight: 1.5,
  shoulderOffset: 0,
  lookAhead: 24,
  smooth: 20,
  /** Never pull third-person cam closer than this to the pivot (avoids clipping inside capsule) */
  minDistanceFromPivot: 4.5,
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
  defaultPitch: 0,
  pitchMin: -1.15,
  pitchMax: 1.15,
} as const;

/** Player movement */
export const MOVEMENT = {
  walkSpeed: 9.5,
  sprintSpeed: 14,
  jumpForce: 18,
  doubleJumpForce: 14,
  tripleJumpForce: 11,
  maxJumps: 3,
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
  /** Ease mesh pitch/yaw back to normal after knock tumble (physics snaps upright) */
  visualRecoverySec: 0.35,
  /** Second W tap within this window triggers forward dash (seconds) */
  dashDoubleTapWindowSec: 0.4,
  /** Cooldown before another WW dash (seconds) */
  dashCooldownSec: 1.35,
  /** Sustained horizontal speed during WW dash (m/s) */
  dashForwardSpeed: 21.6,
  /** How long dash locks velocity along launch heading (seconds) */
  dashDurationSec: 0.9,
  /** Upward pop at dash start (m/s) */
  dashUpSpeed: 2,
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
  restitution: 0.58,
  friction: 0.18,
  linearDamping: 0.014,
  angularDamping: 0.06,
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
  /** After a ball shot — block rockets until LMB is released, then this grace (sec) */
  postShotRocketGraceSec: 0.32,
  spawnCooldownSec: 1.2,
  /** Smooth snap when ball first latches to hold socket */
  holdLatchDurationSec: 0.28,
  holdLatchSmooth: 14,
  holdFollowSmooth: 20,
  /** Aim smoothing while carrying — lower = snappier */
  holdSocketTargetSmooth: 5.5,
  /** Extra low-pass on held ball mesh vs physics body */
  holdVisualSmooth: 24,
  /** Low-pass on ramp/floor support height while held */
  holdSupportSmooth: 32,
  /** How long Space stays buffered if jump was early (seconds) */
  jumpBufferSec: 0.28,
  /** m/s impulse per m/s ball impact on characters */
  characterStrikeKnock: 2.35,
  characterStrikeKnockMin: 12,
  characterStrikeKnockMax: 40,
} as const;

export type BallTypeId = 'original' | 'superball';

/** Superball — billiards-style rocket deflection; slightly heavier and slower */
export const SUPERBALL = {
  radius: BALL.radius,
  mass: 42,
  restitution: BALL.restitution,
  friction: BALL.friction,
  linearDamping: BALL.linearDamping * 1.08,
  angularDamping: BALL.angularDamping,
  gravityScale: BALL.gravityScale,
  maxSpeed: 68,
  /** Rear-align dot above this with low lateral offset = straight rocket-axis knock */
  forwardAxialMin: 0.88,
  /** Max lateral offset (0–1) while still counting as a centered rear hit */
  centerHitMaxLateral: 0.14,
  /** Rocket impulse multiplier vs original ball */
  knockScale: 1.02,
  /** Superball rocket knock — stronger than original */
  hitImpulse: 36,
  knockMinFalloff: 0.52,
  rocketSpeedInherit: 0.26,
  directHitDist: 4.2,
  trailColor: '#ffd966',
  surfaceColor: '#f0c060',
  emissiveColor: '#ff9933',
  idleEmissive: '#ffcc66',
} as const;

/** Magnetic beam — grab reach vs defaults (0.6 = 60% of prior beam/capture distances) */
const BEAM_GRAB_RANGE_SCALE = 0.6;

/** Magnetic beam */
export const BEAM = {
  range: 42 * BEAM_GRAB_RANGE_SCALE,
  captureDistance: 4.16 * BEAM_GRAB_RANGE_SCALE,
  /** Must be this close to lock after winning tug-of-war */
  tightCaptureDistance: 3.55 * BEAM_GRAB_RANGE_SCALE,
  botTightCaptureDistance: 2.55 * BEAM_GRAB_RANGE_SCALE,
  botCaptureReachScale: 0.88,
  botMinCapturePull: 0.42,
  botCaptureDominanceRatio: 0.54,
  /** Ball center within this of body/chest counts as touching */
  contactStickDistance: BALL.radius + MOVEMENT.capsuleRadius + 0.55,
  contactChestDistance: BALL.radius + 0.75,
  /** Legacy hint band for “pulled” UI */
  contactCaptureDistance:
    BALL.radius + MOVEMENT.capsuleRadius + 1.35 * BEAM_GRAB_RANGE_SCALE,
  maxContactCaptureSpeed: 44,
  /** Soft lock-in before full capture */
  stickyAttachDistance: 4.2 * BEAM_GRAB_RANGE_SCALE,
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
  closePullDistance: BALL.radius * 4 * BEAM_GRAB_RANGE_SCALE,
  /** Pull multiplier at contact inside closePullDistance (rest of beam unchanged) */
  closePullStrengthMult: 1.5,
  spinDamp: 3.4,
  maxCaptureSpeed: 34,
  maxPullEffectSpeed: 68,
  holdDistance: 3.2,
  chestHeight: 1.15,
  /** Max downward pitch while carrying (unit Y on aim dir; ~0.78 ≈ 51° down) */
  holdMaxDownPitch: 0.78,
  /** How far below chest the hold socket may sit (m, negative) */
  holdMinSocketYBelowChest: -1.4,
} as const;

/** Rocket */
export const ROCKET = {
  /** @deprecated unlimited rockets — kept for tuning UI compatibility */
  magazineSize: 999,
  /** @deprecated */
  reloadCooldownSec: 0,
  /** Hold LMB this long to fire a bouncer (tap release = explosive) */
  chargedHoldSec: 0.14,
  /** Max rockets from local player in flight at once */
  maxActive: 8,
  speed: 72,
  velocityInherit: 1,
  maxSpeed: 105,
  surfaceBounces: 2,
  bounceRestitution: 0.68,
  ownerGraceSec: 0.22,
  /** Spawn ahead of chest so the rocket clears the player capsule */
  rocketSpawnAhead: 3.2,
  /** Must leave muzzle before it can detonate on the shooter (bots only) */
  minTravelBeforePlayerHit: 4,
  /** Explosive rockets — min travel before floor/wall detonation (owner) */
  minTravelBeforeExplosiveDetonate: 2.8,
  /** Same for ball hits — stops instant detonate when firing past a nearby ball */
  minTravelBeforeBallHit: 3.2,
  /** Swept-sphere pad beyond ball radius for rocket–ball direct hit (m) */
  ballHitDetectPad: 0.85,
  explosionRadius: 7,
  /** No beam on ball / bots inside this radius after a rocket blast */
  beamDenyRadius: 7,
  beamDenyDurationSec: 1,
  explosionVisualDuration: 0.38,
  playerForce: 24,
  /** Brief ragdoll-like tumble on rocket hit (seconds) */
  knockStunSec: 0.6,
  knockStunGravityScale: 1,
  knockStunLinearDamping: 0.14,
  knockStunAngularDamping: 0.34,
  knockStunSpinRad: 4.5,
  /** Flatten upward knock (0–1) */
  knockStunVerticalScale: 0.2,
  knockStunHorizontalScale: 1.05,
  /** Scales initial blast velocity (~0.5 = half the tumble speed) */
  knockStunImpulseScale: 0.5,
  knockStunInheritVerticalScale: 0.25,
  /** Partial WASD while tumbling (0–1 of walk speed) */
  knockStunMoveBlend: 0.38,
  knockStunAirMoveBlend: 0.24,
  knockStunSteerAccel: 11,
  /** @deprecated — knock stun uses minimal lift only */
  rocketJumpUp: 2,
  /** Direct rocket body hit on local player */
  playerDirectKnock: 26,
  /** Velocity change applied via Rapier impulse on ball hits (× ballKnockStrength) */
  ballHitImpulse: 22,
  ballSplashMinFalloff: 0.52,
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
  /** After a goal, wait this long before 3-2-1 kickoff countdown */
  postScoreCountdownDelaySec: 1,
  /** Logo splash at match start before arena load countdown */
  logoIntroSec: 2,
  /** Arena load-in before first kickoff countdown */
  mapLoadSec: 5,
  /** Block rockets / combat SFX briefly after match load (pointer-lock click bleed) */
  combatGraceSec: 5,
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
  /** Black backing ring scale vs scored ring */
  backRingScale: 1.32,
  /** Hole cap disc on backing ring — extra vs auto hole size */
  backRingCapScale: 1.2,
  /** Backing ring tube thickness vs normal ringTube (1.2 = 20% fatter) */
  backRingTubeScale: 1.2,
  /** Bottom (large) black back-ring offset from lit center toward wall (m) */
  backRingWallOffsetM: 1.75,
  /** Middle + top — extra push toward wall beyond tier back offset (ft) */
  midTopBackRingWallExtraFt: 2,
  /** Top (5 pt) backup plate — nudge toward court from wall-backed position (ft) */
  topBackRingCourtForwardFt: 1,
  /** Top (small) ring — standoff from wall toward center court (feet) */
  topRingWallStandoffFt: 15,
  /** Lit top ring pull-back toward wall (feet); 0 = full standoff toward court */
  topRingLitWallPullBackFt: 0,
  /** Top black back ring — offset from lit center toward wall (m) */
  topRingBackWallOffsetM: 1.75,
  /** Extra lift for top ring only (feet, toward ceiling) */
  topRingExtraHeightFt: 3,
  /** Extra lift for middle ring only (feet); top ring stack position stays fixed */
  midRingExtraHeightFt: 3,
  /** Extra push toward center court for middle ring stack (feet) */
  midRingExtraCourtOffsetFt: 0,
  /** Middle ring — standoff from wall toward center court (feet) */
  midRingWallStandoffFt: 6,
  /** Extra lit-ring nudge toward court (m); 0 = use standoff only */
  midRingArenaOffsetM: 0,
  /** Middle ring black back — sits behind glow toward the wall */
  midRingBackWallOffsetM: 1.75,
  /** @deprecated visuals follow collider rigidbody — kept at 0 */
  midRingBackVisualExtraFt: 0,
  /** Middle ring hole cap — extra push toward wall on black ring (feet) */
  midRingCapWallOffsetFt: 1,
  /** Bottom (large) ring — standoff from wall toward center court (feet) */
  bottomRingWallStandoffFt: 15,
  /**
   * Side-view tilt (degrees, CCW +): bottom ring up toward ceiling,
   * middle face-on, top ring opposite.
   */
  ringTiltBottomDeg: -20,
  ringTiltMidDeg: 0,
  ringTiltTopDeg: 20,
  /** Rim trampoline launch height (feet) */
  rimBounceHeightFt: 40,
  /** Horizontal push back into the arena (m/s) */
  rimOutwardSpeed: 14,
  rimBounceRestitution: 0.82,
  rimBounceCooldownSec: 0.28,
  /** Launch out of the goal mouth / net back toward center (feet) */
  netBounceHeightFt: 38,
  /** Player/bot net eject — small hop (feet); main push is outward from goal */
  netCharacterHopFt: 2.5,
  /** Horizontal shove toward midfield + ball drop (m/s) */
  netOutwardSpeed: 26,
  /** Pull toward center Z (m/s) */
  netTowardCenterSpeed: 11,
  netBounceCooldownSec: 0.3,
  /** Scoring sensor radius scale (1 = full bullseye; smaller = tighter center cylinder) */
  scoringVolumeRadiusScale: 0.25,
  /** All scoring cylinders — pull toward wall (ft); large / 1-pt ring */
  scoringVolumeWallPullbackFt: 6,
  /** Extra wall pullback for medium (2 pt) + top (5 pt) scoring cylinders (ft) */
  scoringVolumeWallPullbackMidTopExtraFt: 1.5,
  /** After a goal — center in ring, retreat into wall, then park at drop (seconds) */
  goalBallSuckDurationSec: 1.25,
  /** Fraction of suck duration spent lerping to ring center (rest = retreat to wall) */
  goalBallSuckCenterPhase: 0.32,
  /** Past the back ring toward the wall before hiding the ball (ft) */
  goalBallRetreatPastBackRingFt: 5,
  /** Middle + top scoring cylinder diameter scale (0.4 = 60% narrower) */
  scoringVolumeMidTopRadiusMult: 0.4,
  /** How far the scoring cylinder protrudes toward the arena (large / bottom ring, m) */
  scoringVolumeStickOutM: 0.95,
  /** Middle ring — larger sensor + further off the wall */
  scoringVolumeStickOutMidM: 1.95,
  scoringVolumeArenaForwardMidM: 0.5,
  scoringVolumeRadiusScaleMidMult: 2.55,
  /** Top ring — larger sensor + further off the wall */
  scoringVolumeStickOutTopM: 1.85,
  scoringVolumeArenaForwardTopM: 0.4,
  scoringVolumeRadiusScaleTopMult: 2.75,
  /** Bottom (large) ring scoring cylinder radius multiplier (+30% trigger diameter) */
  scoringVolumeRadiusScaleBottomMult: 1.794,
  /** Scoring hole as fraction of ring radius (large / bottom ring) */
  centerScoreRadiusScale: 0.74,
  centerScoreRadiusScaleMid: 0.86,
  /** Middle ring scoring slab depth along hole axis (m) */
  midScoringSensorDepth: 3.85,
  centerScoreRadiusScaleTop: 0.82,
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
  sensorDepth: 2.75,
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
  beamTubeSegments: 56,
  beamTubeRadial: 6,
  beamTraceLayers: 6,
  hexFloorTileStep: 10,
  ballPolkaTextureSize: 512,
  /** Trail / bounce ribbon width scale */
  rocketTrailRadius: 0.22,
  /** Projectile sphere at rocket tip */
  rocketHeadRadius: 0.26,
  /** Tight additive glow halo around rocket tip — visual only */
  rocketHeadGlowRadius: 0.31,
  rocketPoofCount: 6,
  goalFireworkParticles: 48,
} as const;
