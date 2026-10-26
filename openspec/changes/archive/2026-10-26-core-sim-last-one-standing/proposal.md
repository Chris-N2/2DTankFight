## Why

Nothing is playable yet. This first change produces the smallest version that is genuinely a game: one human
against 1–4 AI tanks in a top-down arena, playing Last One Standing in a browser. It also lays down the
architecture every later change depends on — above all a pure, input-driven simulation that a server can run
unchanged when multiplayer arrives. Getting that boundary right now is far cheaper than retrofitting it.

## What Changes

- New TypeScript project (npm workspaces under `src/`) with build, typecheck, lint and test tooling.
- New **simulation** module: fixed-timestep and input-driven, with no rendering, DOM, timers or networking.
  It covers tank movement, collision with obstacles and other tanks, turret shells that bounce once, hit points,
  elimination, and self-hits from bounced shells.
- New **arena** definition: one hand-made board (boundary, obstacles, spawn points), stored as data.
- New **AI opponents**: basic but competent tanks that navigate, aim and fire. They are controlled only through the
  same inputs a human produces, and they fight everyone, including each other.
- New **Last One Standing** rules for single-player: rounds, round end, scoring (the AI side counts as one
  opponent) and game end, including a game ending early once the result can no longer change.
- New **browser client**: a setup screen (number of AI opponents, number of rounds), keyboard controls,
  Canvas rendering, a HUD, a round-start countdown, round and game result screens, and pause.

Out of scope (later changes): mortars, Waves mode, tank selection/cosmetics, more boards or a generator, multiplayer
and two-player scoring, audio.

## Capabilities

### New Capabilities
- `simulation`: deterministic, fixed-timestep game simulation — tanks, movement, collisions, shells, bouncing, damage and elimination.
- `arena`: the playing field — bounds, obstacles, spawn points — and the rules a board must satisfy.
- `ai-opponents`: behaviour of code-controlled tanks, and the constraint that they act only through player-equivalent inputs.
- `last-one-standing`: round and game rules for the Last One Standing mode (single-player in this change).
- `game-client`: the browser experience — setup, controls, rendering, HUD, round/game flow screens and pause.

### Modified Capabilities
_None — this is the first change._

## Impact

- New code under `src/` (simulation package, browser client package) plus root tooling config (`package.json`,
  TypeScript, Vite, Vitest, ESLint, Prettier).
- New dev dependencies only. No runtime services, servers or hosting are needed yet; the game is a static site.
- Later changes (Waves, mortars, multiplayer) will extend `simulation`, `last-one-standing` and `game-client`
  rather than replace them.
