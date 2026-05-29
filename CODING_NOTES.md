# Coding Notes (RocccitBall)

This file is a living log of gameplay/editor changes and where to find the code.

## Project paths

- **Repo root**: `C:\Users\joe\Desktop\RocccitBall`
- **Client**: `client/`
- **Gameplay code**: `client/src/game/`
- **Map editor code**: `client/src/mapEditor/`

## New notes & ideas

Scratchpad for follow-ups, experiments, and things to try next. Add bullets here as they come up; promote finished work into **Recent gameplay changes** below.

### Ideas (backlog)

- *(add ideas here)*

### In progress / watch

- *(add active threads here)*
- Fall/out-of-arena teleport recovery is intentionally disabled for now. Restore by re-adding `FallRecoveryMonitor` import/render in `client/src/game/GameCanvas.tsx`; the helper files are still `client/src/game/FallRecoveryMonitor.tsx` and `client/src/game/fallRecovery.ts`.

### Done recently (promote to Recent gameplay changes when stable)

- Rocket collision on jump pad **stone stems** (not just cyan deck) — `arenaPadLayout.ts`, `rocketSystem.ts`, `RocketCollisionDebug.tsx`
- Purple **G-key** rocket hit wireframes for platforms, trampolines, pillars, goals, billboards, fan glass
- Platform rocket scale fix — `resolvePlatformWorldScale()` uses group scale only (`arenaSpawn.ts`)
- Bounce pad deck + stem Rapier colliders + swept logical hits for rockets

## Recent gameplay changes

### Rockets: collision debug + jump pad hits

- **G key** toggles Rapier colliders plus **purple wireframes** for logical rocket surfaces (`RocketCollisionDebug.tsx`, `gameStore.ts`, `InputManager.ts`).
- Rockets use swept segment tests (not Rapier) — platforms, bounce/trampoline **deck + stone stem**, pillars, ball drop, goal rims, billboards, fan glass, floor/ceiling/hex bounds.
- **Jump pads**: deck hits → trampoline launch; stem hits → wall bounce off cylinder (`segmentHitsBounceTrampoline` in `arenaPadLayout.ts`, `tryPlatformBounce` in `rocketSystem.ts`).
- **Platform scale fix**: rocket hit radii match visible mesh — `resolvePlatformWorldScale()` no longer double-applies `sizeScale` (`arenaSpawn.ts`).
- **Deduped stadium groups** so moved platforms don’t leave ghost colliders (`stadiumLayout.ts` → `getPlayModeStadiumGroups`).

### Crown forward flip (E / triple jump)

- One forward somersault on emote/triple jump; crown pitch independent of body tilt; 2× faster flip timing.
- **Files**: `PlayerJumpHat.tsx`, `forwardFlipEmote.ts`, `PlayerVisualProxy.tsx` (crown in overlay slot).

### Audio: menu + in-match music quieter

- Halved base volumes for menu and gameplay background music.
- **File**: `audio.ts` (`BG_MUSIC_MENU_BASE`, `BG_MUSIC_GAME_BASE`).

### Bots: look targets + smooth aim (`botLook.ts`)

- Bots always resolve a look point (ball / teammate / opponent / ball drop / goal).
- Chase modes lock onto the **ball**; focus changes are **held ~2.4s** and blended in world space.
- `smoothAimToward` uses **angle lerp + max turn rate** (no snap yaw).
- **No defensive net camping**: `defense` teammate-chase roll → `teamCenter` midfield roam.
- **Kickoff contest**: soft roam within **~5 ft** of center; look at ball drop; occasional playful rockets (cooldown).
- **Post-score celebration**: smooth look at ball drop / teammate / opponent; soft center roam.
- **Held ball**: carry look + **setup windup** (glance down) → **release look-up** on shot.

### Bots: “never park / never fully idle”

- **Defensive support (`teamDefense`) no longer parks in the net**
  - Implemented a roaming/loiter target in front of the bot’s own goal so they keep moving.
  - **Files**:
    - `client/src/game/botBrain.ts` (new `pickTeamDefenseRoamTarget`, defense look target → ball)
    - `client/src/game/Bots.tsx` (avoid `_wish.set(0,0,0)` idle case by orbiting)

### Ball Drop: shake on hit + spotlight frenzy

- **Explosive rocket impact on the Ball Drop** triggers:
  - **Ball Drop shake** (small wobble)
  - **3s spotlight “frenzy”**: faster sweep + strong flicker + sparks
- **Files**:
  - `client/src/game/rocketSystem.ts` (detect ball drop hit and trigger shake/frenzy)
  - `client/src/game/visualShake.ts` (added `triggerBallDropShake` + `getBallDropShake`)
  - `client/src/game/BallDrop.tsx` (applies `getBallDropShake` to the ball drop root group)
  - `client/src/game/BallDropSpotlightCones.tsx`
    - `triggerBallDropSpotlightFrenzy()`
    - Spark points + flicker/intensity modulation while frenzy is active

### Ball spawn: `T` respawns a new ball

- Bound `KeyT` to the same “spawn ball” queue used for the kickoff drop behavior.
- **File**: `client/src/game/InputManager.ts`

### Ceiling invisible wall + green wireframe flash + sound

- Added an **invisible ceiling collider** so ball/player can’t fly out.
- When the **ball or player hits the ceiling**:
  - The **ceiling wireframe flashes** (bright, layered additive wireframe)
  - A **small ceiling bump sound** plays
- **Files**:
  - `client/src/game/ArenaCeilingImpactWall.tsx` (collider + ceiling-plane wireframe flash)
  - `client/src/game/Ball.tsx` (detect ceiling normal → trigger flash + sound)
  - `client/src/game/Player.tsx` (detect ceiling normal → trigger flash + sound)
  - `client/src/game/audio.ts` (added `playCeilingBump`)
  - `client/src/game/visualShake.ts` (added ceiling hit pulse/wobble helpers)

### Rocket impacts louder overall

- Boosted rocket explosion sample gain.
- **File**: `client/src/game/audio.ts` (`playRocketExplosion`)

### Mouse focus loss after menus

- When closing the tuning menu, we now do a stronger resume sequence to reduce cases where you return and the mouse isn’t captured:
  - `onGameplayResume()` + `refreshPointerLockState()`
- **File**: `client/src/game/tuningStore.ts`

## Map Editor: JSON import/export

- Added “Map JSON” UI section for **Export JSON** / **Import JSON**.
- Import validates, normalizes, assigns a new ID if needed, saves, and activates.
- **Files**:
  - `client/src/mapEditor/MapEditorUI.tsx`
  - `client/src/mapEditor/mapEditorStorage.ts`
  - `client/src/mapEditor/mapEditorStore.ts`

# Rocccit Ball — Coding Notes (for Cursor)

Quick map of the project so a new chat can pick up without this conversation.

## What this game is

**Rocccit Ball** is a browser 3D arena sports game (React + Three.js + Rapier physics):

- Hexagonal indoor arena with **three stacked goal rings** on each end wall (red / blue).
- **Ball** — physics sphere; score by sending the ball center through a **small scoring cylinder** inside each ring.
- **Local player** — mech avatar on a capsule; **LMB** rockets / ball launch, **RMB** tractor beam, movement + jumps.
- **Bots** (optional) — same controls/physics patterns as player.
- **Crowd booths** — recessed fan bays behind glass on perimeter walls; glass hits trigger panic/cheer audio.
- **Kickoff** — ball drops from center **BallDrop** structure after countdown.

Repo layout:

| Path | Role |
|------|------|
| `client/` | Vite + React app (all gameplay code) |
| `client/src/game/` | Arena, ball, player, bots, audio, scoring |
| `client/src/shared/Constants.ts` | Tunable numbers (arena, goals, pads, rockets, match) |
| `client/user/sounds/` | WAV/FLAC samples (`cheering.wav`, `panic.wav`, `goal1.WAV`, etc.) |
| `client/user/images/` | Logos, textures |

Run: `cd client && npm run dev` — build: `npm run build`.

---

## Recent review (handoff)

*Passoff for the next coder — May 2026 session.*

### U-mode light editor (`KeyU`)

| Piece | Path |
|-------|------|
| Fly camera | `DebugFreelook.tsx` — WASD along look vector; match keeps running |
| Panel | `StadiumLightEditorPanel.tsx` — right HUD; **click panel fields to type** (gameplay keys ignored while an `<input>` is focused — `uiFocus.ts` + `InputManager.ts`) |
| Picking | `StadiumLightPicking.tsx` — single LMB click select; click empty arena deselect |
| Runtime lights | `StadiumLightsRuntime.tsx` + `stadiumLightStore.ts` + `stadiumLightsDefaults.ts` |
| Persist | `localStorage` key `rocketball-stadium-lights-v1` |
| Export | Panel **Copy positions to code** → paste into `buildDefaultStadiumLights()` |

**Gizmo (selected light):** panel buttons **Move / Rotate / Scale** → `TransformControls` mode in `StadiumLightsRuntime.tsx`. Scale maps to `rectWidth`/`rectHeight` (rect), `distance` (point/spot), or `intensity` (directional). Drag gizmo or type position/rotation in panel.

**Other U controls:** RMB hold on canvas = look (no pointer lock). **Tab** = respawn ball. **Esc** = deselect light. **U** again = exit fly.

### Roof (`KeyR`)

| Piece | Path |
|-------|------|
| Slabs + kinematic colliders | `ArenaRetractableRoof.tsx` |
| Sky leak cap (no shadows) | `ArenaRoofLightBlocker.tsx` — `castShadow={false}`; visible only when `arenaRoofStore.open < 0.06` |
| State | `arenaRoofStore.ts` — `open` 0–1, stepped in `useFrame` (no React notify per frame) |

Pressing **R** toggles target open/closed. Hitch fix: blocker must not cast shadows when visibility flips.

### Performance / removed systems

- Hex **grass** + voxel **cube fog** removed from runtime; sources in `client/src/game/_archive/grass-and-fog/` (see section below). `tsconfig.app.json` excludes `src/**/_archive/**`.
- Scene **atmospheric fog** in Graphics menu is unrelated (`SceneEnvironment.tsx`).

### If you touch this next

1. **Typing in light panel** — always route gameplay hotkeys through `shouldIgnoreGameplayKeys()`; panel uses commit-on-blur inputs so partial numbers like `36.` do not fight the store every keystroke.
2. **R roof hitch** — do not re-enable `castShadow` on `ArenaRoofLightBlocker`.
3. **New default lights** — edit `stadiumLightsDefaults.ts` or fly-export, then verify `ArenaLighting.tsx` still mounts `<StadiumLightsRuntime />` only.

---

## Core architecture

```
App.tsx → GameCanvas.tsx
  ├── Physics (Rapier) debug toggle: G
  ├── Arena.tsx — floor, walls, goals, ball drop
  ├── Player.tsx — local input + movement
  ├── Ball.tsx — ball body, scoring, rim/glass
  ├── Bots.tsx — AI players
  ├── Rockets.tsx + rocketSystem.ts — projectile sim
  └── HUD / menus (MainMenu, tuning)
```

**State:** `gameStore.ts` — phase, score, ball holder, team, collider debug, combat grace, etc.

**Input:** `InputManager.ts` — pointer lock, keys, fire/beam.

**Tuning:** `tuningStore.ts` + in-game tuning menu (volumes, bot settings).

---

## Collision groups (Rapier)

| Group | Who | Collides with |
|-------|-----|----------------|
| 0 | Player / bot capsule | 0,1,2,4 |
| 1 | Ball | 0,1,2,4 (loose); held ball often 2 only |
| 2 | Arena, goals, pads, glass | 0,1,2 |

Goal **lit + back rings** use `TrimeshCollider` torus meshes in `Arena.tsx` (`GOAL_ENV_COLLISION`).

---

## Goals & scoring

**Definitions:** `goals.ts` + `GOAL_RINGS` in `Constants.ts`

- `ARENA_GOALS` — six goals (3 per end wall: large / medium / small).
- **Visual rings** — `GoalRing` + `GoalRingBackplate` in `Arena.tsx`.
- **Scoring volume** — `GoalScoringVolume` — small cylinder, sensor only; position from `goalScoringCenter()`.

**Scoring logic:** `scoring.ts` → `checkGoalScoreSegment()` called from `Ball.tsx` `useAfterPhysicsStep` via `goalScoreHandler.ts`.

**Tune scoring difficulty** (`Constants.ts` → `GOAL_RINGS`):

| Constant | Effect |
|----------|--------|
| `scoringVolumeRadiusScale` | Base bullseye size (0.25 = tight) |
| `scoringVolumeRadiusScaleBottomMult` | Extra size for **bottom** ring only |
| `scoringVolumeStickOutM` | How far cylinder sticks toward arena (lower = deeper in ring, harder) |
| `sensorDepth` / `midScoringSensorDepth` | Cylinder length along hole axis |

**Rim bounce (ball / player / rocket):**

- Physics: torus trimesh on rings (`buildTorusTrimesh` in `goals.ts`).
- Software backup: `goalRingBounce.ts` — `tickGoalRimBallBounce` (ball), `tickGoalRimCharacterBounce` (player/bot), `findGoalRimSegmentContact` (rockets).

---

## Audio (`audio.ts`)

| Event | Function | Files |
|-------|----------|-------|
| Ambient loop | `startAmbientLoop` | `ambient.wav` |
| Goal | `playGoalCelebration` | `cheering.wav` (50% vol) + `goal1.WAV` |
| Glass hit (away) | `playFanGlassPanic` | `panic.wav` |
| Glass hit (home) | `playFanGlassCheer` | `cheering.wav` |
| Rockets | `playRocketFire` | `shot.flac` |

**Crowd random start:** `randomSampleStartOffset()` — continuous random between **0.3s** and up to **48s** into clip (glass panic/cheer). Goal cheer also uses random start.

**Glass volume falloff:** `fanGlassHit.ts` — `setFanGlassListenerPosition` from `GameCanvas` player position; `crowdVolumeByDistanceM()`.

Volumes: `CHEER_BASE`, `PANIC_BASE`, `GOAL1_SAMPLE_BASE`, `tuningStore` master/impact sliders.

---

## Crowd booths & glass

**`ArenaBillboardFans.tsx`**

- `SplitPerimeterWallWithFans` — wall segments with fan opening.
- `FanBay` — instanced fan spheres, glass mesh, exterior black trim frame.
- Glass: `registerFanGlassMesh` → `fanGlassHit.ts` hit tests.

**Tune glass / fans** (`ARENA_PADS`):

- `fanFacadeGlassForwardM` — glass toward court (higher = fans less likely to clip through).
- `fanGlassFanClearanceM` — front-row fans behind glass.
- `fanGlassCelebrateMs` — fan animation frenzy duration after glass hit.

---

## Billboards

**`ArenaInteractables.tsx`** — `BillboardPanel` with `RocccitLogoStamp`; mounts from `arenaPadLayout.ts` `getBillboardMounts()`.

Frame/screen colors: `BILLBOARD_FRAME`, `BILLBOARD_SCREEN` in that file.

---

## Ball (`Ball.tsx`)

- `RigidBody` + `BallCollider`; held visual mesh separate from body when carried.
- `useAfterPhysicsStep`: goal score → rim bounce → fan glass segment test → `stepBallPhysics`.
- Collision enter: bounce SFX, bot hit announcements.

---

## Rockets (`rocketSystem.ts`, `Rockets.tsx`)

- Not Rapier bodies — manual integration each frame.
- Wall/floor/ceiling bounce, hex bounds, ball hit, **goal ring** segment contact, fan glass, billboards, explosions.
- **Platform + pad hits**: `getMaxPlatformSurfaceY`, `segmentHitsBounceTrampoline` (deck + stem), downward-crossing test for octagon tops.
- **Debug**: `RocketCollisionDebug.tsx` — purple wireframes when **G** collider debug is on.

---

## Player (`Player.tsx`)

- Capsule movement, beam, ball hold, rocket fire (no combat grace block).
- `tickGoalRimCharacterBounce` on goal approach.
- Jersey floor decal: `JerseyDecal.tsx` / `groundDecalTrace.ts`.

---

## Bots (`Bots.tsx`)

- Mirror player systems; `botGoals.ts`, `botHeldBallShot.ts`, `botTuning.ts`.

---

## Common edit checklist

1. **Arena size / height** → `ARENA` in `Constants.ts`, `Arena.tsx`.
2. **Goal ring positions / tilt** → `GOAL_RINGS`, `goals.ts` (`ringTiltX`, `stackedRingCenters`).
3. **Scoring too easy/hard** → `scoringVolumeStickOutM`, radius scales, `scoring.ts` slack.
4. **Rim feel** → `rimBounceRestitution`, `rimOutwardSpeed`, torus colliders in `Arena.tsx`.
5. **Sounds** → `client/user/sounds/` + `audio.ts` constants; preload in `preloadSamples()`.
6. **Fan clipping** → `fanFacadeGlassForwardM`, `fanGlassFanClearanceM`.
7. **Debug colliders** → default on in `gameStore`; **G** toggles Rapier + rocket logical surfaces (purple).

---

## Key files (cheat sheet)

```
Constants.ts          — numbers for everything
Arena.tsx             — world mesh + goal rings + scoring colliders
goals.ts              — goal layout, scoring center, torus mesh helper
scoring.ts            — point-in-cylinder goal detection
goalScoreHandler.ts   — score → store + fireworks + audio
goalRingBounce.ts     — rim contacts + bounces
fanGlassHit.ts        — glass panels + crowd SFX trigger
audio.ts              — Web Audio samples
Ball.tsx              — ball sim + score + glass
Player.tsx            — local player
GameCanvas.tsx        — wires scene + physics + listener pos
ArenaBillboardFans.tsx — crowd booths
RocketCollisionDebug.tsx — purple rocket hit wireframes (G key)
arenaPadLayout.ts       — bounce/trampoline pad layout + rocket segment hits
arenaSpawn.ts           — platform world scale for rocket collisions
```

---

## Archived: hex grass + cube fog (removed from runtime)

**Removed from the live game** for FPS — sources live only under:

`client/src/game/_archive/grass-and-fog/`

Do not import these from gameplay code. Scene fog in **Graphics** (`SceneEnvironment.tsx` + `graphicsStore.fog`) is unrelated and stays.

### Grass (instanced blades on hex floor)

| File | Role |
|------|------|
| `arenaGrassConfig.ts` | Master switch `ARENA_GRASS_ENABLED` |
| `arenaTurfBlades.tsx` | `ArenaTurfBlades`, `startTurfPreheat`, instanced quads on hex |
| `arenaTurfMaterial.ts` | Optional shader turf on floor material (`onBeforeCompile`) |
| `turfGrassColor.ts` | Darken blade colors |

**Was wired:** `Arena.tsx` mounted `<ArenaTurfBlades />`, `gamePreload.ts` preheated blade grid, tuning menu **Arena grass** + **Grass scale**.

**Re-enable sketch:**

1. Copy archive files back to `client/src/game/` (or import from `_archive/grass-and-fog/`).
2. In `Arena.tsx`: `{isArenaGrassBuildEnabled() ? <ArenaTurfBlades /> : null}` after hex floor mesh.
3. Restore grass preload block in `gamePreload.ts` / `gamePreloadStore.ts` (`grass` stage, `grassReady`, `setGrassReady`).
4. Restore `turfGrassEnabled` / `turfGrassScale` in `tuningStore.ts` + TuningMenu arena tab.

Default density was ~4200 blades at scale 1.0; preheat builds grid async on load.

### Cube fog array (voxel puffs)

| File | Role |
|------|------|
| `fogVoxelConfig.ts` | `FOG_VOXEL_ENABLED` master switch |
| `fogVoxelGrid.ts` | 3D cell array inside hex (`buildFogVoxelGrid`, rocket holes, respawn) |
| `fogVoxelMaterial.ts` | Radial sprite texture for point puffs |
| `fogVoxelDebugStore.ts` | Debug toggles (`arrayVisible`, wireframe); **T** key was planned |
| `ArenaInteractableFog.tsx` | `THREE.Points` + optional instanced wire cubes |

**Constants (`FOG_VOXEL`):** `cellSize: 4`, hex inset 12 m, Y from platform top to below wall, rockets clear cells for ~6s, fade in/out.

**Was never mounted in `Arena.tsx` in shipping build** when disabled — only cost if enabled + mounted e.g. `<ArenaInteractableFog />` in scene.

**Re-enable sketch:**

1. Set `FOG_VOXEL_ENABLED = true` in `fogVoxelConfig.ts`.
2. Mount `<ArenaInteractableFog />` in `Arena.tsx` (or `GameCanvas` scene).
3. Wire rocket pass-through to `carveFogVoxelAt` / grid API in `fogVoxelGrid.ts` (see `Rockets.tsx` history).

### Performance notes

- Grass: thousands of instanced meshes + load-time grid build caused load hitches.
- Fog grid: one-time `buildFogVoxelGrid()` allocates large `Float32Array` / `cellMap`; per-frame color updates on all puffs.

---

## Git / workflow

- User prefers **no commits** unless asked.
- Windows dev; PowerShell: use `;` not `&&` between commands.

---

*Last updated May 2026 — see **New notes & ideas** and **Recent gameplay changes** for latest.*
