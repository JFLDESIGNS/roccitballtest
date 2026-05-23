# RocketBall Arena Web

Browser-based spiritual successor to Rokkitball — fast 3D arena sport with rockets and a magnetic beam.

## Stack

- **Client:** React + Vite + React Three Fiber + Rapier.js
- **Planned:** Colyseus server (v0.3+)

## Run locally

```bash
cd client
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`). Click **Enter Practice Arena**, then click the game view to capture the mouse.

Requires **Node.js 20+** (Vite 8 / current toolchain).

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

- [x] Greybox Neon Foundry arena (70×42×18m)
- [x] First-person arcade movement + pointer lock
- [x] Ball physics (Rapier)
- [x] Rockets with explosions
- [x] Wall goals (1 / 3 / 5 points)
- [x] Magnetic beam + hold + throw
- [x] Energy system (sprint / beam / hold)
- [x] HUD (score, timer, energy, countdown)
- [ ] Colyseus multiplayer (v0.3)
- [ ] Lobby / matchmaking (v0.4)

## Project layout

```
client/src/
  shared/     Constants, Types
  game/       Arena, Player, Ball, Rockets, HUD, GameCanvas
  ui/         MainMenu
```

## Design reference

See the design doc in project chat / issues for full specs (teams, networking, performance budgets).
