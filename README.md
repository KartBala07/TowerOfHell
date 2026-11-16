# Tower of Hell — browser clone

A fan-made, browser-playable clone of the Roblox obby **Tower of Hell**: climb a
procedurally generated tower while the lava rises behind you. Built with three.js and plain
JavaScript — no build step, no server, no assets to download. Everything (bricks, studs, coins,
lava, sounds) is generated in code.

**Play:** https://kartbala07.github.io/TowerOfHell/

## What it is

- **30 procedurally generated sections** per run, assembled from 8 hand-built obstacle types:
  spiral platforms, switchback ledges, timing spinners, conveyor belts, vanishing pads,
  kill-tile floors, precision pillars and moving platforms.
- **Rising lava** — starts slow, accelerates, and never stops. It kills on contact.
- **Checkpoints** every 6 sections (cyan pads). Dying respawns you there — unless the lava has
  already swallowed your checkpoint, in which case you are **eliminated**.
- **Coins** scattered along the route, a run timer, and personal bests saved in `localStorage`.
- **Original assets only**: brick/stud textures, the face, sky, lava and all sound effects are
  generated at runtime (canvas + WebAudio). Nothing is taken from Roblox.

## Controls

| Input | Action |
| --- | --- |
| `W A S D` / arrows | move (camera-relative) |
| `Space` | jump (buffered, with coyote time) |
| Mouse drag | orbit the camera |
| Mouse wheel | zoom |
| `R` | return to your last checkpoint |
| Touch | on-screen stick + jump button (landscape recommended) |

## Run it locally

```bash
node server.mjs          # → http://127.0.0.1:8911
```

or double-click **`Start Tower of Hell.command`** (starts the server, waits for `/health`,
then opens the browser).

The game is fully static. Open `index.html` from any static host; `server.mjs` is only a
convenience server with `no-store` caching while iterating.

## Levels and fairness

Section templates are generated from a seeded PRNG, then each one is **validated at build time**:

- every hop is checked against the real jump arc (`v²/2g`, run speed, gravity) with a safety margin,
- landing spots are checked for head clearance so the player never gets wedged under a platform,
- a section that fails validation is rebuilt with a known-good layout instead of shipping broken.

The physics is kinematic (vertical-first resolution, step-up for small ledges, moving-platform
carry, conveyor push, knockback from spinner bars). Platform pads stay solid reactively, so a
bad section can't soft-lock a run.

## Project layout

```
index.html            screens, HUD, canvas
css/style.css         Roblox-flavoured UI (menu, death, victory, touch controls)
js/util.js            procedural textures (studs, faces, sky, lava), block builders
js/engine.js          renderer, sky, lights, third-person camera with boom collision
js/input.js           keyboard, mouse-drag look, touch stick
js/audio.js           procedural WebAudio SFX
js/level.js           tower generation, section templates, colliders, checkpoints, coins
js/player.js          avatar, movement, collision, animation, contact shadow
js/lava.js            rising killing floor
js/game.js            state machine, HUD, records
js/main.js            boot, frame loop, `window.__sim` debug surface
server.mjs            zero-dependency static server (port 8911)
```

`window.__sim` exposes `start(seed)`, `advance(seconds)`, `state()`, `teleport()`, `setLava()`,
`audit()`, `key()` and friends — the same hooks the test pass used to verify every platform,
the lava death, checkpoint respawn, elimination and the win path without a human at the keyboard.

## Fan project

Not affiliated with, endorsed by, or connected to Roblox Corporation or the creators of
Tower of Hell. Made as a tribute; all code, geometry and audio in this repository are original.
