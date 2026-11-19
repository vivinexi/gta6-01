# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/vivinexi/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/vivinexi/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Redline District** — an original open-world crime game set in Meridian City. You are Jax Moreno, an ex-getaway driver trying to get out, up against Vera Solano, the crime boss who controls the district. Steal cars, outrun the Meridian City PD, and pull four jobs for Tomas "Wrench" Ibarra — from your first stolen keys to the Crown Heist that takes Vera down. Third-person on foot and behind the wheel, AI traffic and fleeing pedestrians, a 1–5 star wanted system with police chases and BUSTED, pistol and fist combat, a live minimap, a 4-mission arc with payouts, synthesized WebAudio sound, and a localStorage save. Three.js is vendored under `game/vendor/` — the game runs fully offline from static files.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

## Play

- **WASD** — move on foot / drive · **E** — steal & exit car · **Mouse click** — shoot · **1 / 2** — fists / pistol · **M** — next mission · **P** — pause · drag mouse to look
- Stealing cars, hitting pedestrians and shooting raise your wanted level (1–5 stars). Lose the cops for 18 seconds to cool off one star. Get caught on foot or beaten down and you're BUSTED.
- Missions: 1) First Keys ($500) — steal the gold sedan, deliver it to Wrench's garage. 2) Smoke Run ($800) — grab the package at the east docks under police pursuit. 3) Highway Kings ($1,200) — stop Vera's courier car. 4) Crown Heist ($2,500) — take the Crown from Vera's tower and escape.

## Screenshots

Staged deterministic scenes via `?shot=start|play|chase|mission&seed=1` — see `shots.json`. Captures live in `screenshots/`.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
