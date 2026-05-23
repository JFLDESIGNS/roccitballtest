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

This repo is a static Vite app under `client/`. Root [`vercel.json`](vercel.json) points Vercel at that folder automatically.

1. Push the latest `main` branch to GitHub (if you have not already).
2. Sign in at [vercel.com](https://vercel.com) → **Add New…** → **Project**.
3. Import **JFLDESIGNS/roccitballtest** (or your fork).
4. Leave defaults: **Framework Preset** Vite, **Root Directory** empty (repo root). Build uses `vercel.json`.
5. Click **Deploy**. You get a URL like `https://roccitballtest.vercel.app`.

No backend or env vars are required. The game runs entirely in the browser (WebGL + Rapier WASM).

Optional CLI (after `npm i -g vercel` and `vercel login`):

```bash
cd client
vercel
```

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
