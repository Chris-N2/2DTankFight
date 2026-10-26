## Context

See proposal.md for why, and for the decisions to confirm. The current state that shapes the approach:

- **The match layer is Last One Standing only.** `match.ts` holds Last One Standing rules directly:
  - `createMatch` builds the human plus `aiCount` AI tanks once.
  - `startRound` respawns and heals everyone.
  - `evaluateRound` and `evaluateGame` score it.
  - The phase machine runs countdown → playing → roundOver → countdown or gameOver.
- **Combat values are global.** `world.ts` reads `cfg.shellDamage`, `cfg.shellSpeed` and `cfg.tankMaxHp` from
  config. Shells store their velocity, but each tick they move `cfg.shellSpeed × dt`.
- **The AI targets everyone.** It targets every live tank (`selectTarget` in `ai/think.ts`), engages only with a
  clear firing lane, and has blocked-barrel and stuck recovery (the core change's QA fix B1).
- **The client reads Last One Standing state.** It reads `round`, `scores` and `result` for its HUD, banners and
  result screen (`screens.ts`). Its setup screen has two radio groups. The gamepad menu rows are hard-coded in
  `Game.onMenuAction`.
- **Tests construct Last One Standing matches** with `createMatch({ aiCount, rounds }, …)`. They include a
  determinism test and soak tests that must keep passing.

## Goals / Non-Goals

**Goals:**
- **Waves as a second set of rules** on the same phase machine, simulation and AI, with Last One Standing behaviour
  unchanged. Its determinism and soak results must stay the same for the same seeds.
- **Per-tank combat values,** so escalation doesn't fork the physics.
- **One pure escalation function,** so the whole schedule is visible and testable in one place.
- **A way out if co-op AI is too hard,** without code changes.

**Non-Goals:**
- **Two humans, respawn, friendly fire and disconnects:** the multiplayer change.
- **Mortars and their refill:** the mortars change.
- **Smarter co-ordinated AI tactics,** such as flanking or covering fire. Allies here only avoid hurting each other on
  purpose. Smarter play can be a later escalation step.
- **A difficulty selector, or escalation for the human.**

## Decisions

### D1. Options become a tagged union
- **The type:** `MatchOptions = { mode: 'lastOneStanding'; aiCount; rounds } | { mode: 'waves'; startAiCount }`.
- **Validation:** `validateOptions` checks each mode's fields. Waves accepts a `startAiCount` of 1–4, reusing
  `AI_COUNT_MIN`/`MAX`.
- **Call sites:** existing ones (tests, client) pass `mode: 'lastOneStanding'` explicitly.
- **Alternative considered:** an optional `mode` that defaults to Last One Standing. Rejected: an optional tag
  weakens the union, and the edits are mechanical.

### D2. Mode rules behind a small interface
The phase machine stays in `match.ts`. What differs by mode moves into `rules/lastOneStanding.ts` and `rules/waves.ts`,
each implementing:

```ts
interface ModeRules {
  /** Builds this round's or wave's tanks and their combat values, before spawning. */
  setUp(state: MatchState, events: SimEvent[]): void;
  /** Called after each playing tick: whether play continues, moves on to the next round or wave, or ends. */
  evaluate(state: MatchState): 'continue' | 'next' | 'gameOver';
  /** Records the outcome (scores, waves cleared) and emits the mode's events. */
  finish(state: MatchState, ending: 'next' | 'gameOver', events: SimEvent[]): void;
}
```

- **Last One Standing:** its rules are today's code moved behind this interface, with no behaviour change. Its
  events stay the same: `roundStarted`, `roundEnded`, `gameEnded`.
- **Waves:**
  - It emits `waveStarted { wave, aiCount, changes }` and `waveCleared { wave, cleared }`.
  - At game end it emits `gameEnded { result: 'over', wavesCleared }`. `GameResult` gains `'over'`.
  - `changes` lists what this wave changed for the AI tanks (`'thinnerArmour' | 'armour' | 'damage' | 'lethal' |
    'speed'`; see D4), so the client can announce them without doing the maths itself.
  - `state.round` doubles as the wave number, so the shared countdown and breather timing work unchanged.
  - `state.waves = { startAiCount, cleared }` holds the mode's own data. It is null in Last One Standing.
- **Alternative considered:** a class per mode. Rejected: `MatchState` must stay plain data for snapshots and the
  server, so the rules are a lookup by `state.options.mode`, not an object stored in state.

### D3. Per-tank combat values and per-shell damage
- **On tanks:** `TankState` gains `maxHp`, `shellDamage` and `shellSpeed`.
- **On shells:** `ShellState` gains `damage`. Its speed is already in `vx`/`vy`.
- **In the world step:**
  - `fire()` uses the tank's values.
  - `moveShell` moves each shell `hypot(vx, vy) × dt` and applies `shell.damage`.
  - Round and wave setup sets `hp = maxHp`.
- **Last One Standing:** sets every tank's values from the config defaults. Its numbers are identical to today's,
  so the determinism and soak tests are unaffected.
- **Why per tank rather than per side:** it keeps the world step ignorant of modes and sides, and it's what the
  mortar change and the co-op human will need too.

### D4. One pure escalation function
`waveSetup(config, startAiCount, wave)` returns `{ aiCount, aiMaxHp, aiShellDamage, aiShellSpeed, changes }`:

- **AI count:** `min(startAiCount + wave − 1, 4)`.
- **AI armour by wave size** (revised after the first playtest; see below): before escalation, AI max HP comes from
  `wavesAiMaxHpByCount[aiCount − 1]`, by default `[3, 2, 1, 1]`. A game started with 3 or 4 AI tanks starts at 1.
- **Escalation steps:** `step = wave − firstWaveWithFourAi` (0 or less means no escalation). The steps are applied in
  order from a schedule built from config:
  - **Armour:** AI max HP +`wavesArmourStep` per step, from the 4-tank value until it reaches `tankMaxHp`, never
    beyond. The number of steps is derived, not configured: by default 1 → 2 → 3, so 2 steps.
  - **Damage:** AI shell damage +1 per step until it's at least the human's max HP. By default that's 1 → 2 → 3, and
    the step reaching 3 is flagged `'lethal'`.
  - **Speed:** AI shell speed ×(1 + 0.2 × n), up to 2× (5 steps by default).
  - **After the last step:** values stay at the maximum.
- **Changes:** `'armour'`, `'damage'`, `'lethal'` or `'speed'` for the escalation step this wave applied. Before
  escalation, `'thinnerArmour'` when AI max HP is lower than in the previous wave (never in wave 1).

Example, starting with 1 AI:

| Wave | AI | AI max HP | AI damage | AI shell speed | Changes |
|---|---|---|---|---|---|
| 1 | 1 | 3 | 1 | 1.0× | |
| 2 | 2 | 2 | 1 | 1.0× | thinnerArmour |
| 3 | 3 | 1 | 1 | 1.0× | thinnerArmour |
| 4 | 4 | 1 | 1 | 1.0× | |
| 5 | 4 | 2 | 1 | 1.0× | armour |
| 6 | 4 | 3 | 1 | 1.0× | armour |
| 7 | 4 | 3 | 2 | 1.0× | damage |
| 8 | 4 | 3 | 3 (lethal) | 1.0× | lethal |
| 9–13 | 4 | 3 | 3 | 1.2× … 2.0× | speed |
| 14+ | 4 | 3 | 3 | 2.0× | |

Escalation timing is the same as the original curve (armour then took AI max HP 3 → 4 → 5); only the armour values
differ. The config gets `wavesAiMaxHpByCount: [3, 2, 1, 1]`, `wavesArmourStep: 1`, `wavesSpeedStep: 0.2` and
`wavesMaxShellSpeedFactor: 2`. All are starting points for playtesting.

**Revised after the first playtest.** Waves of 2–4 co-operating AI tanks were fun but the wrong side of frustrating,
and the hard part was destroying the tanks rather than surviving them. Options considered:
- **Thinner AI armour while waves grow (adopted):** goes straight at the problem, and is a change to this one function.
- **Turning infighting back on (`wavesAiCooperate: false`) (rejected):** inconsistent with the mode, games would often
  end as a dull 1v1 once the AI tanks had thinned each other out, and it would be too easy in two-human co-op.
- **More armour for the human (rejected):** survival wasn't the main problem.
- **A slower AI fire rate in bigger waves (deferred):** a plausible second lever, held back so each playtest changes
  one thing.

### D5. AI allies
- **Who's an enemy:** an `isEnemy(state, a, b)` helper. In Last One Standing every other tank is an enemy. In Waves,
  for AI tanks only humans are, as long as `config.wavesAiCooperate` is true (the default).
- **Target selection:** `selectTarget` filters with it.
- **An ally in the lane:**
  - In Waves, before firing, the AI checks whether a live ally's circle comes within the firing lane before the
    target (lane half-width plus tank radius, and nearer than the target).
  - If one does, the AI treats the shot as blocked. It uses the existing `blockedTicks` path: it re-aims each reaction
    delay, and reverses away after a stuck window.
  - This satisfies "doesn't freeze" with no new mechanism.
- **Last One Standing is untouched:** there every tank is an enemy, so the ally check always finds no ally. It uses no
  randomness, so the AI random-number sequence and behaviour are unchanged (confirmed by recording seeded Last One
  Standing games before and after the change: identical).
- **The way out:** setting `wavesAiCooperate: false` makes Waves AI tanks fight each other, as in Last One Standing.
  It isn't exposed in the UI. It exists so a playtest can compare both without code changes.

### D6. Waves tanks are rebuilt each wave
- **Rebuilding:** at each wave, `setUp` rebuilds the AI tanks. The human tank object is kept, and AI tanks get ids
  `ai1…aiN` and colours 1…N, so a tank keeps its colour from wave to wave.
- **Spawning:** spawn assignment uses the same shuffled order as Last One Standing. There are always at most 5 tanks
  for the 5 spawn points.
- **Client consequence:** new ids appear at a wave start. The renderer already looks up each tank's previous
  position by id and copes with a missing one (`prev?.tanks[tank.id]`). A task confirms that a newly added tank draws
  at its spawn without a sweep across the arena.

### D7. End-of-wave rules
- **Evaluated after every playing tick, in this order:**
  1. If no AI tank is alive, the wave is cleared and `cleared++`.
  2. Then, if the human is dead, it's game over. Otherwise, if the wave was cleared, the breather starts, and then
     the next wave's countdown.
- **This gives "going down together"** (the human and the last AI destroyed in the same tick) as cleared, then game
  over.
- **Self-destruction** needs no special case.

### D8. Client
- **Setup screen:**
  - A mode radio row [Last One Standing | Waves] sits above per-mode option groups. Only the selected group is shown.
  - Waves has a "Starting AI tanks" row, default 1. Last One Standing keeps its defaults (3 AI, 5 rounds).
- **Gamepad menu rows:** built from the visible `.option` groups in document order, plus Start, rather than
  hard-coded. Moving across the mode row switches the visible groups.
- **Keyboard menus** (added after the playtest, which found arrow keys did nothing on the menus): when no game is in
  progress, the arrow keys and W/A/S/D are mapped to the same menu actions as the d-pad, so keyboard and gamepad
  share one navigation path. Enter and Space keep their usual button behaviour, and Tab still works.
- **HUD in Waves:** "Wave 3 · Cleared 2" in place of the round and score cells.
- **Banners:**
  - **Countdown:** "Wave N", with a sub-line from `changes`: "More tanks, thinner armour", "AI armour up", "AI hits
    harder", "One hit is lethal!" or "AI shells faster".
  - **Breather:** "Wave N cleared!"
- **Result screen:**
  - The title is "Destroyed on wave N".
  - The score line reads "K waves cleared".
  - The best line reads "Best: M" or "New best!", plus a quip.
- **The best score:**
  - It's kept per starting AI count, since starting with 4 is a different game, in `localStorage` under
    `tank-command.waves-best.<n>`.
  - Every access is wrapped in try/catch. If storage is unavailable, the best line is left out.
  - The pure text functions in `screens.ts` take the best as an argument, so they stay testable.

### D9. Measuring difficulty before the playtest
A headless measurement, like the one done for the AI fire rate, runs Waves with an idle human and with a scripted
"hider". It records how many waves are survived, with co-operation on and off. The numbers go in `playtest-notes.md`,
so the playtest starts from data. It's a scratch measurement, not a committed test.

## Risks / Trade-offs

- **[Co-operating AI is too hard]** Several mitigations are built in:
  - a starting count of 1;
  - +1 tank per wave;
  - full armour each wave;
  - a breather between waves;
  - escalation that only starts after 4 AI;
  - thinner AI armour while waves grow (added after the first playtest, see D4);
  - all values tunable.

  The `wavesAiCooperate` switch lets the playtest compare. Other tuning options, without structural change: a
  slightly longer reaction delay for Waves AI, or a slower escalation.
- **[Allies clump and block each other's lanes]** The ally-in-lane rule plus blocked-barrel recovery makes them
  reposition. The idle-human Waves soak test catches any freeze.
- **[Last One Standing regressions while refactoring `match.ts`]** The existing rules, determinism and soak tests
  run unchanged apart from the `mode` field. They're the safety net, and the refactor task requires them green before
  any Waves code goes in.
- **[A game with no end]** A human who hides perfectly could survive forever, but AI tanks hunt, so in practice waves
  end. The idle-human soak test checks that Waves games end.
- **[Storage blocked]** Best score is a nicety: wrapped, and left out when unavailable.

## Migration Plan

None. Single-player, client-side, and no saved data apart from the new best-score keys.

## Open Questions

- The exact escalation numbers and the starting default (1 AI). To be settled by the measurement (D9) and the
  playtest. They're config values, so they don't change the structure.
