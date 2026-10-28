## Why

Map selection shipped with four boards, and the playtest went well: Run For Cover and Nowhere (Much) To Hide are fast
and fun, and Pac-Tank rewards thinking. But every board so far is *fast*, and the plan was seven boards. This change
adds the last three of the first set, each with its own pace or skill, and fixes the two spawn problems the playtest
and the map-selection QA turned up.

## What Changes

- **Three new hand-made boards**, bringing the total to seven:
  - **Frustration:** a ring of barriers with a gap in each side. Spurs from the ring's corners to the board edge seal
    the outside into four separate strips, and a baffle inside each gap blocks straight shots through it. Every outer
    spawn is alone in its strip, so reaching anyone means a detour through the middle. **Deliberately slower** than
    the other boards, as a change of pace.
  - **Ricochet Alley:** long walls placed as "mirrors", with spawns tucked away so that **no two spawns have a
    straight line between them**. Bank shots are the main way to hit anyone, and a bounced shell can still hit the
    tank that fired it.
  - **Checkerboard:** a staggered (brickwork) pattern of 2 × 2 blocks. The stagger breaks up the long lanes an aligned
    grid would have, so spawns can be sheltered.
- **Pac-Tank gets two more spawn points**, inside the maze, in the inner corridors (7 in all). In Waves at 4–5 tanks
  the human often started in a corner with AI tanks in both neighbouring corners, which the playtest found close to
  frustrating. More spawns mean a corner pile-up happens less often, and a full board no longer fills every corner.
- **Run For Cover's top- and bottom-centre spawns face the centre** (into their cover block) instead of along the
  edge, where they looked straight down a clear lane at a corner spawn (a free first shot, noted in the map-selection
  QA report).
- **Not in this change** (and why):
  - *The Keep* is dropped for now: a walled central fortress is too close to Pac-Tank and Frustration.
  - *AI bank shots:* the AI only fires along a clear straight line. On Ricochet Alley that hands humans an edge, which
    suits Waves. Teaching the AI to bank shots is a bigger AI change for later, perhaps with a difficulty setting.
  - *Human-aware spawn assignment* (placing the human away from the AI in Waves) is parked; the Pac-Tank spawns
    should be playtested first. It couldn't help Pac-Tank alone: with every spawn filled there is nothing to choose.
  - *Mortar mud stopping AI from firing in Waves*, the *AI hesitating at barrier corners*, and the *setup panel's
    height* are separate changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `arena`: *Built-in boards* is replaced by *Built-in board catalogue*. A modified requirement can't drop its old
  "Four boards available" scenario, so the old requirement is removed and a new one added under the new name. The new
  requirement:
  - lists seven boards and describes the three new ones;
  - adds a "no free first shot" rule for every board;
  - turns the checkable properties of Frustration, Ricochet Alley and Pac-Tank into scenarios.

`map-selection` and `game-client` need no requirement changes: Random already plays every built-in board, a Sequence
can already hold up to 7 entries, and the map picker lists whatever boards are built in.

## Impact

- **Simulation (`src/sim/src/boards`):** three new board files (`frustration.ts`, `ricochetAlley.ts`,
  `checkerboard.ts`), registered in `index.ts`; extra spawns in `pacTank.ts`; headings in `runForCover.ts`.
- **Tests (`src/sim/test`):** board-specific tests for the new properties; any tests that assume four boards.
- **Client:** no code change expected. The map picker gains three cards, so check that the setup panel still works
  at 1920 × 1080 (it already scrolls there).
- **Determinism:** spawn assignment shuffles the board's spawn list, so Pac-Tank games with a given seed start
  differently from before. Nothing else about existing seeds changes.
- **Docs:** CLAUDE.md *Boards* lists the boards that exist and the ones still to come.
- No new dependencies.
