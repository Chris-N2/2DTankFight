## Context

The board is currently fixed for the whole match. `createMatch(options, board, seed)` clones the board into
`state.board` and builds `state.nav` (the AI's navigation grid) once. `startRound` shuffles spawn indices with
`state.rng`, and tanks take the first N. The renderer draws `state.board`, and the client sizes the canvas from
`PROVING_GROUND`. `validateBoard` already enforces cover, spawn clearance, spawn spacing (250) and connectivity, and
a test runs it over `BUILT_IN_BOARDS`.

See proposal.md for the motivation.

## Goals / Non-Goals

**Goals:**
- Map choice lives in the simulation, driven by options and the seed, so the multiplayer server inherits it unchanged.
- Adding a board later is one data file plus one line in the board list.
- Existing seeds keep their spawn and AI behaviour.

**Non-Goals:**
- Wraparound (Pac-Tank is a plain maze), user-made or JSON-loaded boards, and the random board generator.
- Per-map Waves bests (see Risks).
- Frustration, Ricochet Alley, Checkerboard and The Keep. These come in the follow-up change.

## Decisions

### 1. Map options are ids; the simulation resolves them

```ts
type MapOptions = { kind: 'random' } | { kind: 'sequence'; ids: string[] };
type MatchOptions = (...existing...) & { maps: MapOptions };
```

`Board` gains `id: string` (kebab-case, e.g. `proving-ground`). `validateOptions` checks the map options against the
board catalogue:
- the kind is `random` or `sequence`;
- a sequence has 1–7 ids, every id is known, and in Last One Standing it is no longer than `rounds`.

`createMatch(options, seed, config?, boards = BUILT_IN_BOARDS)` replaces `createMatch(options, board, seed, config?)`.
The catalogue parameter lets tests pass tiny purpose-built boards. It also checks every board the options can select
has at least `maxTanks(options)` spawns, as today's single-board check does.

*Alternative:* the client picks each round's board and passes it in. This was rejected for two reasons. The server
would have to re-implement the choice, and a client could send any board data it liked.

### 2. Map rotation state is plain data in `MatchState`

```ts
maps: { order: string[]; next: number }   // ids to play, and the index of the next one
```

- **Sequence:** `order` is the chosen ids. The board for round/wave *n* is `order[(n - 1) % order.length]`.
- **Random (shuffle bag):** `order` is a shuffled copy of every catalogue id. When `next` reaches the end, the bag is
  reshuffled. If the first id of the new bag is the board just played, it is swapped with a random other position.
  This keeps the promise of "never twice in a row" across bag boundaries. With a one-board catalogue (tests), repeats
  are unavoidable and allowed.

`state.board` stays as the *current* board, so `world.ts`, the AI and the renderer are untouched. `startRound` takes
the next id, clones that board into `state.board` and rebuilds `state.nav`. This happens before spawning. Building the
nav grid takes about 67×45 cells against at most a few dozen rectangles, so it costs well under a millisecond.

### 3. A separate random stream for maps

`state.mapRng` is seeded from the match seed, as `aiRng` is (with a different mixing constant). Drawing map choices
from `state.rng` would shift every later spawn shuffle and change the outcome of existing determinism and rules tests
for a given seed.

### 4. Board layout conventions

- Every built-in board is **1200 × 800**. The arena spec now requires this. The canvas and HUD layout depend on it,
  and Change B's boards will follow it. If a different size is ever wanted, that's a deliberate later change.
- Boards are laid out on a **40-unit design grid** (30 × 20 squares). One square is about one tank (36 across). This
  is a convention for whoever writes a board, not a runtime concept. The display grid stays at 50.
- Walls are at least 24 thick (as now) so shells can't tunnel. Corridors meant for driving are at least 3 squares
  (120) wide. That leaves about 80 of drivable width after the nav clearance of about 20 each side, enough to pass a
  tank.
- Each board may have more than 5 spawns. Spawns are shuffled, and a tank never knows which spawns went unused.

### 5. The three boards (sketches; exact coordinates are set during apply and must pass `validateBoard`)

1 character is 40 units across and 80 down, so the sketches are squashed vertically. `S` = spawn, `#` = wall.

**Run For Cover** (`run-for-cover`): six 3×2-square blocks (120×80), top and bottom rows at left, centre and right,
plus one 2×3 block (80×120) mid-way down each side. Spawns in the four corners and behind the top and bottom centre
blocks. The centre is deliberately empty and nobody spawns there.

```
+------------------------------+
| S          S              S  |
|    ###     ###      ###      |
|                              |
| ##                        ## |
| ##                        ## |
|                              |
|    ###     ###      ###      |
| S          S              S  |
+------------------------------+
```

**Nowhere (Much) To Hide** (`nowhere-to-hide`): a 1×3-square barrier (40×120 or 120×40) beside each spawn, on the
side facing the centre, plus a small centre piece to reach the 6-obstacle minimum. Nothing else.

```
+------------------------------+
|  S|                     |S   |
|   |                     |    |
|                              |
|             ---              |
|                              |
|   |                     |    |
|  S|          S          |S   |
|             ---              |
+------------------------------+
```

**Pac-Tank** (`pac-tank`): a symmetric maze of solid wall blocks with 3-square corridors, in the spirit of Pac-Man and
with no wraparound.
- **No dead ends.** Every corridor is part of a loop, so nobody can be cornered with no way out except the way
  they came.
- **Long walls and turns,** not a lattice of pillars. A lattice is Checkerboard's job in the follow-up change, and
  the two should feel different.
- **Optional:** a central "ghost house" box with one opening.
- **Spawns** in corridors spread round the maze, each at least 250 from the others.

### 6. Setup screen and picker

- A **Maps** row: `Random | Sequence`, below the mode's own options and shown for both modes. The choice is kept in
  `SetupChoices` and survives mode switches like the other choices.
- When Sequence is selected, two more rows appear:
  - a **library** of every built-in board as a thumbnail with its name. Activating one appends it to the sequence;
  - the **sequence strip**: the chosen maps in order, numbered, with a count such as `3 / 5`. Activating an entry
    removes it. A *Clear* control empties the strip.
- **The cap is 7,** or the number of rounds in Last One Standing. When the strip is full, library entries can't be
  added. If the limit drops below the strip's length, the strip is trimmed from the end. That happens when the player lowers the rounds, or switches from Waves (limit 7) to Last One Standing with fewer rounds. This is
  visible straight away, so nothing is silently lost later.
- **An empty sequence can't start.** Start is disabled and a hint says to pick at least one map. Treating an empty
  sequence as Random would be a surprise.
- **Navigation:** library and strip entries join the existing d-pad and arrow-key focus model as rows of options.
  Activating them uses the same Enter, Space, A and click paths as other options.
- **Thumbnails** are small canvases drawn by a renderer helper that draws a board (floor and obstacles, current theme
  colours, no tanks) scaled to fit. Spawns aren't shown, because they'd give the game away.

### 7. Map name in the banner

The countdown banner's sub-line gains the board's name after the round or wave number:
- "Round 2 of 5 · Pac-Tank"
- "Wave 3 · Pac-Tank · AI armour up"

The big countdown number stays as the title. During playtests the name also answers "wait, which one was that?". The
board changes when the countdown starts, so the name appears at the moment the board visibly changes.

### 8. Rounds stay independent

Last One Standing's "nothing carries over except score and round number" gains one exception: the map rotation's
position. It decides *where* the next round is played, never how hard it is.

## Risks / Trade-offs

- **[Waves bests mix maps]** A Waves run on a sequence of Nowhere To Hide is harder than one on Proving Ground, but
  both count towards the same best. → It's accepted for now. Random is the default and plays every map, and splitting
  bests by map sequence would make them meaningless. Revisit after playtests if it bothers anyone.
- **[AI on a maze]** The AI's A* routes fine through corridors. But its line-of-sight firing may rarely get a clear
  shot, and it doesn't plan bank shots. → Pac-Tank may favour humans. That's acceptable, and the playtest will tell.
  AI improvements, if needed, belong in their own change.
- **[A board is fine in the validator but not fun]** → The one-map sequence makes each board quick to playtest.
  Board coordinates are plain data and can be tuned after the change without new specs.
- **[Board change is jarring]** The arena changes under the player between rounds. → It changes during the
  round-result pause and is followed by the full countdown, with the name in the banner.

## Migration Plan

`createMatch`'s new signature is internal. All callers (client and tests) are updated in this change. There is no
stored state to migrate: Waves best keys are unchanged.
