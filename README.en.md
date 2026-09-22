# Red Alert Web — HTML5 RTS Remake

[English](README.en.md) | [中文版 README](README.md)

> ## ⚠️ Disclaimer
>
> **This is an unofficial personal learning project. It has no affiliation with
> Electronic Arts Inc.**
>
> - It contains **no assets** from any commercial game: all graphics are drawn
>   procedurally with HTML5 Canvas and all sounds are synthesized in real time
>   with the Web Audio API. There is not a single image or audio file in this repo.
> - Unit and building names are used as **descriptive references only** and do not
>   constitute trademark use.
> - The source code is released under the MIT license, which covers **only the
>   author's original code** and grants no rights over any third-party IP.
> - If you are a rights holder and believe this project infringes on your rights,
>   please open an issue — I will cooperate.

An HTML5 Canvas real-time strategy game in the style of *Red Alert*
(unofficial remake).

## Running It

**Play it online**: <https://red-alert-web-game.app.workbuddy.host/>
(static hosting, no installation required, works in mobile browsers too.)

**You must serve it over HTTP — double-clicking `index.html` will not work.**
The game uses native ES6 modules (`<script type="module">`), which browsers block
under the `file://` protocol due to CORS. Double-clicking gives you a blank page
and this console error:
`Access to script at 'file:///...' has been blocked by CORS policy`.

```bash
# Bundled server (recommended — caching disabled)
python3 serve.py            # opens http://localhost:8123

# Or any static server
python3 -m http.server 8000
npx http-server
php -S localhost:8000
```

Then open `http://localhost:8123`.

> Why disable caching: the default `http.server` serves `.js` with `Last-Modified`,
> so after editing code, F5 often still loads the old module — it looks like
> "my change did nothing".

## Controls

### Basics
- **Left click**: select a unit or building
- **Left drag**: box-select multiple units
- **Shift + left click**: add/remove from selection
- **Right click**: move units or attack a target
- **Ctrl + wheel**: zoom the camera
- **Wheel / Shift + wheel**: scroll the map
- **Space**: pause / resume
- **Delete**: delete selected units
- **F5**: save game
- **F9**: load game

### Auto-engage (Red Alert 2 behavior)

Every unit and defensive structure with an attack **fires automatically** as soon
as an enemy enters range — no attack order needed. Units also shoot while moving,
and will hit opportunistically if another enemy wanders into range mid-chase.

- Player units **will not** chase outside their range, so they never abandon your
  move order on their own. The enemy AI does chase.
- Engineers, spies and other unarmed units do not engage. Harvesters focus on
  gathering ore and never auto-engage.

### Building Pathing

**Your own buildings do not block your own units.** No matter how densely you pack
your base, infantry and vehicles walk straight through your own structures and can
never be walled in by them. Enemy buildings still block movement. Newly produced
units always spawn on free tiles, never inside a building.

### Unit Commands
- **S**: stop current order
- **A**: attack-move (move while engaging enemies along the way)
- **G**: guard current position
- **Ctrl+A**: select all your units
- **Ctrl+1..9**: create a control group
- **1..9**: recall a control group (double-tap to jump the camera)
- **Home**: jump to the base

### Resource Management
- Harvesters automatically gather the yellow ore
- Ore is delivered to a refinery and converted into credits
- Credits fund construction and unit production

### Buildings
- **Construction Yard**: base core, provides 50 power
- **Power Plant**: provides 200 power
- **Ore Refinery**: processes ore, comes with a harvester
- **Barracks**: trains infantry
- **War Factory**: builds vehicles
- **Radar**: unlocks the minimap view
- **Battle Lab**: unlocks advanced tech units
- **Service Depot**: repairs nearby vehicles automatically

### Defenses
- **Wall**: cheap obstacle
- **Pillbox**: fast-firing anti-infantry defense
- **Turret**: heavy anti-armor cannon
- **Flak Cannon**: fast-firing anti-air
- **Tesla Coil**: powerful electrical attack (requires Battle Lab)

### Factions

The player is always **Allied**; the enemy is always **Soviet**. The build panel
only lists your own faction and shared units — enemy-faction units no longer appear
(`canBuild` used to skip the faction check, letting Allies build Apocalypse tanks).

### Unit Roster

| Class | Allied | Soviet | Shared |
|---|---|---|---|
| Infantry | GI, Guardian GI, Tanya, Spy | Conscript, Flak Trooper, Attack Dog, Crazy Ivan | Engineer |
| Vehicles | Grizzly Tank, Mirage Tank, Prism Tank, IFV | Rhino Tank, Apocalypse Tank, V3 Launcher, Flak Track | Artillery |
| Aircraft | Intruder, Black Eagle, Longbow | MiG, Hind, Kirov Airship | — |
| Naval | Destroyer, Aegis Cruiser | Submarine, Dreadnought | — |
| Harvesters | Chrono Miner | War Miner | — |

### Unit Traits (Red Alert 2 rules)

- **Prism Tower**: adjacent prism towers focus their beams on one target; each extra
  tower adds +50% damage
- **Tesla Coil**: huge power drain — cannot fire when the base is low on power
- **Apocalypse Tank**: fires both barrels at once
- **Tanya**: carries C4, devastating against buildings; can solo a base
- **Attack Dog**: kills infantry in one bite
- **Spy**: infiltrates an enemy building, triggers an effect, then disappears —
  Power Plant causes a 15s blackout; Barracks/War Factory promotes all your
  existing troops to veteran; anything else steals credits
- **Service Depot**: continuously repairs ground vehicles in range (~60 HP/s)

### Armor vs. Damage Types

Every unit/building has an **armor type** and every weapon a **damage type**;
the hit multiplier comes from the matrix below. This is not a decorative table —
`Entity.calculateDamage` actually looks it up:

| Damage \ Armor | None | Light | Medium | Heavy | Concrete | Steel |
|---|---|---|---|---|---|---|
| Bullet | 100% | 100% | 70% | 40% | 20% | 10% |
| Cannon | 100% | 120% | 100% | 80% | 60% | 40% |
| Rocket | 80% | 80% | 100% | 100% | 80% | 60% |
| Missile | 100% | 100% | 100% | 100% | 100% | 80% |
| Laser | 100% | 100% | 100% | 80% | 60% | 50% |
| Electric | 100% | 100% | 90% | 90% | 50% | 30% |
| Bomb | 100% | 100% | 100% | 100% | 120% | 100% |
| Torpedo | 0 | 0 | 0 | 0 | 0 | 0 (150% vs. ships) |

What it feels like in play: for the same 100 nominal damage, a rifle does the full
100 to infantry, only 70 to a Grizzly Tank (medium armor), and just 20 to a concrete
structure — while a bomb gets a 120% bonus against concrete. Torpedoes always deal
0 to land targets.

Per-weapon damage types live in `DAMAGE_BY_TYPE` and per-unit armor in
`ARMOR_BY_TYPE` (both in `definitions.js`); anything not listed falls back to
`DEFAULT_ARMOR_BY_CATEGORY` by unit class.

### Superweapons

All four superweapons (Nuclear Missile / Lightning Storm / Iron Curtain /
Chronosphere) share a **90 second** cooldown. Charging only starts once the
corresponding structure (Nuke Silo, Weather Control Device, ...) is complete, and
**if that structure is destroyed the superweapon is immediately unregistered** —
no orphaned countdown ticking forever.

### FAQ

**I can't produce units anymore.** Check the population counter in the top bar
(`used/60`). At cap, production pauses instead of deadlocking and resumes
automatically when slots free up. If a build entry is unavailable, it states the
reason right on the entry (missing tech, power, or credits) and also pops a toast.

**Why is my new unit not moving?** Fresh units walk to the rally point and guard
there; select the production building and right-click the map to set a new rally
point. While guarding, units retaliate against enemies in range and return after
chasing a limited distance.

### Victory
- Destroy the enemy Construction Yard to win
- Lose if your own Construction Yard is destroyed

## Features

- Full RTS experience
- AI opponent with three difficulties (Easy / Normal / Hard)
- Resource gathering and management
- Power grid system
- Armor / damage-type counters (rifles bounce off tanks, bombs wreck buildings)
- Four superweapons (90s cooldown)
- Many building and unit types
- Minimap
- Control groups
- Save / load
- Adjustable game speed (1x / 2x / 4x)
- Camera zoom

## Implementation

- HTML5 Canvas rendering
- Native ES6 modules (20 modules, no build step — just open `index.html`)
- A* pathfinding (indexed binary heap + generation timestamps for reusable
  work arrays; zero object allocation per search)
- Uniform-grid spatial index (`SpatialGrid`) backing all four query paths:
  point pick, box select, range, and splash
- Precomputed static terrain connectivity, so unreachable targets don't burn
  iterations
- Fog of war (incremental decay + dirty flag + 1px-per-tile offscreen canvas)
- Game loop, state management, AI behavior, Web Audio API sound effects

### Module Layout

| Module | Lines | Responsibility |
|---|---|---|
| `main.js` | 600 | Game loop, module wiring, command entry points |
| `Sprites.js` | 652 | Canvas drawing of units and buildings |
| `Renderer.js` | 565 | Scene rendering, viewport culling, terrain tile cache |
| `SuperWeapon.js` | 567 | Superweapon charging / firing / unregistering |
| `UI.js` | 527 | HUD, build panel, minimap |
| `GameMap.js` | 516 | Map generation, terrain tiles, occupancy grid |
| `GameState.js` | 418 | World state, entity add/remove, four spatial queries |
| `UnitAI.js` | 373 | Unit AI, pathfinding driver, harvesting, spies |
| `InputHandler.js` | 367 | Mouse and keyboard input |
| `definitions.js` | 241 | Unit and building stat tables |
| `EnemyAI.js` | 238 | Enemy AI |
| `FogOfWar.js` | 229 | Fog of war |
| `SaveManager.js` | 213 | Save serialization |
| `Entity.js` | 208 | Entity base class + damage calculation |
| `AudioManager.js` | 207 | Sound effects |
| `Combat.js` | 179 | Firing, projectiles, splash, explosions, floating text |
| `Buildings.js` | 162 | Building AI, production, repair bay |
| `SpatialGrid.js` | 147 | Uniform grid index |
| `constants.js` | 29 | Global constants (including `FPS`) |
| `Notifications.js` | 12 | Injectable notification outlet |
| `GameTuning.js` | 11 | Centralized tuning constants |

`Notifications.js` is a 12-line "notification outlet": extracted modules shouldn't
have to thread a `notify` callback through every layer just to show a toast, so they
register with the outlet once and `main.js` injects the real implementation at
startup. Unregistered, it silently drops messages, which keeps the modules
importable in unit tests without crashing.

## Tests

The test suite lives outside this repo (`red-alert-tests/`) and drives the **real**
game loop under Node: `window`, `document`, `localStorage` and `navigator` are
stubbed and `requestAnimationFrame` is taken over manually, so it exercises the
same production code rather than a mock reimplementation.

```bash
node smoke.mjs        # 8   — does it load, does it tick
node correctness.mjs  # 28  — correctness regressions (incl. 7 spy infiltration)
node armor.mjs        # 40  — armor / damage matrix
node sim.mjs          # 13  — 1400-frame stress simulation
node modules.mjs      # 19  — module interfaces and callback adapters
```

Two practices matter here:

- **Fixed random seed**: map generation uses `Math.random`, so without a fixed seed
  the same simulation gives different results each run and tests fail randomly.
  `harness.mjs` swaps in mulberry32.
- **Reverse proof**: every assertion must be able to go red when the corresponding
  fix is reverted. Verifying only "it's green after the change" cannot distinguish
  "fixed" from "assertion is vacuous" — 2 assertions in this round turned out to be
  vacuous and were only caught by reverse proof.

## Performance Notes

### Round 6 (latest): terrain pre-rendering + removing `Math.hypot`

Benchmark script `bench_round6.mjs`, same methodology as round 5 (interleaved A/B
in one process, median of multiple rounds).

| Item | Before | After | Verdict |
|---|---|---|---|
| ORE/WATER terrain draw (full 5184-tile scan) | 34449 canvas calls | 5519 | **-84%, kept** |
| `updateProjectiles` (200 projectiles) | 15.99 ms | 6.00 ms | **2.67x, kept** |
| `moveUnit` | 1.46 ms | 1.20 ms | **1.22x, kept** |
| Distance test inside range queries | 1.88 ms | 1.94 ms | within ±3% noise; clearer semantics, kept |

- **Terrain pre-rendering**: ORE (crystals) and WATER (ripples) bypassed the tile
  cache and were drawn procedurally every tile every frame — ORE cost ~14 canvas
  calls per tile (6 two-layer diamonds) plus 1 `sin`; WATER cost 5 calls plus 2
  `sin`. In the heaviest viewport measured, these two terrain types covered 28.9%
  of tiles (501/1734), producing ~4000 redundant calls per frame. Now pre-rendered:
  WATER is quantized into 64 phase steps (the phase includes tx/ty, so tiles are
  naturally offset; 64 steps over a 2.6s cycle ≈ 25 steps/sec, imperceptible for
  slow ripples); ORE crystals are pre-rendered into 24 transparent layers keyed by
  "crystal count × variant", with the breathing pulse applied via `globalAlpha` at
  draw time. Each tile drops to 1–2 `drawImage` calls. The win is on the browser
  side (canvas API call overhead); the stub environment uses call count as a proxy.
- **Removing `Math.hypot`**: `hypot` is an overflow-safe implementation and measures
  ~7x slower than `sqrt(dx²+dy²)`. Game coordinates max out at 2304px, so the sum of
  squares is nowhere near overflowing a double — the safety is pure waste. All 25
  call sites were replaced per scenario: squared comparison where only ordering
  matters (skipping the `sqrt` entirely), `sqrt` where a normalized direction or
  falloff needs the true distance. The ±3% delta inside the range query is within
  measurement noise (that path is bottlenecked by cell traversal, not the distance
  function); keeping the squared form there is a semantics choice, not a
  performance claim.
- **Spy infiltration on the spatial index**: previously every spy scanned all
  entities each frame (O(n)/frame); now `forEachInRange` (zero allocation, early
  exit), with radius +3 tiles to cover large-building center offsets. Guarded by 7
  cases in group ⑧ of `correctness.mjs` (including size-3 multi-tile building hits
  and no false positives at range). Reverse proof: disabling the infiltration path
  turns 8a/8c red.

### Round 5: structure split + render hotspots

Benchmarked with **interleaved A/B in a single process** (swapping old/new order
each round, median of 5 rounds) — running old-then-new lets JIT warm-up skew the
result, and a single pair of numbers can imply the opposite conclusion.

| Item | Before | After | Verdict |
|---|---|---|---|
| Terrain tile fetch (5184 tiles) | 0.31 ms | 0.05 ms | **5.74x, kept** |
| Viewport culling (projectiles/explosions/text) | — | skipped 144/200 projectiles | **kept** |
| Pooling the range-query array | 7.47 ms | 8.06 ms | 1.08x slower, **reverted** |
| Reusing the entity y-sort buffer | 15.63 ms | 15.87 ms | 1.02x slower, **reverted** |

- **Terrain tile cache**: `tileCache` was keyed by string (`x + ',' + y`), building
  and hashing a string for thousands of tiles every frame; switching to a 2D array
  indexed by `[ty][tx]` removed that entirely. About 14 µs per frame — 0.09% of a
  16.7 ms budget.
- **Viewport culling**: projectiles use a segment bounding box, explosions and
  floating text a circle bounding box; anything outside the viewport is skipped.
  Canvas is stubbed in this benchmark environment (draws are no-ops), so no time
  difference is measurable here — the gain only shows up in a browser. Only the
  number of skipped objects is listed, as an upper bound.
- **Two "obvious optimizations" were rejected**: a ring buffer for the range query
  and a reused array for entity sorting both looked like allocation savings but
  measured slower. Neither site was hot (range queries are 0.5% of a frame budget),
  and the ring buffer added index arithmetic plus dirty checks. Comments were left
  in the code so nobody re-optimizes them later.

### Round 4: pathfinding and spatial index

| Item | Before | After | Speedup |
|---|---|---|---|
| A* pathfinding ×2000 | 610 ms | 185 ms | 3.9x |
| Splash candidate query ×2000 | 35 ms | 8 ms | 4.2x |
| Box select query ×2000 | 11 ms | 3 ms | 3.9x |
| Harvester → nearest refinery ×3000 | 5.8 ms | 0.7 ms | 7.9x |

Key changes:

1. **Zero-allocation pathfinding**: the A* open set moved from an object binary heap
   to an indexed binary heap (`Int32Array` for node indices, `Float32Array` for f
   values), eliminating tens of thousands of temporary allocations per search;
   neighbor offset tables and work arrays were hoisted to module/instance scope for
   reuse.
2. **Static connectivity pre-check**: when a target is unreachable, A* burned its
   full 3000-iteration cap — 79% of total iterations measured. Terrain connected
   regions are now precomputed at map generation / load time; targets in a different
   region get a compressed iteration cap, trading a little "get as close as
   possible" precision for no stutter.
3. **Per-frame pathfinding budget**: at most 6 searches / 9000 node expansions per
   frame; excess calls downgrade to a floor iteration count, avoiding the frame
   spike when a player orders dozens of units at once.
4. **Spatial index coverage**: `SpatialGrid` used to serve a single query; point
   pick, box select, splash and refinery lookup were all O(n). All are now wired
   up, and a bug where large multi-tile buildings were returned twice (double-counted
   splash damage) is fixed.
5. **Refinery cache**: harvesters searched all entities every frame to find the
   nearest refinery; now a cache invalidated on entity add/remove.

## Correctness Bugs Fixed This Round

These all "break the game for real" without throwing any error. Each has a
regression test guarding it:

| # | Symptom | Root cause |
|---|---|---|
| ① | Superweapons reusable after 10 seconds | `cooldown: 600` was frames (10s) while the comment said "10 minutes"; the unit confusion made them nearly impossible to counter. Now `cooldownSec: 90`, converted via `FPS` |
| ② | After loading, unfinished buildings could be walked through and built over | occupancy restore had `&& e.built`, so in-progress buildings never entered the occupancy grid |
| ③ | After loading, freshly produced units stood frozen | `autoGuard` wasn't in the save whitelist, and its trigger required `path.length > 0` while `path` is never saved — so it could never be true |
| ④ | Nuke still counting down and firing after its silo was destroyed | superweapons were registered when the building completed with no unregister path |
| ⑤ | Engineer right-clicked onto your own full-HP building froze forever, ignoring all orders | that branch never cleared `attackTarget`, and there was no fallback when the path was unsolvable |
| ⑥ | Player units couldn't target enemy buildings under construction, but splash damage still hit them | `getEnemiesInRange` filtered on `e.built`, inconsistent with `applySplashDamage` |
| ⑦ | After loading, all mouse input acted on the old world (click and box select dead) | loading constructs a brand-new `GameState` and camera while the input layer still held the old references |

⑦ is worth calling out for how it was verified: commenting out `input.rebind(...)`
turns the test red immediately (`input._gameState` still points at the pre-load
world), confirming the assertion isn't vacuous.

## License

Code is released under the **MIT** license (see `LICENSE`) — free to use, modify,
and redistribute commercially or in closed-source derivatives, provided attribution
is kept.

Note that this license covers **only the original code in this repo**, not any
third-party intellectual property. See `NOTICE` for trademark and IP statements;
redistributors are encouraged to read it.

## Known Issues

- Balance needs further tuning
- The spatial index inserts entities by their top-left tile but tests hits by center,
  so queries expand by 1 tile; buildings larger than 16 tiles would need a larger
  expansion
- `InputHandler` never removes its event listeners; restarting currently relies on
  `location.reload()`. Supporting in-game "restart" requires `removeEventListener`
  first

## Future Work

- `GameState.getBuildReason` and `canBuild` duplicate their precondition checks;
  extract `checkBuildGate(type, team)`
- `main.js` still holds 20+ module-level mutable variables (`gameState`, `camera`,
  `selectedUnits`, ...). Further splitting needs an explicit `Game` context object
  first, otherwise it just spreads globals across more files
- More unit and building types
- Multiplayer
- A map editor
