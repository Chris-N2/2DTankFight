## REMOVED Requirements

### Requirement: Built-in boards
**Reason**: Replaced by *Built-in board catalogue*. The game now ships seven boards, and its "Four boards available"
scenario no longer holds. The new requirement keeps every existing board description and scenario, and adds the
three new boards, the Pac-Tank and Run For Cover spawn fixes, and the "no free first shot" rule.
**Migration**: None needed in code; the board catalogue grows from four to seven.

## ADDED Requirements

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
