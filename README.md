# Corporate Empire — a browser idle-climber

Climb a lava-filled corporate tower while the company runs itself. Floors pay salary, staff earn
while you're away, a fake stock market never sleeps, net-worth milestones promote you all the way to
CEO, and suited NPC coworkers on the tower hand out handshake bonuses.

**Play:** https://kartbala07.github.io/TowerOfHell/

Fan-made browser game: the original build was a clone of the Roblox obby **Tower of Hell**, now with a
corporate idle layer on top. All assets — bricks, studs, faces, lava, sound, the UI — are generated in
code with three.js and WebAudio. Nothing is taken from Roblox or the original creators.

## The loop

1. **Climb.** 30 procedurally generated floors, rising lava, checkpoints every 6 floors. Each new
   floor pays a salary, each coin pays cash, checkpoints pay a "paperwork" bonus.
2. **Hire.** Spend cash in **STAFF** on interns → analysts → middle managers → CFOs → Synergy Bot
   9000. Each tier earns cash per second, forever, including while the tab is closed (offline income
   pays at half rate, capped at 8 hours).
3. **Trade.** **MARKET** has five fake tickers (HELL, CUBE, SYNR, MEME, BOSS) on a random walk with
   drift, volatility and news shocks. Buy and sell with a 0.4% fee; positions save and restore.
4. **Get promoted.** Net worth (cash + portfolio) crosses milestones from Intern to CEO. Every
   promotion pays a signing bonus and permanently multiplies income (x1.0 → x5.0).
5. **Talk to people.** Eleven coworkers plus the CEO stand on floors and the summit. Walk up to one
   and they pay a handshake bonus and say something corporate.

## Controls

| Input | Action |
| --- | --- |
| `WASD` / arrows | move (camera-relative) |
| `Space` | jump (buffered, coyote time) |
| Mouse drag / wheel | orbit / zoom |
| `1` `2` `3` | staff · market · ranks panels |
| `Esc` | close panel |
| `R` | return to last checkpoint |
| Touch | on-screen stick + jump button (landscape) |

## Levels and fairness

Section templates come from a seeded PRNG and each one is **validated at build time**:

- every hop is checked against the real jump arc (measured: apex 2.38, reach 7.18) with a margin,
- landing spots need head clearance so you never get wedged under a platform,
- nothing wide may hang over the spawn pad inside jump height,
- a section that fails validation is rebuilt with a known-good layout instead of shipping broken.

Physics is kinematic: vertical-first resolution, step-up for small ledges, moving-platform carry,
conveyor push, knockback from spinner bars.

## Systems

| File | Role |
| --- | --- |
| `js/economy.js` | cash, 7 staff tiers with 1.18× cost growth, 10 ranks, offline earnings, localStorage save |
| `js/market.js` | 5 tickers, log-random-walk prices, decaying news shocks, buy/sell with fees, sparklines |
| `js/npc.js` | blocky suited NPCs, idle animation, projected DOM name plates, handshake rewards |
| `js/level.js` | tower generation, section templates, colliders, checkpoints, coins, validation |
| `js/game.js` | state machine, HUD, drawer UI, salaries, promotions, win/lose |
| `js/player.js` | avatar, movement, collision, animation, contact shadow |
| `js/lava.js` | rising killing floor |
| `js/engine.js`, `js/input.js`, `js/audio.js`, `js/util.js` | renderer/camera, input, procedural SFX, textures |
| `js/main.js` | boot, frame loop, `window.__sim` test surface |
| `server.mjs` | zero-dependency static server (port 8911) |

## Verified

- Every route platform stood on with real physics across several seeds: **0 failures**.
- Death → checkpoint respawn, elimination, kill-tile death (and *not* dying underneath one), win path.
- Economy: hiring raises idle rate, idle accrues per second, promotions cascade with bonuses,
  offline earnings (45 min → $35.4k at the expected rate), save/reload restores cash, staff, rank,
  portfolio.
- Market: prices move, buy/sell settle with fees and P/L, portfolio counts toward net worth.
- NPCs: spawn per tower, greet once, pay out; name plate projects and hides correctly.
- Live GitHub Pages build boots with zero console errors.

## Run locally

```bash
node server.mjs          # → http://127.0.0.1:8911
```

or double-click **`Start Tower of Hell.command`** (starts the server, waits for `/health`, opens the
browser). The game is fully static — any static host works.

`window.__sim` exposes the test surface: `money()`, `hire()`, `buy()`, `sellAll()`, `npcInfo()`,
`advance(seconds)`, `audit()`, `teleport()`, `setLava()`, `key()`.

## Fan project

Not affiliated with, endorsed by, or connected to Roblox Corporation or the creators of Tower of Hell.
All code, geometry and audio in this repository are original. Not financial advice: the stock is
fake, the lava is not.
