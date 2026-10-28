## Context

Boards are plain data (`src/sim/src/boards/`), checked by `validateBoard` and registered in `BUILT_IN_BOARDS`; the
map picker and Random mode pick up whatever is registered. Spawn assignment (`startRound` in `match.ts`) shuffles the
board's spawn list with the match's seeded randomness and gives tank *i* the *i*-th spawn. It knows nothing about who
is human. The AI (`ai/think.ts`) only engages along a clear, straight firing lane (`hasClearLane`); it never plans a
bank shot. Any bounce that has hit a player so far was luck.

The grid is 30 × 20 squares of 40 units. Corridors are at least 3 squares wide; spawns need 250 units between them.
`wallsFromGrid` turns an ASCII picture into wall rectangles, as `pacTank.ts` does.

## Goals / Non-Goals

**Goals:**
- Three boards with a distinct identity each: a slow detour (Frustration), bank shots (Ricochet Alley) and lane
  crossings with shelter (Checkerboard).
- Turn each board's defining property into a test where it can be checked, so a later tweak can't quietly break it.
- Fix the two spawn problems found in the map-selection playtest and QA, on the boards themselves.

**Non-Goals:**
- Any change to spawn assignment, the AI, or the validity rules.
- Final layouts that need no tuning. These are starting points for a playtest, like the first four boards were.

## Decisions

### Frustration: sealed strips, baffled gaps

The brief was "barriers around most of the board, with gaps in the middle of each side", and the feel the user wants
is *you can't easily hunt anything down straight away*. A plain ring fails that: its outside is one continuous loop,
so corner spawns look at each other down long 3-square lanes (Pac-Tank's wave-4 problem again). Two additions fix it:

- **Spurs** from each ring corner to the board edge cut the outside into four strips, each joined to the inside only
  through its own gap. One spawn per strip means every outer spawn starts alone.
- **Baffles** inside each gap stop straight shots through it. You come through the gap and have to turn.

Starting layout (half-turn symmetric; `A` outer spawn, `B` inside spawn):

```
   ...#......................#...
   ...#...A..................#...
   ...#......................#...
   ...##########....##########...
   ...#......................#.A.
   ...#......................#...
   ...#......................#...
   ...#...#...########...#...#...
   .......#..............#.......
   .......#.B....##....B.#.......
   .......#......##......#.......
   .......#..............#.......
   ...#...#...########...#...#...
   ...#......................#...
   ...#......................#...
   .A.#......................#...
   ...##########....##########...
   ...#..................A...#...
   ...#......................#...
   ...#......................#...
```

- Gaps are 4 squares, not the brief's 3: on a 30 × 20 grid a gap centred on a side has to be an even width.
- The 2 × 2 centre block stops the two inside spawns from starting in a straight duel 440 units apart.
- Mortars arc over walls, so they will be strong here. That suits Waves, where only humans have them; in Last One
  Standing the AI's accurate mortars may sting (see Risks).
- **Pace:** slower than every other board, on purpose. The user wants a more sedate option among a set of fast boards,
  and players who don't want it can leave it out of a Sequence.
- Alternative considered: everyone spawns outside, or everyone inside. Outside makes the inside pointless; inside makes
  a smaller Proving Ground with a moat.

### Ricochet Alley: mirrors, not alleys

Pac-Tank already makes bank shots round corners its main skill, and Checkerboard is about lines of sight, so the name
needed its own hook. Two shapes were considered:

- **Alleys** (horizontal lanes split by long walls): rejected. Every lane is a long, clear sightline, so lane-end
  spawns repeat the corner-lane problem, and 4-square lanes are too narrow for blockers under the 3-square rule.
- **Mirrors** (chosen): a mostly open board with long walls placed to bank shots off, and spawns tucked into pockets
  so that **no two spawns have a straight line between them** (a spec scenario). The bounce becomes the main way to hit
  anyone from the start, and the old rule that a bounced shell can hit its own firer takes centre stage.

Starting sketch (not grid-exact):

```
   +--------------------------------+
   |  S  |                    |  S  |
   |     |   ==============   |     |
   |  ---                      ---  |
   |  ||                        ||  |
   |  ||         [  ]           ||  |
   |  ||                        ||  |
   |  ---                      ---  |
   |     |   ==============   |     |
   |  S  |                    |  S  |
   +--------------------------------+
```

The corner spawns need L-shaped pockets: without the horizontal stubs, two corner spawns on the same side would see
each other down the side lane. A fifth (and sixth) spawn can go behind the side posts or the mirrors. Draw it as an
ASCII picture with `wallsFromGrid` and let the "no straight line between spawns" test guide the layout.

**AI:** the AI will leave cover to get a straight line, while humans can bank shots at it. That gives humans an edge
on this board, which suits Waves, where the human is outnumbered. Teaching the AI bank shots is a later change.

### Checkerboard: staggered 2 × 2 blocks with 4-square gaps

An aligned grid gives every open square two long, clear lanes, so no spawn could ever be sheltered. A staggered
(brickwork) grid breaks up the lanes in one direction and leaves room for sheltered spawns. A half-step stagger only
lands on the 40-unit grid if the repeat is an even number of squares, so the blocks are 2 × 2 with **4-square gaps**.

Starting layout:

```
   ..............................
   ..............................
   ..............................
   .....##....##....##....##.....
   .....##....##....##....##.....
   ..............................
   ..............................
   ..............................
   ..............................
   ........##....##....##........
   ........##....##....##........
   ..............................
   ..............................
   ..............................
   ..............................
   .....##....##....##....##.....
   .....##....##....##....##.....
   ..............................
   ..............................
   ..............................
```

This may turn out too sparse (11 blocks). If so, tighten the vertical spacing or add half-blocks at the edges of the
middle row before the playtest. Spawns go next to blocks, in the gaps of the outer rows of blocks, where blocks cover
both sides; the "no free first shot" scenario rules out the worst placements.

### Pac-Tank: two inner spawns (7 in all)

In Waves at 4–5 tanks the human often started in a corner with AI tanks in both neighbouring corners and the middle.
Each corner sits where two outer corridors meet, so it can see both neighbours. Two extra spawns go in the inner
horizontal corridors, half-turn symmetric: around column 8, row 7 and column 21, row 12 (about 278 units from the
middle spawn, so they meet the 250-unit rule). Face them along their corridor, not at the middle spawn.

- With 4 tanks, the chance of starting in a corner drops from 4 in 5 to 4 in 7, and the pile-up is rarer.
- With 5 tanks, there are spare spawns, so a full board no longer means every corner is taken.

Alternatives considered:
- **Human-aware spawn assignment** (give the human the spawn furthest from the AI). It can't help on its own: with
  every spawn filled there's nothing to choose. On Pac-Tank it would also put the human in the middle every round,
  which breaks the "spawns vary between rounds" rule. (The playtest found the middle easy only while AI tanks die in
  one hit; at two hits it was punishing too.) Parked until a playtest shows it is still needed.
- **Shields at the corner spawns.** These narrow the corridors below 3 squares.

### Run For Cover: centre spawns face the centre

The top- and bottom-centre spawns were deliberately turned along the edge, so they wouldn't face their cover block.
QA found that this aims them down a clear lane at a corner spawn. They now use `towardsCentre`, like every other
spawn: they face into their block and have to turn before shooting, but nobody gets a free first shot.

### "No free first shot" applies to every board

The Run For Cover bug is a general one, so the rule goes in the *Built-in boards* requirement for every board, and the
test runs on all of them. The check: cast a ray from each spawn along its heading, and fail if it passes within a
tank's radius of another spawn before it reaches an obstacle or the boundary. It ignores bounces; a bank shot on the
first tick isn't a free shot. From the layouts, the four existing boards should pass once Run For Cover is fixed. If
one doesn't, adjust that spawn's heading.

## Risks / Trade-offs

- [Frustration rounds drag in Last One Standing] → This is intended. The playtest decides whether gap or baffle sizes
  need changing.
- [AI mortars dominate Frustration in Last One Standing, since they arc over the walls the board relies on] →
  Playtest. If it's bad, that belongs to the parked mortar and difficulty work, not to the board.
- [Ricochet Alley is too easy against an AI that never banks shots] → This suits Waves. In Last One Standing, the AI
  still fires plenty once it has driven into the open.
- [Checkerboard is too sparse or too lane-heavy] → Tune the spacing before the playtest. The stagger is the decision;
  the numbers aren't.
- [Pac-Tank's spawn list grows, so a seed's spawn shuffle changes] → Only Pac-Tank games differ from before. Update any
  test that pins Pac-Tank spawn positions.
- [Seven map cards make the setup panel taller, and it already scrolls at 1920 × 1080] → Check during
  implementation. A second panel is a separate change if it's needed.
