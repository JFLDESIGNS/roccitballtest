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
```
