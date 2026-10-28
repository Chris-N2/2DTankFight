# QA Report: more-boards

**Verdict:** PASS
**Date:** 2026-10-28

## Build & tests

All run from the repository root.

| Command | Result |
|---|---|
| `npm run typecheck` | Pass (sim, client, client tests) |
| `npm run lint` | Pass, no warnings |
| `npm test` (`vitest run`) | Pass: 21 files, 379 tests |
| `npm run build` | Pass (vite, 40 modules, 61 kB JS) |
| `npm run format:check` | Pass |

Tasks: all 12 tasks in `tasks.md` are ticked. Task 4.1 records the manual check at 1920 × 1080 and the CSS fix that
came out of it.

I also ran some extra probes from a scratch test outside the repo, which imported the real boards and geometry:
- **Old Run For Cover headings:** with the old headings, the *No free first shot* helper flags spawn 4 → 1 and spawn
  5 → 2, and with the new headings it flags nothing. So the test really does catch the bug it was written for
  (task 1.1).
- **Shots allowing for the tank's size:** I swept every heading from every spawn on every board in 0.01° steps.
  Shells start at the muzzle (radius + offset = 24) and count as a hit if they reach within `tankRadius` (18) of
  another spawn before an obstacle or the boundary. This is stricter than the spec's centre-to-centre line.
- **Gaps narrower than 3 squares:** I listed every gap under 120 units between obstacles, or between an obstacle and
  the edge.
- **Frustration through-gap sightlines:** I looked for clear straight lines between cell centres, from the outer
  strips to the inside of the ring.

## Scenario coverage

| Requirement | Scenario | Status | Code | Test |
|---|---|---|---|---|
| Built-in board catalogue | Seven boards available | Verified | `src/sim/src/boards/index.ts:24-32` | `src/sim/test/arena.test.ts:141` |
| Built-in board catalogue | Open centre | Verified | `src/sim/src/boards/runForCover.ts:47-55` | `src/sim/test/arena.test.ts:170` |
| Built-in board catalogue | No free first shot | Verified | headings in all seven board files; Run For Cover fix at `runForCover.ts:52-55` | `src/sim/test/arena.test.ts:124` (helper `aimedAt` at :90, self-test at :133) |
| Built-in board catalogue | Pac-Tank has room to spare | Verified | `src/sim/src/boards/pacTank.ts:56-64` | `src/sim/test/arena.test.ts:188` |
| Built-in board catalogue | Frustration's outer strips are sealed | Verified | `src/sim/src/boards/frustration.ts:40-61, 76-83` | `src/sim/test/arena.test.ts:201` |
| Built-in board catalogue | No straight line between spawns on Frustration | Verified | `src/sim/src/boards/frustration.ts:76-83` | `src/sim/test/arena.test.ts:225` (helper `openLines` at :113, self-test at :233) |
| Built-in board catalogue | No straight line between spawns on Ricochet Alley | Verified | `src/sim/src/boards/ricochetAlley.ts:43-64, 82-91` | `src/sim/test/arena.test.ts:229` |
| Built-in board catalogue | (every board passes the validity rules) | Verified | `src/sim/src/validate.ts` | `src/sim/test/arena.test.ts:42` |
| Removed: Built-in boards | "Four boards available" removed | Verified | n/a | old test replaced by "Seven boards available" |
| map-selection (unchanged) | Random plays every board before a repeat, now with seven | Verified | n/a | `src/sim/test/maps.test.ts:157-176` (uses `BUILT_IN_BOARDS`) |

Totals: 7 of 7 spec scenarios Verified, 0 Implemented but untested, 0 Missing or wrong.

The extra probes back the two "no straight line" scenarios up well. On Frustration and Ricochet Alley, **no spawn can
hit any other spawn with a straight shot at any heading**, even allowing for the tank's radius, not just along the
centre-to-centre line. Ricochet Alley's "every hit starts with a bank shot" holds from the spawn points.

Architecture: the new boards are plain data built with `wallsFromGrid`, with no DOM, timers or randomness. They are
registered once in `BUILT_IN_BOARDS` and exported from `src/sim/src/index.ts`. The simulation stays pure and shared.
The only client change is CSS (`src/client/src/styles.css`), and the map picker already loops over
`BUILT_IN_BOARDS` (`src/client/src/main.ts:460`). The golden and determinism tests still pass after the Pac-Tank
spawn list grew.

## Findings

### Implementation bugs (spec was right, code wasn't)

None found.

### Spec gaps (spec wrong or incomplete)

1. **Frustration's baffles don't stop *every* straight shot through a gap (low consequence, doesn't block).** The
   requirement says "a baffle inside each gap, so there is no straight shot through it". The baffles do block shots
   straight down the gap's axis, but diagonal shots get past them:
   - 68 clear lines from cell centres in the outer strips into the inner core (inside the baffles, where the two
     inner spawns sit). Example: top strip (380, 20) to core (860, 340), through the top gap and past the end of the
     row-7 baffle.
   - 56 clear lines from one outer strip to *another*, through two gaps. Example: left strip (20, 380), through the
     left gap and above the col-7 baffle, out of the top gap to (700, 100).

   The *spawn* guarantees all hold (see above), and the spec says layout descriptions are checked by review and
   playtest, so I haven't treated this as blocking. It is still a claim the board doesn't keep, though. Suggestion:
   either word it as "no straight shot along the gap", or, if the playtest shows strip-to-strip sniping matters,
   lengthen the baffles or add a test (e.g. "no clear line from an outer strip to the inner core").

### Minor / suggestions (do not block)

1. **Frustration's centre block is only 1 square from the baffles above and below it.** Its rows 9-10 leave a 40-unit
   slot at rows 8 and 11 against the row-7 and row-12 baffles (cols 11-18). That's below CLAUDE.md's 3-square
   corridor guideline. The nav grid marks the slot unwalkable (clearance 20), so the AI won't path through it, and a
   human (36 units wide) can only just squeeze in. It's how the design drew it and there's a way round either side,
   so it isn't a trap. It's a nook worth watching in the playtest: a tank wedged in there is a sitting duck.
2. **Checkerboard's end-of-row spawns are less sheltered than the others.** Spawns 4 (200, 400) and 5 (1000, 400) each
   have an open line to two spawns (0-4, 2-4, 1-5, 3-5), with about a 7° firing window after a turn of roughly 80°.
   It's not a free first shot, and "sheltered" is left to review, but these are the most exposed spawns among the new
   boards. Also, "beside its outermost block" is 120 units from that block's face, so moving them a square inwards
   may be worth trying.
3. **Pac-Tank's inner spawns can see the middle spawn.** They can hit it with a direct shot after a turn (about a
   1.1° window each). It's harmless, and corner-to-corner lines are unchanged from before. Just noting it for the
   "Pac-Tank Waves at 4–5 tanks" playtest.
4. **The *Pac-Tank has room to spare* test** checks that the two extra spawns are "inside the outer ring and not the
   middle", not that they're in the inner corridors. That's fine today, and a tighter check would only matter if the
   maze changes.
5. **The CSS for the four-to-a-row cards hard-codes the 6px gap.** `.choices.map-library .map-card` uses
   `calc((100% - 3 * 6px) / 4)`, which repeats `.choices { gap: 6px }`. If the gap ever changes, the cards will wrap
   to three to a row. A custom property would keep the two in step.
6. **Housekeeping:** `temp_docs_maps/` is untracked in the working tree and isn't part of this change. Worth deciding
   whether it belongs in the repo before committing.

## Manual checks for the human

- At 1920 × 1080: the map picker shows seven cards, four in the first row and three centred in the second. The
  thumbnails should be undistorted (3:2) and match each board, and the setup panel should still scroll and be usable.
  (Task 4.1 says this was checked. I can't confirm it without a browser.)
- Playtest each new board with a one-map Sequence:
  - **Frustration:** does the slower pace feel deliberate rather than dull? Try diagonal sniping through the gaps
    (spec gap 1) and the 1-square nooks beside the centre block (minor 1). In Last One Standing, do AI mortars
    dominate?
  - **Ricochet Alley:** are bank shots fun and findable, and does the AI's habit of driving into the open make it too
    easy?
  - **Checkerboard:** is it too sparse, and do the end-of-row spawns feel exposed (minor 2)?
- **Pac-Tank Waves at 4–5 tanks:** is the corner pile-up now rare enough?
- **Run For Cover:** do the centre spawns facing into their block feel natural to drive out of?
