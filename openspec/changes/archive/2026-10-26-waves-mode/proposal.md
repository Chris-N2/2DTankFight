## Why

Last One Standing is fun, but every game is the same size. Waves gives the game its "one more go" mode: survive
wave after wave of AI tanks that keep getting tougher, and try to beat your best. It's the second mode in the
CLAUDE.md vision. It also introduces difficulty escalation, which later work (mortars, co-op multiplayer) builds on.

## Decisions to confirm on review

- **AI tanks co-operate in Waves.** They are allies: they never target each other, and they hold fire when an ally is
  directly in the way. Every tank still takes damage from every shell, so a stray or bounced AI shell can still
  destroy an ally. The developer suggested this, with a doubt about difficulty: with no infighting, three AI tanks
  hunting one human could be much harder than Last One Standing. This proposal adopts co-operation with these
  safeguards:
  - **A gentle start.** The default is 1 AI tank in wave 1, and the host chooses 1–4.
  - **One extra tank per wave.**
  - **Thinner AI armour while waves grow** (added after the first playtest found co-operating waves the wrong side
    of frustrating): 1 AI tank takes 3 hits, 2 take 2 each, and 3 or 4 take 1 each, before escalation rebuilds it.
  - **Full armour each wave.** The human's armour is restored at the start of every wave.
  - **A breather between waves,** with the wave result shown.
  - **Tunable values.** All escalation values sit in one balance table.

  A "co-operative AI" switch can turn infighting back on with no structural change. The first playtest rejected that
  as a fix (inconsistent, dull 1v1 endings, too easy in co-op) in favour of the armour curve. See design.md, D4.
- **Every wave starts fresh.** At the start of each wave, all tanks (including the human) respawn at shuffled spawn
  points with full armour, as rounds do in Last One Standing.
- **A shared last tick counts as a clear.** If the human and the last AI tank are destroyed in the same tick, the wave
  counts as cleared. The game is then over, because no humans are left.

## What Changes

- **Mode choice on the setup screen:**
  - **Last One Standing**, the default, with its options unchanged.
  - **Waves,** whose only option is the starting number of AI tanks: 1–4, default 1.
- **Wave progression.** Each wave starts with a countdown. A wave is cleared when every AI tank is destroyed, and
  the next wave adds one AI tank, up to 4 (5 tanks in total). The more AI tanks in a wave, the thinner their armour.
- **Escalation once 4 AI tanks are reached.** Each further wave escalates, in this order:
  1. AI armour rebuilds, back up to normal.
  2. AI shells do more damage, until one AI hit destroys the human.
  3. AI shells fly faster, up to a cap of 2× the normal speed.

  The game then carries on at maximum difficulty. Escalation only ever affects AI tanks.
- **Game over** when the human is destroyed. The score is the number of waves cleared. The result screen shows it
  along with the best score on this device.
- **Screens.** The HUD shows the wave number and waves cleared. The countdown banner announces each new escalation
  (for example, "AI armour up") and when armour thins ("More tanks, thinner armour"), and a "Wave cleared" banner
  follows each cleared wave.
- **Simulation.**
  - Each tank carries its own maximum armour, shell damage and shell speed, so AI tanks can be escalated.
  - In Last One Standing these stay the same for every tank, so its behaviour is unchanged.
  - Shells carry their own damage and speed.
- **Not in this change** (deferred until the features they depend on exist):
  - mortar refills each wave (mortars change);
  - two-human co-op, respawning a destroyed partner, the friendly-fire option and disconnects (multiplayer change);
  - board variety.

## Capabilities

### New Capabilities

- `waves`: the rules of Waves mode. Covers the options, wave start and end, adding AI tanks per wave, the escalation
  schedule, game over, scoring, and AI tanks being allies.

### Modified Capabilities

- `simulation`: hit points become per tank (with a configured default) rather than identical for all. Shell speed and
  damage are set by the tank that fires.
- `ai-opponents`:
  - "Same rules for everyone" holds in Last One Standing. In Waves, AI tanks can differ only as the escalation
    schedule says.
  - "Every tank for itself" becomes mode-dependent: in Waves, AI tanks are allies who don't target each other and
    hold fire when an ally is in the way.
- `game-client`: the setup screen gains the mode choice and the Waves option. The HUD and the flow screens get their
  Waves versions. The result screen shows waves cleared and the best on this device.

## Impact

- **Simulation (`src/sim`):**
  - `MatchOptions` gains a `mode`, with Waves options.
  - The match layer dispatches round/wave rules by mode.
  - `TankState` and `ShellState` gain per-tank and per-shell combat values.
  - `world.ts` reads those instead of global config.
  - AI target selection and firing check for allies.
  - Waves events and a balance table live in `config.ts`.
  - Existing Last One Standing tests must pass unchanged, apart from passing the mode explicitly.
- **Client (`src/client`):**
  - The setup screen gains the mode selector and a per-mode options row. Gamepad menu rows follow the visible
    options.
  - The HUD and banner texts get their Waves versions.
  - The result screen shows waves cleared, with the best score stored in `localStorage` (failing safely).
- **README** and the CLAUDE.md wording are unaffected, apart from README's "Currently playable" line.
- **No new dependencies.**
