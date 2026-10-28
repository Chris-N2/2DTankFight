## Why

Every round of every game is played on Proving Ground. It plays well, but by the third round of a five-round game
nobody is exploring any more. They're running the same routes to the same corners. Different maps change the game
far more than any tuning value can. An open board is fast and frantic, and a maze is all about bank shots round
corners.

This change builds the machinery for choosing maps and adds a first batch of three new boards. More boards follow in a
second change (Frustration, Ricochet Alley, Checkerboard), designed after these have been playtested. That way, we
learn which kinds of board are fun before writing specs for the rest.

## What Changes

- **New: a map mode setup option** for both Last One Standing and Waves:
  - **Random** (the default): the game picks the map for each round or wave from a shuffle bag. Every map is played
    once before any map repeats, and the same map is never played twice in a row.
  - **Sequence**: the host picks up to 7 maps in order. The same map may appear more than once. When the list runs
    out it starts again from the top. In Last One Standing the list can be no longer than the number of rounds. A
    one-map sequence means "always this map", which is also how a new board gets playtested.
- **The map changes at the start of each round or wave.** Spawning works as before, on the new map.
- **Boards get a stable id** (e.g. `proving-ground`). Options carry map ids, never board data, and unknown ids are
  rejected. The future multiplayer server must not trust a client's options.
- **Three new hand-made boards:** Run For Cover, Nowhere (Much) To Hide and Pac-Tank (a maze without wraparound).
  Together with Proving Ground that makes four built-in boards. All of them are 1200 × 800, laid out on a 40-unit
  design grid (one square is roughly one tank).
- **Setup screen:** a Random / Sequence choice, and a map picker with a small thumbnail of each board. It works with
  mouse, keyboard and gamepad.
- **The map's name is shown** at the start of each round or wave, so players (and playtesters) know where they are.
- **BREAKING (internal):** creating a match takes map options instead of a single board.
- **CLAUDE.md** (*Boards*) is updated to describe map modes. Board variety in the suggested change sequence is split
  into this change and the follow-up.

## Capabilities

### New Capabilities
- `map-selection`: choosing which board each round or wave is played on:
  - the map mode option (Random or Sequence) and how it is validated;
  - the no-repeat shuffle bag;
  - sequence order, looping and the Last One Standing length limit;
  - switching boards at each round or wave start, reproducible from the match seed.

### Modified Capabilities
- `arena`:
  - "Single built-in board" is replaced by a set of four built-in boards, each with a stable id and name;
  - all built-in boards share the same arena size.
- `last-one-standing`: game options gain the map mode. Each round starts on the board map selection chose for it.
- `waves`: options gain the map mode. Each wave starts on the board map selection chose for it.
- `game-client`:
  - the setup screen gains the map mode and the map picker with thumbnails;
  - the round and wave banner names the map.

## Impact

- **Simulation (`src/sim`):**
  - `types.ts`: `Board.id`, map options in `MatchOptions`, map-rotation state in `MatchState`.
  - `options.ts`: map option validation against the built-in board ids.
  - `match.ts`: `createMatch` signature; the board is chosen and the nav grid rebuilt at each round or wave start.
  - `boards/`: three new board files, plus an id on Proving Ground.
- **Client (`src/client`):**
  - `screens.ts`, `markup.ts`, `main.ts`, `styles.css`: the map option, picker and focus handling.
  - `renderer.ts`: drawing a board as a thumbnail; drawing whichever board the current round is on.
- **Tests:** existing `createMatch` calls are updated to the new signature. New tests cover map selection,
  validation, the boards and the picker.
- **Determinism:** map choice uses its own seeded random stream, so existing seeds keep their spawn and AI sequences.
- **Docs:** CLAUDE.md *Boards* section and suggested change sequence.
- No new dependencies.
