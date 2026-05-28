/** Arena — hexagonal Neon Foundry */
export const ARENA = {
  hexRadius: 64,
  wallHeight: 43.7,
  /** Ceiling hex sits this far above wall tops (lower = smaller gap; negative clips into walls) */
  ceilingOverlapM: -0.2,
  /** Roof halves slide apart on R over this many seconds */
  roofRetractSec: 6,
  wallThickness: 1.2,
  /** Flat octagon cap on center platform */
  octagonTopRadius: 11,
  /** Outer edge of ramp slopes down to arena floor */
  octagonSlopeRadius: 28,
  /** Visual + physics scale for octagon decks (1 = legacy size) */
  octagonPlatformSizeMul: 0.9,
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
  /** Raise octagonal drum + bottom flaps only; upper cube/screens stay fixed (ft) */
  ballDropDrumOffsetFt: 10,
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
  /** Visual + launch zone scale (×0.7 from prior 2.25) */
  bouncePadSizeScale: 1.575,
  /** Mid-wall trampolines — offset from center line along goal-side walls (m) */
  midWallPadSideOffsetM: 12,
  /** Mid-wall pads — distance from pillar center toward field (m); includes +15 ft clearance */
  midWallPadCenterInsetM: 8 + 15 * FT,
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
  /** Wall logo boards — ~60% of prior enlarged size */
  billboardVisualScale: 1.05,
  billboardWidthM: 30.03,
  billboardHeightM: 14.34,
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
  /** Physics collider depth for fan glass (visual stays thin) */
  fanGlassColliderDepthM: 0.18,
  /** Fan glass — higher = darker, fans harder to see */
  fanFacadeGlassOpacity: 0.52,
  fanFacadeGlassTransmission: 0,
  /** Push glass court face toward opening (+Z wall-local) */
  fanFacadeGlassForwardM: 0.58,
  /** Front-row fans sit this far behind glass back face (m) */
  fanGlassFanClearanceM: 0.78,
  /** Black trim frame on court-facing side of fan booth glass (m) */
  fanExteriorFrameWidthM: 0.4,
  fanExteriorFrameDepthM: 0.16,
  /** 3D box trim around wall fan cutout — court-facing perimeter frame (m) */
  fanCutoutFrameWidthM: 0.62,
  fanCutoutFrameDepthM: 0.32,
  /** Side-to-side sway amplitude (m) */
  fanSwayAmpM: 0.11,
  fanSwaySpeed: 1.35,
  /** Rectangular crowd signs per fan bay */
  fanSignCount: 8,
  /** Paparazzi flash size (local units × sphere radius) */
  fanPhotoDiamondScale: 0.38,
  /** Camera flash visible length (sec) */
  fanPhotoFlashDurationSec: 0.55,
  fanPhotoGoalFlashDurationSec: 0.48,
  fanPhotoGlassFlashDurationSec: 0.5,
  /** Peak opacity for additive flash diamond (0–1) */
  fanPhotoFlashOpacity: 0.58,
  /** Random idle snaps during normal play (per fan bay) */
  fanPhotoIdleMinSec: 4.5,
  fanPhotoIdleMaxSec: 9,
  fanPhotoIdleBurstMin: 0,
  fanPhotoIdleBurstMax: 1,
  /** Fans eligible to be “photographers” on goals (0–1 of scoring-side color) */
  fanPhotoGoalParticipationPct: 0.38,
  fanPhotoGoalShotsPerShooterMin: 2,
  fanPhotoGoalShotsPerShooterMax: 4,
  /** How many shooters snap when fan glass is hit (per bay) */
  fanPhotoGlassShooterCount: 5,
  /** Each photographer takes 1–2 flashes then stops */
  fanPhotoShotsPerShooterMin: 1,
  fanPhotoShotsPerShooterMax: 2,
  fanPhotoShotGapMinSec: 0.22,
  fanPhotoShotGapMaxSec: 0.52,
  fanPhotoGoalShotGapMinSec: 0.18,
  fanPhotoGoalShotGapMaxSec: 0.42,
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
  /** General field look — slower than combat aim */
  lookAimSmoothing: 6,
  /** Max head turn speed (deg/s) — prevents snap jerks */
  aimMaxYawRateDeg: 200,
  aimMaxPitchRateDeg: 140,
  lookFocusHoldSec: 2.4,
  lookPointSmooth: 2.2,
  celebrationLookHoldSec: 1.9,
  /** Post-goal scorer — visual yaw spin while retreating (rad/s, ~3+ flips over countdown) */
  celebrateSpinRadPerSec: 13.5,
  celebrateRocketCount: 8,
  celebrateRocketIntervalSec: 0.28,
  celebrateJumpForceScale: 1.28,
  celebrateDoubleJumpForceScale: 1.08,
  celebrateRetreatSpeedMult: 1.14,
  celebrateAirJumpCooldownSec: 0.48,
  kickoffLookHoldSec: 1.6,
  /** Kickoff roam — soft anchor within ~5 ft of center platform */
  kickoffSoftRadiusM: 1.524,
  /** Occasional playful rocket during kickoff contest */
  kickoffPlayfulRocketChance: 0.14,
  kickoffPlayfulRocketCooldownSec: 2.75,
  /** Global hop — 30% roll every 5s, then 5s until next roll */
  idleJumpDiceIntervalSec: 5,
  idleJumpDiceChance: 0.3,
  /** Loose ball on court — look weights (non chase / non follow-player) */
  looseBallLookWeight: 0.7,
  /** Shot windup — glance down then release look-up */
  shotWindupLookDownOffsetY: 1.65,
  shotReleaseLookUpDeg: 24,
  shotWindupPitchDeg: -28,
  airControl: 0.9,
  maxJumps: 2,
  beamDrain: 12,
  /** Bot beam = tuning pullStrength × this (player uses 1.0) */
  beamPullScale: 0.5,
  /** Teammate bot (bot-2) — pull loose floor balls toward player */
  allyBeamPullScale: 0.62,
  /** Red/blue enemy bots — beam pull on loose balls */
  enemyBeamPullScale: 0.52,
  /** Extra multiplier on bot beam pull only (player unchanged) */
  beamPullStrengthMult: 0.5,
  /** Seconds a bot must hold beam attract before socketing the ball */
  beamCaptureLatchSec: 0.75,
  /** Teammate bot: beam loose balls — relaxed so ally can contest bounces like enemies */
  allyBeamMaxHeightAboveFloor: 9,
  allyBeamLowMaxHeight: 2.8,
  allyBeamMaxVerticalSpeed: 14,
  allyBeamMaxSpeedForBeam: 46,
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
  /** Max seconds to attempt a dunk/jam hold before forcing a shot */
  dunkTryMaxSec: 3,
  /** Absolute max seconds holding (forces shoot if still carrying) */
  holdMaxCarrySec: 8,
  shootMinHoldSec: 0.14,
  holdSetupMaxSec: 0.5,
  holdShootAfterJumpSec: 0.15,
  /** Prefer jumping before a shot when jumps remain (avoids strip steals on the floor) */
  preferAirBeforeShot: true,
  /** Max time to wait on the ground in setup before forcing a shot anyway */
  holdAirShotMaxWaitSec: 1.15,
  /** Opponent within this range while carrying — hop early toward setup */
  carryThreatJumpDist: 13,
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
  /** Finish cylinder at the bottom ring — must shoot/jam, never idle carry (ft radius) */
  netFinishZoneRadiusFt: 37.5,
  /** Nudge cylinder center toward the court from the scoring center (ft) */
  netFinishZoneCourtOffsetFt: 6,
  /** Min hold before release inside finish cylinder */
  netFinishMinHoldSec: 0.08,
  /** Finish zone shot rolls — jam preferred */
  netFinishJamChance: 0.65,
  netFinishDunkChance: 0.15,
  /** Debug mesh — bot must shoot/jam cylinder at bottom ring */
  netFinishZoneVisualOpacity: 0.32,
  netFinishZoneEdgeOpacity: 0.85,
  /** Debug mesh — per-ring scoring sensor cylinders */
  goalScoringVolumeVisualOpacity: 0.22,
  goalScoringVolumeEdgeOpacity: 0.65,
  /** Ally post / give-space — max seconds standing still before a wander nudge */
  botPostMaxStillSec: 1,
  botPostIdleWanderRadiusM: 2.4,
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
  /** Fake wind-up: goal → 60° left → sweep right, release ~59° on the right */
  feintShotChance: 0.2,
  feintSideDeg: 60,
  feintReleaseAtRightDeg: 59,
  feintLookGoalSec: 0.38,
  feintTurnLeftSec: 0.26,
  feintSweepRightSec: 0.46,
  feintAimSmoothing: 11,
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
  /** Countdown + flap hold — sprint under the drop and jump for the ball */
  kickoffContestSprintMult: 1.22,
  kickoffContestJumpForceScale: 1.38,
  kickoffContestJumpIntervalSec: 0.28,
  kickoffContestReachHorizM: 26,
  kickoffContestJumpChance: 0.55,
  kickoffContestDoubleJumpChance: 0.85,
  kickoffContestArriveRadius: 6.5,
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
  /** Small floor pit under enemy bottom ring — depth from end wall into court (m) */
  goalBottomPitDepthFromWallM: 5.5 * 0.3048,
  /** Max height above floor for pit volume (m) */
  goalBottomPitMaxHeightM: 3.8,
  /** Extra Y under bottom ring center included in pit (m) */
  goalBottomPitBelowRingM: 0.6,
  /** Half-width along Z — tight under one goal column (m) */
  goalBottomPitHalfSpanZM: 7.5,
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
  minBotSeparation: 30 * 0.3048,
  /** Teammates may cluster closer inside the offensive shoot cylinder */
  minBotSeparationInShootZone: 5,
  separationWeight: 1.85,
  flankOffset: 9,
  /** Lane spread for paired bots chasing the same ball (1 = half minBotSeparation each side) */
  chaseLaneScale: 1,
  /** Teammate is chasing the ball — signal TTL (seconds) */
  teammateBallChaseSignalTTL: 3.5,
  /** Roll once per chaser — join / center / offense / defense / default */
  teammateBallChaseJoinChance: 0.3,
  teammateBallChaseCenterChance: 0.3,
  /** After rolling center, dash to midfield then rejoin ball chase */
  teammateBallChaseCenterSec: 1,
  teammateBallChaseOffenseChance: 0.15,
  teammateBallChaseDefenseChance: 0.15,
  /** Stand-off from own net when rolling defense */
  teammateBallChaseDefenseInsetM: 14,
  /**
   * Ball engagement (dist = BALL.radius × radii).
   * Chase / contest only inside chase radii; beam only inside attract radii.
   */
  ballChaseBallRadii: 18,
  ballAttractBallRadii: 4.5,
  /** Horizontal stand-off when chasing / beaming loose ball (feet) */
  ballApproachOffsetFt: 1.75,
  /** Stop driving once this close to the approach point (m) */
  ballApproachArriveM: 0.95,
  /** Chest-to-ball — must beam grab or roll a close rocket (m) */
  botBallCloseEngageM: 5.5,
  /** When close on a loose ball — roll to rocket at ball instead of only beaming */
  botBallCloseShootChance: 0.05,
  /** Seconds between close-ball shoot rolls (one dice roll per interval) */
  botBallCloseShootRollCooldownSec: 5,
  /** Min gap between any bot rocket launch (sec) */
  botRocketFireCooldownSec: 1,
  /** Faster beam latch when already in close engage range */
  botCloseGrabBeamLatchSec: 0.32,
  /** Energy drain while a bot carries the ball (drops at 0 like the player) */
  holdBallEnergyDrain: 10,
  /** Only rocket / harass local player when this close and they hold the ball */
  playerRocketCloseDist: 20,
  botRocketCooldownSec: 1,
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
  carryJumpChance: 0.4,
  /** Reactive hop when ball is above chest */
  ballAboveJumpChance: 0.5,
  /** Wall stuck: min horizontal move (m) to reset timer */
  stuckMoveThreshold: 0.55,
  stuckTimeSec: 1.05,
  /** Holding ball — drop if moved less than this (ft) in botHoldStuckDropSec */
  botStuckMoveThresholdFt: 5,
  botHoldStuckDropSec: 4,
  /** Frozen in place — turn/jump escape attempt */
  botFrozenTurnJumpSec: 6,
  /** Same spot ~4s — suicide rockets + ragdoll respawn at spawn */
  botFrozenRespawnSec: 4,
  /** Ground rockets fired when a bot suicides from stuck */
  botStuckSuicideRocketCount: 3,
  /** Seconds between rapid-fire suicide rockets */
  botStuckSuicideShotIntervalSec: 0.13,
  /** Yaw spin speed while suiciding (rad/s) */
  botStuckSuicideSpinRadPerSec: 6.2,
  /** Aim pitch while firing at the floor (rad, negative = down) */
  botStuckSuicideGroundPitchRad: -1.08,
  /** Pause after last shot before ragdoll */
  botStuckSuicideRagdollDelaySec: 0.2,
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
  /** Extra follow distance (m) at full sprint */
  speedDistanceMax: 2.85,
  /** How quickly camera pulls back when speeding up (lower = more gradual) */
  speedDistanceSmoothIn: 1.05,
  /** How quickly camera returns when slowing down */
  speedDistanceSmoothOut: 1.55,
} as const;

/** U-key debug fly camera during a match */
export const DEBUG_FREELOOK = {
  flySpeed: 24,
  sprintMult: 2.5,
} as const;

/** Aim pitch (full range for shooting) */
export const AIM = {
  defaultPitch: 0,
  pitchMin: -1.15,
  pitchMax: 1.15,
} as const;

/** Player movement */
export const MOVEMENT = {
  walkSpeed: 14.25,
  /** +30% vs prior sprint — shift sprint */
  sprintSpeed: 27.3,
  /** A/D strafe vs W/S — pure sideways uses walk/sprint × this */
  strafeSpeedScale: 1.38,
  jumpForce: 18,
  doubleJumpForce: 14,
  tripleJumpForce: 11,
  maxJumps: 3,
  gravity: -11,
  airControl: 0.95,
  jumpMomentumBoost: 1.12,
  groundAccel: 22,
  /** Local player mesh follow — higher = snappier, lower = smoother */
  playerVisualPosSmooth: 24,
  playerVisualAirPosSmooth: 30,
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
  /** E — leap + forward propel (flip stays on keydown) */
  ePropelDurationSec: 1.15,
  ePropelImpulseCount: 4,
  ePropelUpSpeed: 21.75,
  /** Horizontal speed added on each of the 4 move samples (m/s) */
  ePropelImpulseHSpeed: 15.75,
  /** Locked horizontal speed for the rest of the propel window (m/s) */
  ePropelSustainSpeed: 36,
  ePropelEnergyCostFrac: 0.6,
  ePropelCooldownSec: 0.45,
  /** Shift-held glide/ski control on slopes */
  skiGroundControl: 0.18,
  skiDownhillAccel: 26,
  skiUphillDrag: 11,
  skiMomentumPreserve: 0.992,
  skiMinSlopeDelta: 0.012,
  skiAirGravityScale: 0.72,
  skiAirMomentumPreserve: 0.997,
  grappleMaxDistance: 95,
  grappleMinLookY: 0.1,
  grapplePullTightness: 17,
  grappleReleaseBoost: 1.16,
} as const;

/** Energy */
export const ENERGY = {
  max: 100,
  /** Scales with faster sprint so shift sprint burns bar quicker */
  sprintDrain: 21,
  beamDrain: 17,
  /** RMB + carrying ball — ~8s from full (100 / 12.5) */
  carryBeamDrain: 12.5,
  /** No passive drain while carrying without beam */
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
  friction: 0.26,
  linearDamping: 0.014,
  angularDamping: 0.06,
  /** Roll rate scale on LMB / bot release (ω ≈ v/R) */
  launchSpinScale: 0.78,
  /** Blend ω×r tangential speed into post-bounce linear velocity */
  spinBounceCoupling: 0.72,
  /** Fraction of spin transferred into the bounce (reduces ω) */
  spinBounceTransfer: 0.28,
  /** Off-center rocket impulse → angular velocity (τ = r × J) */
  rocketHitSpinScale: 0.92,
  /** Scales world gravity on the ball (1 = match arena gravity) */
  gravityScale: 1,
  /** Was 80 → +12% (90) → pulled back to +6% (85); clamped in ballRuntime */
  maxSpeed: 85,
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
  /** Brief invulnerability after latch — rockets/beam hits cannot strip the ball */
  holdConnectImmunitySec: 1,
  holdLatchSmooth: 14,
  holdFollowSmooth: 20,
  /** Aim smoothing while carrying — lower = snappier */
  holdSocketTargetSmooth: 5.5,
  /** Extra low-pass on held ball mesh vs physics body */
  holdVisualSmooth: 24,
  /** How far the carry proxy sits beyond the hold socket (m) */
  holdVisualExtraReachM: 1.3,
  /** Carry proxy lag — lower = softer trailing attach */
  holdVisualLagSmooth: 45,
  /** Blend held proxy into physics ball on release (seconds) */
  holdReleaseVisualLerpSec: 0.22,
  /** Loose proxy — filter raw physics position (reduces jitter) */
  looseVisualTargetSmooth: 40,
  /** Loose proxy display follow — higher = snappier */
  looseVisualPosSmooth: 36,
  /** Loose proxy spin follow — higher = snappier */
  looseVisualRotSmooth: 58,
  /** Soft catch-up if display drifts farther than this from filtered target (m) */
  looseVisualMaxLagM: 0.45,
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

/** Ball release recipe — classic momentum shot vs Torque-style super release */
export type ReleaseSystemId = 'classic' | 'superrelease';

/** Superball — billiards-style rocket deflection; slightly heavier and slower */
export const SUPERBALL = {
  radius: BALL.radius,
  mass: 42,
  restitution: BALL.restitution,
  friction: BALL.friction,
  linearDamping: BALL.linearDamping * 1.08,
  angularDamping: BALL.angularDamping,
  gravityScale: BALL.gravityScale,
  maxSpeed: 72,
  /** Rear-align dot above this with low lateral offset = straight rocket-axis knock */
  forwardAxialMin: 0.88,
  /** Max lateral offset (0–1) while still counting as a centered rear hit */
  centerHitMaxLateral: 0.14,
  /** Rocket impulse multiplier vs original ball */
  knockScale: 1.02,
  /** Superball rocket knock — stronger than original */
  hitImpulse: 54,
  knockMinFalloff: 0.52,
  /** Fan-glass wall bounce — lower than arena walls to avoid pinball ricochets */
  fanGlassRestitution: 0.34,
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
  /** Min seconds between rocket shots — faster clicks play empty clip */
  fireCooldownSec: 1.5,
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
  /** Sprite-sheet explosion plays over this duration (seconds) */
  explosionVisualDuration: 1,
  explosionSpriteCols: 8,
  explosionSpriteRows: 4,
  /** Active frames before empty cells at end of sheet */
  explosionSpriteFrames: 22,
  /** World-size multiplier vs blast radius (~⅓ of original 1.55) */
  explosionSpriteSize: 0.26,
  /** HDR-style emissive boost (toneMapped off) */
  explosionSpriteBrightness: 3.2,
  /** Nudge sprite toward camera (× size) — reduces floor/wall clipping when turning */
  explosionSpriteCameraPull: 0.38,
  /** Delay after blast before black scorch appears (before embers) */
  wallScorchSpawnDelaySec: 0.52,
  /** Delay after blast before embers appear (near end of explosion sprite) */
  wallScorchEmberSpawnDelaySec: 0.42,
  /** How long the black scorch stays at full strength before fading */
  wallScorchHoldSec: 5.4,
  /** Black radial scorch fade-out duration after hold */
  wallScorchFadeSec: 1.8,
  wallScorchRadiusM: 3.1,
  /** Tighter scorch on tapered corner pillars */
  wallScorchPillarRadiusM: 1.75,
  /** Angular spread (rad) for pillar patch fan */
  wallScorchPillarPatchSpreadRad: 0.24,
  wallScorchPillarPatchCount: 3,
  /** Peak scorch opacity (kept low so decals don't bleed through objects) */
  wallScorchMaxOpacity: 0.36,
  wallScorchEmberCount: 5,
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
  /** Self rocket straight down within downRocketBoostMaxHeightFt — launch multiplier */
  downRocketBoostForceMult: 10,
  /** Max feet above floor for down-rocket boost */
  downRocketBoostMaxHeightFt: 18,
  /** Rocket velocity must align with straight down (0–1 dot) */
  downRocketBoostMinDownDot: 0.72,
  /** Max horizontal offset (m) from blast to player for boost */
  downRocketBoostMaxHorizM: 4.2,
  /** Upward launch scale on top of playerForce × mult */
  downRocketBoostUpScale: 1.24,
  /** Direct rocket body hit on local player */
  playerDirectKnock: 26,
  /** Velocity change applied via Rapier impulse on ball hits (× ballKnockStrength) */
  ballHitImpulse: 33,
  ballSplashMinFalloff: 0.52,
  playerHitRadius: 1.4,
  energyDamageDirect: 35,
  energyDamageSplashMin: 10,
  energyDamageSplashMax: 25,
  lifetime: 3,
  /** Grey smoke puff lifetime (seconds) */
  trailPuffLifeSec: 0.48,
  /** Min rocket travel between exhaust bursts (m) */
  trailPuffSpawnStepM: 0.11,
  trailPuffMaxCount: 320,
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
  mapLoadSec: 10,
  /** After load screen — map visible, 5-4-3-2-1 settle before kickoff 3-2-1 */
  arenaSettleCountdownSec: 5,
  /** Block rockets / combat SFX briefly after match load (pointer-lock click bleed) */
  combatGraceSec: 5,
  /** 3-2-1 before kickoff and after each goal */
  startCountdownSec: 3,
  resetCountdownSec: 3,
  /** Match-end overlay — restart (not bound during gameplay) */
  playAgainKeyCode: 'KeyN',
  playAgainKeyLabel: 'N',
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
  midTopBackRingWallExtraFt: 0.75,
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
  /** Middle (2 pt) backup cap square — out from black disc toward court (feet) */
  midRingBackCapCourtOffsetFt: 2.75,
  /** Top (5 pt) backup cap square — out from black disc toward court (feet) */
  topRingBackCapCourtOffsetFt: 2.75,
  /** Middle ring back-cap square — extra push toward wall (feet) */
  midRingCapWallOffsetFt: 0,
  /** Top (5 pt) scoring cylinder — lift toward ring center (feet) */
  scoringVolumeTopLiftFt: 2,
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
  /** Rocket-style goal eject for player (same scale as ROCKET.playerForce) */
  characterEjectForce: 24,
  /** Bot eject uses BOT.rocketKnockForce × this */
  characterEjectBotForceScale: 1.05,
  /** Upward bias in knock direction before flatten (slight hop) */
  characterEjectUpBias: 0.12,
  /** Optional pull toward center Z when not in net contact (normalized dir component) */
  characterEjectCenterZ: 0.28,
  /** Multiplier on rocket-style goal eject impulse */
  characterEjectForceMultiplier: 5,
  /** No WASD / bot drive — mouse look still works */
  characterEjectMoveLockSec: 1,
  /** Horizontal shove toward midfield + ball drop (m/s) */
  netOutwardSpeed: 26,
  /** Pull toward center Z (m/s) */
  netTowardCenterSpeed: 11,
  netBounceCooldownSec: 0.3,
  /** Scoring sensor radius scale (1 = full bullseye; smaller = tighter center cylinder) */
  scoringVolumeRadiusScale: 0.25,
  /** All scoring cylinders — pull toward wall (ft); large / 1-pt ring */
  scoringVolumeWallPullbackFt: 6,
  /** Extra wall pullback for bottom (1-pt) scoring cylinder only (ft) */
  scoringVolumeWallPullbackBottomExtraFt: 1.5,
  /** Extra wall pullback for medium (2 pt) + top (5 pt) scoring cylinders (ft) */
  scoringVolumeWallPullbackMidTopExtraFt: 1.5,
  /** Extra wall pullback for middle (2 pt) scoring cylinder only (ft) */
  scoringVolumeWallPullbackMidExtraFt: 0.6,
  /** After a goal — pause, lerp to ring center, fade into wall */
  goalBallSuckPauseSec: 0.2,
  goalBallSuckLerpSec: 0.6,
  goalBallSuckFadeSec: 0.3,
  /** Suck lerp target — extra stick-out toward the court from ring center (ft) */
  goalBallSuckStickOutFt: 3,
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
  /** Bottom (large) ring scoring cylinder radius multiplier (+25% trigger diameter vs prior) */
  scoringVolumeRadiusScaleBottomMult: 2.243,
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
  emissiveIntensity: 3.85,
  glowTubeScale: 1.45,
  glowOpacity: 0.34,
  /** Torus tube cross-section segments */
  torusRadialSegments: 8,
  /** Torus segments around the ring (rotation) */
  torusTubularSegments: 8,
  /** Backing cap disc + score hole ring segments */
  ringCapSegments: 8,
  /** Distance from flat end face toward arena center (rings stay visible in play space) */
  faceInsetFromWall: 1.6,
  sensorDepth: 2.75,
} as const;

/** Renderer / lighting */
export const RENDER = {
  dprMin: 1,
  dprMax: 1.2,
  antialias: true,
  enableShadows: true,
  shadowMapSize: 4096,
  shadowCameraSpan: 80,
  shadowCameraFar: 155,
  /** PCF kernel for arena fill lights (if any cast) */
  shadowRadius: 7,
  /** Overhead sun directional — lower = harder, more distinct shadows */
  sunShadowRadius: 1.75,
  beamTubeSegments: 56,
  beamTubeRadial: 6,
  beamTraceLayers: 6,
  hexFloorTileStep: 10,
  ballPolkaTextureSize: 512,
  /** Trail / bounce ribbon width scale (m) */
  rocketTrailRadius: 0.58,
  /** Perpendicular wiggle — fraction of trail half-width */
  rocketTrailWiggleScale: 0.26,
  /** Live trail noise animation speed */
  rocketTrailWiggleSpeed: 6.2,
  /** Additive ribbon halo width multiplier */
  rocketTrailGlowWidthScale: 1.0,
  /** Projectile sphere at rocket tip */
  rocketHeadRadius: 0.26,
  /** Tight additive glow halo around rocket tip — visual only */
  rocketHeadGlowRadius: 0.31,
  rocketPoofCount: 6,
  goalFireworkParticles: 48,
} as const;
