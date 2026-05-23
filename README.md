# RocketBall Arena Web

Browser-based spiritual successor to Rokkitball — fast 3D arena sport with rockets and a magnetic beam.

## Stack

- **Client:** React + Vite + React Three Fiber + Rapier.js

## Run locally

```bash
cd client
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`). Click the game view to capture the mouse.

Requires **Node.js 20+**.

## Deploy on Vercel

Pick **one** setup in **Project → Settings → General → Build & Development Settings**.

### Option A — recommended (simplest)

| Setting | Value |
|--------|--------|
| Framework Preset | **Vite** |
| Root Directory | **`client`** |
| Build Command | *(leave default `npm run build`)* |
| Output Directory | **`dist`** |
| Install Command | *(default `npm install`)* |

Uses [`client/vercel.json`](client/vercel.json) for SPA routing.

### Option B — repo root

| Setting | Value |
|--------|--------|
| Framework Preset | **Other** |
| Root Directory | **`./`** (empty) |
| Output Directory | **`client/dist`** *(not `dist`)* |

Uses root [`vercel.json`](vercel.json).

### If you see `404: NOT_FOUND` after deploy

The build succeeded but Vercel is serving an **empty folder**. Almost always:

- Root is `./` but **Output Directory** is `dist` → change to **`client/dist`**, or switch to **Option A** (`client` + `dist`).
- Root is `client` but **Output Directory** is `client/dist` → change to **`dist`** only.

Then **Deployments → … → Redeploy** (or push a new commit).

No backend or env vars are required. The game runs entirely in the browser (WebGL + Rapier WASM).

## Controls

| Input | Action |
|-------|--------|
| WASD | Move |
| Mouse | Look |
| Space | Jump |
| Shift | Sprint |
| Left click | Fire rocket |
| Right click hold | Magnetic beam |
| E | Throw ball |
| Tab | Scoreboard |
| Esc | Exit to menu |

## MVP status (v0.2)

- [x] Greybox Neon Foundry arena
- [x] Third-person movement + pointer lock
- [x] Ball physics (Rapier)
- [x] Rockets with explosions
- [x] Wall goals (1 / 3 / 5 points)
- [x] Magnetic beam + hold + throw
- [x] Energy system (sprint / beam / hold)
- [x] HUD (score, timer, energy, countdown)
- [x] Practice bots (optional)

## Project layout

```
client/src/
  shared/     Constants, Types
  game/       Arena, Player, Ball, Rockets, HUD, GameCanvas
  ui/         MainMenu, TuningMenu
client/user/  Sounds, textures, 3D models (required for build/deploy)
```
