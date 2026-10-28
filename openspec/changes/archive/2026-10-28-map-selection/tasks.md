## 1. Safety net

- [x] 1.1 Before changing any code, add a golden determinism test that plays a seeded Last One Standing and a seeded Waves game on Proving Ground with scripted inputs, and records each round's spawn assignment and a final-state fingerprint. Verify that it passes against the current code. (The *Map choice doesn't disturb spawns* scenario relies on it.)

## 2. Board data

- [x] 2.1 Add `id` to `Board`, give Proving Ground `id: 'proving-ground'`, and verify the build passes.
- [x] 2.2 Add an arena test that every built-in board is 1200 × 800 with a unique id, and verify that it passes.
- [x] 2.3 Add Run For Cover (`run-for-cover`) per design §5. Verify that it passes `validateBoard` and that a test confirms no spawn lies in the central open area.
- [x] 2.4 Add Nowhere (Much) To Hide (`nowhere-to-hide`) per design §5 and verify that it passes `validateBoard`.
- [x] 2.5 Add Pac-Tank (`pac-tank`) per design §5: symmetric, no dead ends, corridors of at least 120, no wraparound. Verify that it passes `validateBoard`, and include an ASCII sketch of the layout in the file's doc comment for reviewers.
- [x] 2.6 Register all four in `BUILT_IN_BOARDS` in the order Proving Ground, Run For Cover, Nowhere (Much) To Hide, Pac-Tank. Verify with the *Four boards available* test.

## 3. Map options and validation

- [x] 3.1 Add `MapOptions` (`random` | `sequence` with ids) to `MatchOptions` for both modes and verify the build passes.
- [x] 3.2 Extend `validateOptions` to cover the cases below, then verify them with tests for each *Map mode option* scenario:
  - the map mode;
  - a sequence length of 1–7;
  - the Last One Standing sequence length being no more than the rounds;
  - unknown ids, checked against the board catalogue.

## 4. Map rotation in the simulation

- [x] 4.1 Change `createMatch` to `(options, seed, config?, boards = BUILT_IN_BOARDS)`. Check that every selectable board has enough spawns. Update all callers in the client and tests. Verify with the build and the existing tests.
- [x] 4.2 Add `mapRng` and the `maps` rotation state to `MatchState`. In `startRound`, choose the board before spawning: clone it into `state.board` and rebuild `state.nav`. Verify with tests for *Board changes between rounds* and *Board fixed within a wave*.
- [x] 4.3 Implement sequence order with looping. Verify with tests for *Played in order*, *Sequence repeats in Waves*, *Always this map* and *A long game outlasts its sequence*.
- [x] 4.4 Implement the Random shuffle bag with the no-back-to-back swap at bag boundaries. Verify with tests for *Every map before a repeat* and *No back-to-back repeat*, with the latter run over several seeds.
- [x] 4.5 Verify *Same seed, same maps* and *Map choice doesn't disturb spawns*: the golden test from 1.1 passes unchanged with a one-map Proving Ground sequence.
- [x] 4.6 Verify *New board, same difficulty* (Last One Standing) and that `cloneState` round-trips the new state, both with tests.

## 5. Client: setup and picker

- [x] 5.1 Add `maps` (mode plus sequence ids) to `SetupChoices`, with Random as the default, and map it in `matchOptionsFor`. Verify with screens tests, including *Defaults allow an immediate start*.
- [x] 5.2 Add a renderer helper that draws a board (floor and obstacles, theme colours, no spawns) scaled into a small canvas. Verify with a test that it draws without a DOM error. Check it visually.
- [x] 5.3 Add the Maps row and, for Sequence, the board library, the numbered sequence strip with its count and limit, and Clear. Verify with tests for *Building a sequence* and *Removing a map*.
- [x] 5.4 Enforce the limit, and trim the sequence when the rounds are lowered. Verify with tests for *Limit follows the rounds* and *Fewer rounds shortens the sequence*.
- [x] 5.5 Block every start path while the sequence is empty, and show the hint. The start paths are the Start button, Enter or Space on Start, and the gamepad Start button. Verify with a test for *Empty sequence can't start*.
- [x] 5.6 Join the library and strip to the existing keyboard and gamepad focus model. Verify with tests for *Picking with the gamepad* and *Sequence survives a mode switch*, and check visually that focus is highlighted.

## 6. Client: in-game

- [x] 6.1 Size the canvas and draw the idle screen from the board catalogue rather than `PROVING_GROUND`, and draw `state.board` each frame. Verify with *Next wave's board appears with its countdown* in a test or by checking visually.
- [x] 6.2 Add the board name to the countdown banner's sub-line, after the round or wave number and before any escalation text. Verify with screens tests for *Name in the countdown* in both modes.

## 7. Docs and wrap-up

- [x] 7.1 Update CLAUDE.md. In *Boards*, describe the map modes and the 40-unit design grid. In the suggested change sequence, split board variety into this change and the follow-up (Frustration, Ricochet Alley, Checkerboard; The Keep as a maybe). Verify by review.
- [x] 7.2 Run `npm run build`, lint and the full test suite and verify they all pass. Then suggest a playtest with `npm run dev`, using a one-map sequence for each new board, and `/qa` before `/opsx:archive`.
