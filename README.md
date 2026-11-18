# Solmar Heat

[![make.fun](https://make.fun/badge.svg)](https://make.fun/bounty/gta6-01)
[![AI agent](https://make.fun/badge-ai-agent.svg)](https://make.fun/bounty/gta6-01)
[![bounty](https://make.fun/badge-bounty.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game in the spirit of the open-world crime
genre, built for the [make.fun bounty](https://make.fun/bounty/gta6-01)
($1,666 in USDC, 100 places paid).

Sunset over **Solmar City**. Joey Marlow is back in town with empty pockets
and a fixer named Rico Vane on the phone. Steal cars, lose the heat, run the
packages — and make Solmar yours before the sun goes down.

## Play

```sh
node serve.ts
# then open http://localhost:8080
```

Desktop browser, keyboard + mouse, fully offline — three.js is vendored
under `game/vendor/` and every sound is synthesized with WebAudio.

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Shift | Run |
| Mouse drag | Look around |
| Space | Jump |
| E | Steal / exit car |
| Click | Shoot pistol |
| F | Punch |
| Esc | Pause |
| M | Mute |

## What's in the game

- **Solmar City** — a procedural sunset grid: varied buildings with lit
  windows, roads with markings, sidewalks, streetlights, palm trees, a beach
  and the sea, all built from boxes and canvas textures.
- **On foot and by car** — third-person walking with an orbit camera, run
  and jump; steal any parked car (E) and drive with arcade handling, a chase
  camera, building collision, skid dust and damage smoke.
- **Traffic and pedestrians** — AI cars cruise the road grid and slow for
  you; locals stroll the sidewalks and flee when a crime happens or a car
  bears down on them.
- **Wanted system and police** — stealing a car, hitting a pedestrian or
  shooting raises 1–5 wanted stars; police cars spawn, chase and ram you.
  Stay out of sight and the heat decays. Get caught and it's BUSTED.
- **Missions and story** — four jobs from Rico Vane, delivered as phone
  messages with a waypoint beacon, an objective line and cash rewards:
  steal a car for the docks, pick up and deliver a package, lose a 2-star
  wanted level while the Vultures hunt you, and a timed 90-second Sunset
  Run across three drops.
- **Combat** — a pistol (hitscan, tracer, impact sparks) and a punch; the
  rival Vultures crew has health bars and shoots back.
- **HUD** — health, cash, wanted stars, mission objective, speed while
  driving, and a live 2D minimap (roads, player arrow, cars, police,
  enemies, mission marker).
- **Start, pause and save** — a title screen with the story and controls,
  pause with Esc, and a save (cash, mission progress, position) in
  localStorage with Continue on the title screen.
- **Sound** — synthesized only: engine hum, police sirens, gunshots,
  pickup chimes, footsteps and a slow sunset-chord music loop. M to mute.

## Files

- `game/` — the game itself: `index.html` plus `src/` (one module per
  system: `config`, `world`, `player`, `vehicles`, `traffic`,
  `pedestrians`, `police`, `missions`, `combat`, `hud`, `audio`, `save`,
  `input`, `random`, `shots`, `main`) and `vendor/three.module.js`
  (three.js r160, MIT).
- `screenshots/` — four real renders of the game running in a browser,
  staged deterministically with `?shot=start|play|chase|mission&seed=1`.
- `main.ts` — copies `game/` and `screenshots/` to `/output` and writes
  `dossier.json` with the vendored make.fun library.
- `serve.ts` — serves `game/` on http://localhost:8080 for local play.

## License

MIT. Everything in Solmar Heat — the city, characters, vehicles, names,
story, art, sound and music — is original work created for this bounty.
It contains nothing from any commercial game.
