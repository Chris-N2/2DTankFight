# arena Specification

## Purpose

The playing field: its bounds, the obstacles tanks hide behind, and where tanks start. It also sets the rules every
board must satisfy so that games are fair and nobody is trapped.

## Requirements

### Requirement: Board definition
A board SHALL be defined as data, consisting of:
- a stable id and a display name;
- a rectangular playing area enclosed by a boundary;
- a set of axis-aligned rectangular obstacles;
- at least five spawn points, each with a position and an initial heading.

Every built-in board SHALL have the same playing-area size (1200 × 800), and no two built-in boards SHALL share an id.

#### Scenario: Board loads from data
- **WHEN** the game loads any built-in board
- **THEN** the simulation receives its dimensions, obstacles and spawn points without any board-specific code

#### Scenario: Built-in boards share a size and have unique ids
- **WHEN** the built-in boards are listed
- **THEN** every one is 1200 × 800 and every id is different

### Requirement: Board validity
Every board SHALL satisfy these rules:
- at least the configured minimum number of obstacles, so there is cover to hide behind;
- every spawn point has clearance for a whole tank, away from obstacles and the boundary;
- every spawn point is at least the configured minimum distance from every other spawn point;
- a tank can drive from every spawn point to every other spawn point (no sealed-off areas).

#### Scenario: Built-in board passes validation
- **WHEN** the board validator is run against every built-in board
- **THEN** every board passes all validity rules

#### Scenario: Sealed spawn is rejected
- **WHEN** the validator is given a board where one spawn point is completely enclosed by obstacles
- **THEN** validation fails and names the unreachable spawn point

#### Scenario: Too few obstacles is rejected
- **WHEN** the validator is given a board with fewer obstacles than the minimum
- **THEN** validation fails

### Requirement: Spawn assignment
At the start of each round each tank SHALL be placed at a different spawn point, facing that spawn point's initial
heading. The assignment of tanks to spawn points SHALL be chosen with the simulation's seeded randomness, so spawn
positions vary between rounds.

#### Scenario: Distinct spawns
- **WHEN** a round starts with five tanks
- **THEN** each tank occupies a different spawn point

#### Scenario: Spawns vary between rounds
- **WHEN** several rounds are played in one game
- **THEN** the human's spawn point is not fixed to the same point every round (for a given seed, the sequence is reproducible)

### Requirement: Built-in board catalogue
The game SHALL ship these hand-made boards, each of which passes every board validity rule:
- **Proving Ground:** roughly symmetric cover; a central block, flanking bars, corner L-shapes and mid-side barriers.
- **Run For Cover:**
  - six small blocks across the top and bottom (left, centre and right) and one block on each side;
  - an open centre, where nobody spawns;
  - fast, open play.
- **Nowhere (Much) To Hide:**
  - a short barrier beside each spawn point on the side facing the centre, giving that spawn cover;
  - a small centre piece;
  - otherwise open.
- **Pac-Tank:**
  - a symmetric maze of walls with corridors wide enough for a tank to pass another;
  - no dead ends;
  - no wraparound at the edges;
  - spawn points in the corners, in the middle and in the inner corridors, so a full board doesn't fill every corner.
- **Frustration:**
  - a ring of barriers with a gap in the middle of each side, and a small centre block;
  - the outside of the ring is divided into four separate strips, each joined to the inside only through its own gap;
  - a baffle inside each gap, so there is no straight shot along it (a diagonal shot past the baffle is still
    possible);
  - one spawn point in each outer strip and the rest inside the ring;
  - a slower game than the other boards, on purpose: reaching anyone means a detour.
- **Ricochet Alley:**
  - long walls placed as "mirrors" to bank shots off, around a mostly open board;
  - spawn points tucked away so that hitting anyone from where they start takes a bank shot.
- **Checkerboard:**
  - small square blocks in a staggered (brickwork) pattern, rather than an aligned grid with long clear lanes;
  - spawn points sheltered by the blocks.

On every built-in board, no spawn point SHALL start a tank aimed straight at another spawn point with nothing in
between: nobody gets a free first shot.

Beyond the validity rules and the scenarios below, whether a layout matches its description (and is fun) is checked
by review and playtest, not by automated tests.

#### Scenario: Seven boards available
- **WHEN** the built-in boards are listed
- **THEN** they are Proving Ground, Run For Cover, Nowhere (Much) To Hide, Pac-Tank, Frustration, Ricochet Alley
  and Checkerboard

#### Scenario: Open centre
- **WHEN** a round starts on Run For Cover
- **THEN** no tank starts in the open centre of the board

#### Scenario: No free first shot
- **WHEN** a tank starts at any spawn point on any built-in board, facing that spawn point's initial heading
- **THEN** a shell fired straight ahead would hit an obstacle or the boundary before reaching any other spawn point

#### Scenario: Pac-Tank has room to spare
- **WHEN** the Pac-Tank board is loaded
- **THEN** it has seven spawn points: one in each corner, one in the middle and two in the inner corridors

#### Scenario: Frustration's outer strips are sealed
- **WHEN** a tank drives from one of Frustration's outer spawn points to another
- **THEN** its route must pass through the inside of the ring

#### Scenario: No straight line between spawns on Frustration
- **WHEN** a straight line is drawn between any two spawn points on Frustration
- **THEN** an obstacle blocks it

#### Scenario: No straight line between spawns on Ricochet Alley
- **WHEN** a straight line is drawn between any two spawn points on Ricochet Alley
- **THEN** an obstacle blocks it
