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
7. **Debug colliders** → default on in `gameStore`; **G** toggles.

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
```

---

## Git / workflow

- User prefers **no commits** unless asked.
- Windows dev; PowerShell: use `;` not `&&` between commands.

---

*Last updated from agent session — adjust constants names if refactors move them.*
