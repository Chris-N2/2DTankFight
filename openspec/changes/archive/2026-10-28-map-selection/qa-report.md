# QA Report: map-selection

**Verdict:** PASS
**Date:** 2026-10-28

This is the second QA run, after fixes for the first report's spec gap and three of its minor items (see
*Re-check of the first report's items*).

## Build & tests

All run from the repo root (`D:\Applications\NDD\Games\2DTankFight`) against the uncommitted working tree.

| Command | Result |
|---|---|
| `npm run typecheck` (sim, client, client tests) | exit 0, no errors |
| `npm run lint` (`eslint .`) | exit 0, no warnings |
| `npm test` (`vitest run`) | **21 files, 357 tests, all passed** (45 s) |
| `npm run build` (`vite build`) | exit 0 |
| `npm run format:check` | all files pass Prettier |
| `openspec validate map-selection --strict` | valid |

All 21 tasks in `tasks.md` are ticked.

**Independent checks from the first run (in the scratchpad; nothing in the repo was changed):**

1. **Golden replay against the pre-change code.** I exported `HEAD` (`git archive HEAD src/sim`), adapted
   `golden.test.ts` to the old `createMatch(options, board, seed, config)` signature and ran it. Both golden
   tests pass on the old code with the same spawn lists and fingerprints (`5948ab96`, `9316a16c`). So the
   *Map choice doesn't disturb spawns* claim really is measured against the code as it was before map selection.
2. **AI soak on the three new boards.** I ran these on Run For Cover, Nowhere (Much) To Hide and Pac-Tank:
   - AI-only Last One Standing, 4 AI, seeds 1–50, mortars off and on;
   - idle human, 1–4 AI, seeds 1–25;
   - Waves with an idle human, start 1 and 4, seeds 1–25.

   No timeouts, and no tank ever ended up inside a wall or out of bounds. The repo's soak suite now covers these
   boards too, with fewer seeds.

## Scenario coverage

| Requirement | Scenario | Status | Code | Test |
|---|---|---|---|---|
| arena: Board definition | Board loads from data | Verified | `src/sim/src/match.ts:173` (`nextBoard` clones the board and builds the nav grid) | `src/sim/test/arena.test.ts:24`, `:100` (every built-in board) |
| arena: Board definition | Built-in boards share a size and have unique ids | Verified | `src/sim/src/boards/*.ts` | `src/sim/test/arena.test.ts:93` |
| arena: Built-in boards | Four boards available | Verified | `src/sim/src/boards/index.ts:13` | `src/sim/test/arena.test.ts:83` |
| arena: Built-in boards | Open centre | Verified | `src/sim/src/boards/runForCover.ts` (spawns) | `src/sim/test/arena.test.ts:110` |
| arena: Built-in boards | (validity of all four boards) | Verified | `src/sim/src/validate.ts` | `src/sim/test/arena.test.ts:40` |
| game-client: Setup screen | Starting a game | Not modified by this change | — | — |
| game-client: Setup screen | Defaults allow an immediate start | Verified | `src/client/src/screens.ts:43` | `src/client/test/maps-screens.test.ts:32`, `src/client/test/screens.test.ts:87` |
| game-client: Setup screen | Controls for both devices | Not modified by this change | — | — |
| game-client: Setup screen | Starting a Waves game | Not modified by this change | — | — |
| game-client: Setup screen | Options follow the mode | Not modified (the Maps row is new; see manual checks) | `src/client/src/main.ts:578` | — |
| game-client: Setup screen | Classic play | Verified | `src/client/src/screens.ts:43` | `src/client/test/screens.test.ts:99` |
| game-client: Setup screen | Menus with the keyboard | Verified | `src/client/src/main.ts` `onMenuAction` | `src/client/test/input.test.ts:189` |
| game-client: Map picker | Building a sequence | Verified | `src/client/src/screens.ts:56` | `src/client/test/maps-screens.test.ts:40` |
| game-client: Map picker | Removing a map | Verified | `src/client/src/screens.ts:63` | `src/client/test/maps-screens.test.ts:63` |
| game-client: Map picker | Limit follows the rounds | Verified | `src/client/src/screens.ts:51,56,83` | `src/client/test/maps-screens.test.ts:69` |
| game-client: Map picker | Fewer rounds shortens the sequence | Verified | `src/client/src/screens.ts:71`; `src/client/src/main.ts:452` | `src/client/test/maps-screens.test.ts:85` |
| game-client: Map picker | Switching to fewer rounds shortens the sequence (new) | Verified | `src/client/src/screens.ts:71`; `src/client/src/main.ts:108-111` (`limitChanged` on mode change) | `src/client/test/maps-screens.test.ts:116` |
| game-client: Map picker | Empty sequence can't start | Verified (logic), plus manual check | `src/client/src/main.ts:196`; `src/client/src/screens.ts:76` | `src/client/test/maps-screens.test.ts:94`; `src/client/test/markup.test.ts:37` (static wiring check) |
| game-client: Map picker | Picking with the gamepad | Implemented. Only a static source check, so verify by playing | `src/client/src/main.ts:458,578` | `src/client/test/markup.test.ts:46` (source text only) |
| game-client: Map picker | Sequence survives a mode switch | Verified | `src/client/src/screens.ts:71` | `src/client/test/maps-screens.test.ts:103` |
| game-client: Map name shown | Name in the countdown | Verified | `src/client/src/screens.ts:143-144` | `src/client/test/maps-screens.test.ts` ("Name in the countdown"); `src/client/test/screens.test.ts` (countdown test) |
| game-client: Map name shown | Next wave's board appears with its countdown | Verified | `src/sim/src/match.ts:132`; `src/client/src/renderer.ts` (`draw` uses `state.board`) | `src/client/test/maps-screens.test.ts` ("Next wave's board appears…") |
| last-one-standing: Game options | Valid options accepted | Verified | `src/sim/src/options.ts` | `src/sim/test/rules.test.ts:34` (4 AI, 5 rounds, mortars on, Random) |
| last-one-standing: Game options | Out-of-range options rejected | Verified | `src/sim/src/options.ts` | `src/sim/test/rules.test.ts` ("Out-of-range options rejected") |
| last-one-standing: Rounds are independent | Fresh round | Verified | `src/sim/src/match.ts:125` | `src/sim/test/rules.test.ts` ("Fresh round") |
| last-one-standing: Rounds are independent | New board, same difficulty | Verified | `src/sim/src/match.ts:125` | `src/sim/test/maps.test.ts:204` |
| map-selection: Map mode option | Valid sequence accepted | Verified | `src/sim/src/options.ts:51` | `src/sim/test/maps.test.ts:42` |
| map-selection: Map mode option | Sequence longer than the rounds rejected | Verified | `src/sim/src/options.ts:59` | `src/sim/test/maps.test.ts:48` |
| map-selection: Map mode option | Waves sequence limit | Verified | `src/sim/src/options.ts:26,59` | `src/sim/test/maps.test.ts:54` |
| map-selection: Map mode option | Unknown map rejected | Verified | `src/sim/src/options.ts:65` | `src/sim/test/maps.test.ts:63` |
| map-selection: Map mode option | Unknown map mode rejected | Verified | `src/sim/src/options.ts:56` | `src/sim/test/maps.test.ts:69` |
| map-selection: Board for each round or wave | Board changes between rounds | Verified | `src/sim/src/match.ts:132,173` | `src/sim/test/maps.test.ts:86` |
| map-selection: Board for each round or wave | Board fixed within a wave | Verified | `src/sim/src/match.ts` (board only changes in `startRound`) | `src/sim/test/maps.test.ts:99` |
| map-selection: Sequence order | Played in order | Verified | `src/sim/src/match.ts:173` | `src/sim/test/maps.test.ts:115` |
| map-selection: Sequence order | Sequence repeats in Waves | Verified | `src/sim/src/match.ts:176-177` | `src/sim/test/maps.test.ts:120` |
| map-selection: Sequence order | Always this map | Verified | same | `src/sim/test/maps.test.ts:136` |
| map-selection: Random without repeats | Every map before a repeat | Verified | `src/sim/src/match.ts:157,173` | `src/sim/test/maps.test.ts:160` (10 seeds) |
| map-selection: Random without repeats | No back-to-back repeat | Verified | `src/sim/src/match.ts:179-185` | `src/sim/test/maps.test.ts:167` (25 seeds × 3 bags) |
| map-selection: Reproducible map choice | Same seed, same maps | Verified | `src/sim/src/match.ts:40` (`mapRng`) | `src/sim/test/maps.test.ts:185`, `:194` (cloneState) |
| map-selection: Reproducible map choice | Map choice doesn't disturb spawns | Verified (and checked independently against `HEAD`) | `src/sim/src/match.ts:40` | `src/sim/test/golden.test.ts:75,89` |
| waves: Waves options | Choosing the starting wave size | Verified | `src/sim/src/rules/waves.ts` | `src/sim/test/waves.test.ts:171` |
| waves: Waves options | Invalid starting count is rejected | Verified | `src/sim/src/options.ts` | `src/sim/test/waves.test.ts:179` |
| waves: Waves options | A long game outlasts its sequence | Verified | `src/sim/src/match.ts:176-177` | `src/sim/test/maps.test.ts:141` |

**Totals:**
- 37 Verified.
- 1 can only be verified by playing (*Picking with the gamepad*; listed under manual checks).
- 4 are unchanged scenarios inside a modified requirement and were not re-traced.
- 0 Missing / wrong.

**Architecture:** the simulation is still pure. There's no DOM, timer, clock or `Math.random` in `src/sim/src`. Map
choice lives in the simulation and is driven only by the options and the seed, on its own random stream
(`mapRng`), so the future server inherits it unchanged. Options carry ids only, and validation treats `maps` as
untrusted. `state.board` stays the current board, so `world.ts`, the AI and the renderer didn't need to change.

## Findings

### Implementation bugs (spec was right, code wasn't)

None found.

### Spec gaps (spec wrong or incomplete)

None outstanding. The first report's gap (switching from Waves to Last One Standing trims the sequence, but the spec
said switching keeps it) is resolved. With the human developer's approval, the *Map picker* requirement now says:
- the sequence is shortened whenever the limit drops, including on that mode switch;
- it is kept "except where it is shortened to fit its limit".

The new scenario *Switching to fewer rounds shortens the sequence* is tested. The code already behaved this way, so
the spec now matches the code.

### Minor / suggestions (do not block)

1. **Run For Cover gives one spawn a free first shot.** The top-centre spawn `(600, 60)` faces east along a clear
   lane at the top-right corner spawn `(1130, 70)`. The bottom-centre spawn, facing west, does the same to
   `(70, 730)`. Deliberately left for playtest tuning in the follow-up boards change.
2. **The UI wiring tests read source text** (`markup.test.ts`). Fine for now; behavioural tests could come later
   with a DOM-free setup module. Deliberately left.
3. **The full board catalogue is part of `MatchState`** (`state.boards`). It's worth revisiting when multiplayer
   starts broadcasting state. Deliberately left.
4. **Stray `temp_docs_maps/` folder** (untracked). These are the developer's notes and won't be committed.
5. **Pac-Tank balance** (corner spawns in Waves wave 4, from the playtest notes). For the follow-up change.

### Re-check of the first report's items

| Item | Status |
|---|---|
| Spec gap: mode switch trims the sequence | Resolved: spec amended and new scenario tested (`maps-screens.test.ts:116`). `openspec validate --strict` passes. |
| U+FFFD characters in `renderer.ts` | Resolved: 0 replacement characters remain, and both comments now read `×`. |
| *Valid options accepted* test didn't match the scenario | Resolved: `rules.test.ts:34` now uses mortars on and Random maps through `createMatch(options, 1)`, and checks validation, tank counts, one mortar each and the options. |
| Soak tests covered Proving Ground only | Resolved: every soak test in `soak.test.ts` now runs over `BUILT_IN_BOARDS`. Proving Ground keeps its full seeds and regression seeds; the other boards get `ceil(count / 5)` seeds, which is at least 1 even for the 2-seed escalation test. My earlier scratchpad probe ran more seeds on the new boards with no failures, so the reduced set is a sensible trade for speed. |

## Manual checks for the human

The notes in `temp_docs_maps/playtesting_map_notes.md` suggest most of these were covered in your playtest. Tick
off whichever you've already seen.

1. **Picking with the gamepad:**
   - set Maps to Sequence with the d-pad (moving onto *Sequence* should select it and reveal the picker);
   - press down into the board cards, then A on one. It's added to the strip;
   - press down into the strip, then A on an entry. It's removed, and focus stays in the strip (on the next entry,
     or on Clear).
2. **Empty sequence can't start:**
   - choose Sequence with no maps. The hint "Pick at least one map…" appears and Start looks disabled;
   - clicking Start, pressing Enter with Start focused, pressing Enter with nothing focused and pressing the
     gamepad's Start button all do nothing.
3. **Limit and trimming on screen:**
   - with 3 rounds, add 3 maps. The count reads "3 / 3 · full" and the cards look disabled;
   - change rounds from 5 to 3 with 5 maps in the strip. The strip drops to 3 straight away;
   - build 5 maps in Waves, then switch to Last One Standing with 3 rounds. The strip shows 3 straight away.
4. **Thumbnails:**
   - all four cards show the right layout in the theme's colours, with no spawn markers;
   - they look sharp on a high-DPI screen;
   - they redraw if a `theme.json` loads late.
5. **Keyboard focus:** the arrow keys and W/A/S/D move through the Maps row, cards, strip and Clear, and the focus
   is clearly highlighted (task 5.6 asks for this to be checked visually).
6. **In game:** in a Random game and a Sequence game, the arena switches to the new board at the start of each
   countdown, and the banner reads e.g. "Round 2 of 5 · Pac-Tank" or "Wave 3 · Pac-Tank · AI armour up".
7. **Persistence:** the sequence survives *Play again* and *Settings* → back to setup. It resets on page reload.
