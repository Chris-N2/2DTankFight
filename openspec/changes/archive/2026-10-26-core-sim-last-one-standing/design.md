## Context

Greenfield: the repository holds only CLAUDE.md, OpenSpec configuration and an empty `src/`. CLAUDE.md fixes the
broad architecture: TypeScript throughout, a pure fixed-timestep simulation shared by the browser (single-player) and a
future Node server (authoritative multiplayer), and single-player first. See proposal.md for scope and motivation, and
the five delta specs for the required behaviour.

## Goals / Non-Goals

**Goals:**
- A package boundary that makes it *hard* to accidentally put browser or wall-clock code into the simulation.
- Simulation state that is plain, serialisable data, so a later change can send snapshots over a network unchanged.
- Game rules (round lifecycle, scoring) inside the simulation package, so the server can run them too.
- Balance values in one place, so tuning doesn't mean hunting through code.

**Non-Goals:**
- Cross-engine bit-exact determinism (needed for lockstep netcode, which we are not doing; the server is authoritative).
- Client-side prediction, interpolation of remote entities and snapshot compression (multiplayer change).
- Audio, sprites/asset pipeline, mobile/touch controls, gamepad support.
- Deployment/hosting (the build output is a static site; publishing it comes later).

## Decisions

### D1. npm workspaces under `src/`
```
package.json            (workspaces: ["src/*"], shared scripts)
tsconfig.base.json
src/sim/                @tank/sim    — simulation, rules, AI, boards (no DOM)
src/client/             @tank/client — Vite app: rendering, input, screens
(src/server/            @tank/server — added by the multiplayer change)
```
Two packages from day one, rather than one package with folders, so the dependency direction (client → sim, never
sim → client) is enforced by the package graph. Root scripts: `dev`, `build`, `typecheck`, `lint`, `test`, `format`.

### D2. Enforcing simulation purity mechanically
- `src/sim/tsconfig.json` uses `"lib": ["ES2022"]` with **no DOM lib**, so `window`, `document`,
  `requestAnimationFrame` and similar won't compile.
- ESLint `no-restricted-globals` / `no-restricted-properties` in `src/sim` bans `Date`, `performance`, `setTimeout`,
  `setInterval` and `Math.random`.
- Alternative considered: convention plus code review. Rejected because QA would have to catch every slip by eye.

### D3. Tooling
TypeScript (strict), Vite for the client dev server and build, Vitest for tests (the same runner works for sim and
client), ESLint (typescript-eslint, flat config) and Prettier. Node 22 LTS (installed). All of these are mainstream
and need little configuration.

### D4. Rendering with plain Canvas 2D
The visuals are a handful of rectangles, rotated tank shapes and dots. Canvas 2D handles that easily at 60 fps with
no dependency.
- *PixiJS* (WebGL): more than we need now; can be swapped in behind the renderer later if effects get ambitious.
- *Phaser*: owns the game loop and physics, which fights the "our simulation is the authority" design.
- *SVG/DOM*: simple, but per-frame DOM churn and effects are clumsier.
Tanks are drawn procedurally (hull, tracks, turret barrel) and filled with a per-tank colour; the human's tank gets a
"YOU" marker. Recolouring is trivial, which suits the later cosmetics change.

### D5. Simulation shape
- **State is plain data**: objects, arrays, numbers and strings only, with no class instances, Maps or closures. This
  makes it serialisable (later network snapshots) and easy to compare in determinism tests.
- **API**: `createMatch(options, board, seed) → MatchState` and `step(state, inputs) → SimEvent[]`. `step` mutates
  `state` in place for speed and returns that tick's events (`shotFired`, `bounce`, `hit`, `eliminated`,
  `roundStarted`, `roundEnded`, `gameEnded`). The client renders effects from events, never by diffing state.
- **Tick**: 60 Hz (`dt = 1/60 s`). All durations (cooldowns, countdowns, AI reaction delays) are stored as tick
  counts, so there is no floating-point drift in timers.
- **Coordinates**: world units, x to the right, y down (matching canvas), heading in radians with 0 = east. "Turn
  left" means anticlockwise *as seen on screen*.
- **RNG**: a small seeded PRNG (sfc32) whose 128-bit state is stored in `MatchState` as four numbers. Separate streams
  for match decisions (spawn assignment) and AI, so changes to AI randomness don't reshuffle spawns.

### D6. Collision model
- **Tanks** collide as circles (radius slightly inside the drawn hull, which feels fair). **Obstacles and the
  boundary** are axis-aligned rectangles.
- **Tank movement** is resolved per axis: apply the x component and cancel it on overlap, then the same for y. With
  axis-aligned walls this produces sliding naturally. Tank-on-tank overlap cancels the offending axis the same way.
- **Shells** are points moved by a swept segment each tick and tested against rectangles with a slab/ray test. The test
  returns the earliest contact and the face normal, so tunnelling is impossible at any speed. On first contact the
  velocity component along the normal is negated and the shell continues for the rest of the tick. On second contact
  it is removed.
- **Shell vs tank** uses segment-vs-circle for the same no-tunnelling reason. The "no self-hit before bounce" rule is
  a check on `shell.ownerId` and `shell.bounces`.
- **Muzzle inside a wall** (tank pressed against an obstacle): the shell is spawned at the muzzle and its first sweep
  starts from the tank centre. It therefore contacts the wall immediately, bounces, and may come straight back at the
  firer. That follows directly from the rules and is very much in the spirit of Combat.

### D7. Rules layer inside the simulation
`MatchState` holds a `phase` — `countdown → playing → roundOver → (countdown | gameOver)` — plus phase timers in ticks,
the scores, the round number and the options. Countdown (3 s) and round-result (2.5 s) timers run inside the
simulation, so a future server drives the same flow. During `countdown`, `roundOver` and `gameOver` the world is
frozen: inputs are ignored and shells do not move, so they cannot change a result after the round has ended. The
client keeps playing explosion effects during the freeze, so it still looks lively.

Round-end evaluation runs once per tick, after all hits have been resolved, using the rules in the
`last-one-standing` spec. Game end uses `lead > roundsRemaining`.

### D8. AI architecture
The AI lives in `@tank/sim` (the server will need it) as `think(state, tankId, memory) → TankInput`. Per-tank AI memory
(target, path, timers, RNG-derived aim offset) is plain data inside `MatchState`. `step` calls `think` for each AI
tank before advancing the world, so callers (the client now, the server later) only supply human inputs, and AI inputs
and human inputs enter the world step the same way.
- **Navigation grid**: built once per board. The cell size is about the tank radius, and obstacles are inflated by
  the tank radius, so any walkable cell fits a tank. A* gives paths and is re-planned about every 0.5 s or when the
  target changes. The same grid powers the arena validator's connectivity check (flood fill).
- **Goal**: the nearest walkable cell with a clear shot at the target (see Combat), falling back to the target's
  position.
- **Steering**: turn towards the next waypoint and drive forward when the heading error is below a threshold;
  otherwise turn on the spot.
- **Combat**: an AI engages only when it has a *clear shot*: a lane about 16 units wide between the two tanks with no
  obstacles in it, not just a clear centre-to-centre line. Once the reaction delay has elapsed, it turns to face the
  target with a small random aim offset and fires when within aim tolerance, provided the barrel's actual line is also
  clear. The offset is re-rolled after every shot.
  *Found during implementation:* the soak test caught two AI tanks with a bare line of sight whose aim error made
  every shell clip the same corner. They traded misses forever, and the round never ended. The clear-lane rule and
  re-rolling per shot fixed it.
  *Found in QA:* about 1% of rounds could still freeze. An aim error could leave the barrel clipping a corner, so the AI
  never fired and therefore never re-rolled; close in, it didn't move either. Now an AI that is lined up but blocked
  re-rolls its aim every reaction delay, and after a stuck window it reverses away and tries again. Stuck detection
  also runs while it advances on a visible target, it only drives straight at a distant target when the lane is wide
  enough for the tank itself (otherwise it follows a route), and routes aim for a spot within engage range.
- **Stuck recovery**: if progress over about 1 s falls below a threshold, reverse and turn for about 0.5 s, then
  re-plan.
- Alternatives considered: steering behaviours or potential fields only. These are simpler but get trapped in
  concave obstacle layouts. Behaviour trees are overkill for one behaviour set.

### D9. Balance values
A single `DEFAULT_CONFIG` object in `@tank/sim`, passed into `createMatch`, with these starting values:

| Value | Default | Notes |
|---|---|---|
| Arena | 1200 × 800 units | 3:2 aspect |
| Tank radius | 18 | collision circle |
| Forward / reverse speed | 120 / 70 units/s | |
| Turn rate | 180°/s | |
| Shell speed | 360 units/s | 3× tank speed |
| Shell lifetime | 3 s | |
| Fire cooldown | 0.5 s | |
| Max hit points / shell damage | 3 / 1 | |
| Countdown / round-result pause | 3 s / 2.5 s | |
| AI reaction delay | 0.35 s | |
| AI aim error / aim tolerance | ±3° / 4° | |
| AI fire pause | 0–0.15 s, random per shot | added after playtesting; see below |
| Board: min obstacles / min spawn spacing | 6 / 250 units | |

**Found during playtesting:** with only the shared 0.5 s cooldown, AI tanks fired the instant every reload finished
(2 shots/s), while a human hammering the fire key manages noticeably less. The cooldown stays the same for everyone;
AI tanks now add a random 0–0.15 s pause after each reload, averaging about 87% of the maximum fire rate and never
quite regular. Scaling the AI fire rate by the number of AI tanks was considered and rejected as too indirect a lever.

These are starting points for playtesting, not commitments. Tests read them from the config rather than hard-coding
numbers.

### D10. The built-in board
"Proving Ground": a 1200 × 800 arena with roughly symmetric cover — a central block, four L-shaped corner pieces made
of two rectangles each, and mid-side barriers — plus five spawn points (four corners and one centre-edge), each facing
inward. It is defined as typed data in `src/sim/boards/`, and a unit test runs the validator over every board in that
folder.

### D11. Client loop and input
- `requestAnimationFrame` loop with a fixed-step accumulator: run `step` as many times as real time requires, capped
  at 5 steps per frame to avoid a "spiral of death" after a stall, then render, interpolating tank positions
  between the previous and current tick by the leftover fraction.
- Before each tick, record render-relevant positions and headings, so the renderer can interpolate without the
  simulation keeping history.
- Keyboard state is a set of pressed keys, sampled into a `TankInput` once per tick. On `blur` or
  `visibilitychange`, the client clears the pressed set (no stuck keys) and pauses. While paused, the accumulator is
  not fed, so no simulation time passes. `preventDefault` applies to game keys only while a game is active.
- Screens (setup, round result, game result, pause) are plain HTML/CSS overlays on top of the canvas. With 3–4
  screens, a UI framework isn't justified.
- Canvas sizing: the backing store is scaled for `devicePixelRatio`, and the world is letterboxed to fit the
  window at 3:2.

### D12. Testing strategy
- **Simulation**: Vitest unit tests mapped to spec scenarios, named after them so QA can trace them, plus a
  determinism test (two runs, deep-equal states).
- **AI**: headless scenario tests on purpose-built small boards, such as "hidden target is found within N seconds",
  "holds fire behind cover" and "same seed gives the same inputs".
- **Rules**: tests drive a match through scripted eliminations to cover every scoring and game-end scenario.
- **Client**: unit tests for key-to-input mapping, pause and accumulator logic (with an injected clock).
  Rendering-only scenarios (tank identifiable, resize, effects) are checked manually and listed for QA.

## Risks / Trade-offs

- [Floating-point maths such as `Math.sin` can differ between JavaScript engines] → Determinism is only promised on one
  engine. The server-authoritative multiplayer design doesn't need more. If lockstep is ever wanted, revisit.
- [AI may be too strong or too weak] → All AI difficulty knobs are in `DEFAULT_CONFIG`. Expect a tuning pass after the
  first playtest.
- [Circle collision against rectangular-looking tanks] → Tank corners can visually clip into walls slightly. This is
  acceptable for an arcade feel and is the usual trade-off.
- [Freezing the world at round end looks abrupt] → The client keeps animating effects. If it still feels abrupt, a
  slow-motion fade can be added in the client without touching the rules.
- [Mutating state in place makes accidental aliasing bugs possible] → Determinism tests catch divergence. A deep clone
  helper exists for tests and for future snapshots.

## Open Questions

- Final balance values (D9) — to be settled by playtesting; they do not affect structure or tasks.
- Visual style details (palette, effect flair) — decided during implementation within the procedural-drawing approach.
