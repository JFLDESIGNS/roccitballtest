# Codex Coding Notes

Last updated: 2026-05-30

These notes are a practical handoff for Codex and other coders working on RocccitBall. The older `CODING_NOTES.md` is still useful history. This file is meant to be the cleaner "where things live and what not to break" guide.

## Project Snapshot

RocccitBall is a browser 3D arena game built with React, Three.js, React Three Fiber, and Rapier physics. The game now includes:

- Arena play with goals, rings, rockets, ball attraction, ball carrying, shooting, grappling, flying, grind rails, and map editor tools.
- Multiplayer lobbies with room browser, 1v1, 2v2, server-owned ball work, and coop adventure mode.
- Coop adventure levels with sky platforms, player carrying/throwing, clouds, BTS facts, rails, and level progression.
- Practice mode and a Training Range map for rocket reaction drills and shot distance practice.
- Bad Puter and Really Bad Puter graphics options for weaker machines.

## Run And Build

Root package:

- `npm run build` installs client dependencies with `npm --prefix client ci` and builds the client.
- `npm start` runs `node server/index.mjs`.

Client package:

- `cd client`
- `npm run dev` starts Vite.
- `npm run build` runs `tsc -b` and the Vite production build.
- `npm run lint` runs ESLint.
- `npm run preview` previews a built client.

Server:

- The server is a single Node module at `server/index.mjs`.
- There is no separate `server/package.json`; it uses the root package.
- Railway deployment should run the root start command.

Node:

- Root `package.json` requires Node `>=20`.

## Top-Level Layout

- `client/` - React, Three.js, game client, assets, maps, UI, stores, graphics, physics.
- `server/index.mjs` - multiplayer rooms, websocket/session state, server physics/state updates.
- `CODING_NOTES.md` - older running notes and changelog-style handoff.
- `CODEX_CODING_NOTES.md` - this cleaner coding handoff.
- `.cursor/` - local tool state. Do not edit or commit this folder unless the user explicitly asks.

## Client Entry Points

- `client/src/main.tsx` - React app entry.
- `client/src/App.tsx` - top-level app shell and menu/game routing.
- `client/src/game/GameCanvas.tsx` - main game scene assembly. This is where arena, maps, player, ball, rockets, FX, multiplayer state, and mode-specific objects are mounted.
- `client/src/ui/MainMenu.tsx` - home screen, map select, graphics options, multiplayer/server browser entry.

## Core Game State

- `client/src/game/gameStore.ts` - central local game state.
- `client/src/game/tuningStore.ts` - runtime tuning/debug values.
- `client/src/game/graphicsStore.ts` - graphics mode state such as Bad Puter and Really Bad Puter.
- `client/src/game/InputManager.ts` - keyboard, mouse, pointer lock, controller, and touch input.
- `client/src/game/mobileControls.ts` and mobile UI code - touch controls and mobile detection.
- `client/src/shared/Constants.ts` - constants for movement, rockets, ball, energy, timing, etc.

When changing feel, check stores and constants first. A lot of "simple" changes are split between constants, Player, Ball, and GameCanvas.

## Player Systems

Important files:

- `client/src/game/Player.tsx` - movement, camera-facing controls, holding/shooting, boost/fly, grapple, collision debug, ball pushing, energy, and many feel systems.
- `client/src/game/PlayerAvatar.tsx` - visible character/avatar.
- `client/src/game/characterVisual.ts` - visual transforms and helper layout.
- `client/src/game/CameraController.ts` - camera follow, smoothing, pitch/yaw behavior, collision avoidance.
- `client/src/game/playerName.ts` - player display names.
- `client/src/game/usePlayerController.ts` - controller glue where applicable.

Player collision notes:

- The player has a normal movement body/capsule plus Rocket League style ball-hit cuboids.
- The capsule and Rocket League cuboids should not collide with the player's own body or each other.
- The ball should use the Rocket League hit volumes for ball pushing, not the movement capsule.
- The Rocket League cuboids need to follow player yaw and pitch/tilt correctly.
- Pressing `G` is used for collision/debug visualization in many places.

Camera notes:

- Camera feel is fragile. Recent jitter investigations focused on mouse input, smoothing, pitch centering, camera collision probes, and player/collider self-collision.
- If camera jitter returns, inspect `InputManager.ts`, `CameraController.ts`, and player collider transforms before changing unrelated movement code.
- Camera collision should ignore the ball and the player's own colliders.

## Ball Systems

Important files:

- `client/src/game/Ball.tsx` - local ball visuals/physics hookup.
- `client/src/game/LooseBallVisual.tsx` - smoothed/proxy ball visual.
- `client/src/game/ballAttach.ts` - ball hold/attach positioning.
- `client/src/game/ballHoldResolve.ts` - hold state and release handling.
- `client/src/game/ballPhysics.ts` - shared ball physics helpers.
- `client/src/game/launchShot.ts` - shot impulse behavior.
- `client/src/game/superRelease.ts` - strong release behavior.
- `client/src/game/ballSpin.ts` - spin helpers.

Ball feel notes:

- The visible/fake/proxy ball exists to smooth the physics ball, especially online.
- Multiplayer should avoid client/host assumptions. The long-term direction is server authority for ball state with client-side smoothing.
- When a player has the ball, player-to-ball collision should be disabled. After losing, releasing, or shooting the ball, there should be a short pickup/collision cooldown before the same player can grab it again.
- Ball shot feel is sensitive to both linear impulse and spin. If shots feel dead, inspect client impulse requests and server application of the impulse.

## Rockets And Impacts

Important files:

- `client/src/game/Rockets.tsx` - rocket spawning, visuals, impact callbacks, training hit reporting.
- `client/src/game/rocketSystem.ts` - rocket simulation helpers.
- `client/src/game/rocketPathTube.ts` - rocket path/trail visuals.
- `client/src/game/RocketTrailSmoke.tsx` - rocket trail smoke.
- `client/src/game/explosions.ts` - explosion effects.
- `client/src/game/lightGlowHits.ts` - punch-through interaction with magic light planes.

Recent notes:

- Projectile rockets were made 15 percent faster.
- Rocket trails were darkened.
- Rockets should push the ball and players. Multiplayer ball impulse must be strong enough server-side or the local shot will appear to rubberband.

## Goals And Scoring

Important files:

- `client/src/game/goals.ts` - goal definitions, positions, colliders.
- `client/src/game/scoring.ts` - scoring logic.
- `client/src/game/goalScoreHandler.ts` - scoring events and reset flow.
- `client/src/game/goalRingBounce.ts` - ring/rim bounce behavior.
- `client/src/game/goalRingHitFx.ts` - rim glow and sound feedback.
- `client/src/game/GoalCelebrationOverlay.tsx` - scored UI.

Goal notes:

- Five-goal visual ring, goal cylinder, and backup box colliders have been tuned multiple times. If it looks like changes do not move them, check for duplicated config in practice, arena, multiplayer, and debug helpers.
- The user wants visual goal pieces unchanged when only collider tuning is requested.
- Rim hits should play `rimsound.mp3` and glow the ring.

## Arena And Map Editor

Important files:

- `client/src/game/Arena.tsx` - main arena visuals/collision.
- `client/src/game/StadiumGroupLayer.tsx` - stadium grouped pieces.
- `client/src/game/stadiumLayout.ts` - arena layout constants.
- `client/src/game/CustomMapOverlay.tsx` - overlay for custom maps.
- `client/src/game/mapEditor/*` - editor systems, object definitions, persistence.
- `client/src/game/mapEditor/mapEditorTypes.ts` - built-in map IDs and map data types.
- `client/src/game/mapEditor/presetMaps.ts` - built-in maps.

Map notes:

- Built-in maps currently include Default Arena and Training Range.
- User does not want the old missing `Newbie` map restored.
- Custom maps may live in localStorage.

## Training Range Map

Important files:

- `client/src/game/TrainingRangeMap.tsx` - visible map, markers, platforms, range layout.
- `client/src/game/trainingMapConfig.ts` - dimensions, marker distances, launcher setup.
- `client/src/game/trainingMapStore.ts` - training state, launched balls, hit feedback, driving range state.
- `client/src/game/mapEditor/mapEditorTypes.ts` - `TRAINING_MAP_ID` and `TRAINING_MAP_NAME`.

Current behavior:

- Practice Mode can load Training Range from the map selector.
- Rocket reaction platform shoots balls at the player at varied speed/arc/spin.
- A small 3D UI reports what part of the ball the rocket hit.
- Driving Range is 300 feet with 10 foot markers.
- Standing in the driving square auto-spawns the ball in hand.

## Coop Adventure

Important files:

- `client/src/game/coop/CoopAdventureCourse.tsx` - coop sky course rendering and interaction.
- `client/src/game/coopAdventureLevels.ts` - level data.
- `client/src/game/coopAdventurePlayerThrow.ts` - player carry/throw behavior.
- `client/src/game/coopAdventureFacts.ts` - BTS facts used after levels and token pickups.
- Coop rails/clouds/platform helpers live near these coop files.

Coop design notes:

- Coop adventure should not render the regular arena or leave hidden arena colliders behind.
- Both players start on sky platforms and progress through 10 levels.
- Players can attract/carry/throw each other only in Coop Adventure. Keep this isolated from regular arena gameplay.
- A grabbed/thrown player should have limited or disabled normal control until recovery, and should not be able to grab back while grabbed.
- Both players should reach the goal before level completion advances.
- BTS facts belong in bottom screen UI, not floating in the 3D level.
- Coop rails should replicate to both players and be grindable by both players.

## Multiplayer

Client:

- `client/src/game/multiplayerStore.ts` - room browser, connection state, websocket messages, server browser API calls, remote player snapshots.
- `client/src/ui/MainMenu.tsx` - multiplayer UI and server browser.
- `client/src/game/GameCanvas.tsx` - multiplayer scene hookup.

Server:

- `server/index.mjs` - rooms, players, modes, authoritative match state, websocket transport, server physics.

Multiplayer notes:

- Online mode should not start loading the arena until players press Play Now / join the actual match flow.
- Clients send loaded/ready state before countdown or camera flyaround begins.
- Regular online matches should not spawn bots unless explicitly in bot/practice modes.
- Remote players need interpolation/smoothing, especially for movement and ball carry/release.
- Ball ownership, release, rocket impacts, scoring, goal celebration, and room player counts should be visible to all clients.
- Avoid adding new "host owns this" logic. Prefer server-owned match state or player-owned input events.

## Graphics And Performance Modes

Important files:

- `client/src/game/graphicsStore.ts`
- `client/src/game/ScenePostFX.tsx`
- `client/src/game/LightGlowBillboard.tsx`
- `client/src/game/lightGlowHoles.ts`
- `client/src/game/lightGlowHits.ts`

Notes:

- Bad Puter mode should keep the arena visible while reducing expensive features.
- Really Bad Puter mode is more aggressive, but bloom/postprocessing has caused blank or blue-screen rendering in the past if removed incorrectly.
- Fake smoke/light billboard blobs are local visual effects. Do not network every billboard plane.
- Magic light planes support punched holes from ball/player/rocket collisions. Punch holes should be slightly noisy, not perfectly radial.
- The light plane halo/ring effect should use the light color, not pure white, and fade faster than the main punched alpha hole.

## Audio

Important files:

- `client/src/game/audio.ts`
- `client/src/assets/sounds/`

Known sounds:

- `beamattractloop.mp3` - loop while attraction is actively locked in range.
- `newslap.wav` - ball/player shot release slap.
- `electric_slap_#2-1779935290505.mp3` - older slap/fly-start style sound.
- `grind_on_grind_rail_#2-1779936441147.mp3` - grind rail loop.
- `rimsound.mp3` - goal/rim hit.
- `wind.mp3` - shift/fly loop when enabled.

Audio notes:

- Browser AudioContext warnings are normal until a user gesture resumes audio.
- Avoid large ambient loops while developing unless user wants them back.
- Looping rail sounds use randomized loop start offsets so they feel less repetitive.

## Controls

Core keyboard/mouse:

- `WASD` - move.
- Mouse - look.
- `LMB` - rocket or throw/shoot depending on current held state/mode.
- `RMB` - attract/hold ball, or teammate attraction in Coop Adventure.
- `Shift` - boost/fly behavior.
- `Q` - grapple.
- `E` - interact/build rail in coop where applicable.
- `F` or `T` - spawn/respawn ball in some modes.
- `G` - debug collision/visual helpers.
- `R` - roof/arena helper behavior in some debug flows.
- `U` - light editor/debug in some flows.

Input notes:

- Controller support exists and may feel smoother than mouse when mouse handling regresses.
- Mobile/touch needs two sticks: one for movement and one for camera/look.
- Mouse input should avoid acceleration. Fast left/right mouse movement has been a sensitive jitter case.

## Collision And Debugging Gotchas

- Pressing `G` should reveal useful collision/debug information.
- Ball boundary/fall recovery was intentionally removed or disabled at one point. If reintroducing it, document the change.
- Camera collision should use arena/world objects, not player colliders or ball.
- Jump pad side contacts should trigger normal jump pad bounce logic.
- Grind rails should reset jumps when landed on.
- Clouds in coop should bounce players but not fight input too hard.
- If Rapier throws "recursive use of an object" or WebGL context loss, look for React state or physics body changes during a physics step.

## Visual Assets

Important asset areas:

- `client/src/assets/`
- `client/src/assets/sounds/`
- User-provided external folders have included `C:\Users\joe\Desktop\gamesounds` and `C:\Users\joe\Desktop\roccitmodels`.

Asset notes:

- If copying user assets into the repo, keep names stable and avoid huge files unless needed.
- The user may ask to export arena geometry for texturing. Put exported models in the requested external folder only with approval if outside the workspace.

## Verification Checklist

For most game changes:

1. Run `npm run build` or at least `cd client && npm run build`.
2. Start or use the existing Vite server.
3. Smoke test in browser at `http://127.0.0.1:5173/`.
4. Test the affected mode directly: Practice, Training Range, Arena, Multiplayer, Coop, or Map Editor.
5. Watch the console for WebGL shader errors, Rapier errors, context loss, and websocket/API failures.

For multiplayer changes:

1. Start `npm start` for the server if testing local multiplayer.
2. Open two browser tabs/windows.
3. Verify both clients join the same room/match.
4. Check remote player smoothing, ball authority, scoring, goal reset, and UI replication.

For graphics shader changes:

1. Test Normal, Bad Puter, and Really Bad Puter.
2. Confirm bloom/postprocessing changes do not blank the arena.
3. Check both desktop and mobile-sized viewports.

## Git Hygiene

- Do not revert user changes unless explicitly asked.
- Do not commit `.cursor/`.
- Stage only files related to the requested change.
- After a user asks to push, commit and push the completed work to `main` unless they request a branch.
- Prefer focused commits with clear messages.

## Current Known Sensitive Areas

- Camera smoothing and mouse tracking still need careful testing after changes.
- Multiplayer ball feel can rubberband if server impulses or interpolation are too conservative.
- Coop adventure is still evolving and should stay isolated from regular arena gameplay.
- Magic light planes are visually cool but shader and sampling changes can create seams or performance costs.
- Goal five colliders exist in multiple contexts; make sure practice, normal arena, and multiplayer all receive intended collider changes.
- Player collision shape is a gameplay experiment. Any change to capsule/cuboids can affect camera jitter, ball pushing, and physics stability.

