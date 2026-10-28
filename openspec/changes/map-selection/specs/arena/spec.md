## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Single built-in board
**Reason**: Replaced by a set of built-in boards, chosen per round or wave by the `map-selection` capability.
**Migration**: Proving Ground remains a built-in board. A game with a one-map sequence of Proving Ground plays as
before.

## ADDED Requirements

### Requirement: Built-in boards
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
  - no wraparound at the edges.

Beyond the validity rules, whether a layout matches its description (and is fun) is checked by review and playtest,
not by automated tests.

#### Scenario: Four boards available
- **WHEN** the built-in boards are listed
- **THEN** they are Proving Ground, Run For Cover, Nowhere (Much) To Hide and Pac-Tank

#### Scenario: Open centre
- **WHEN** a round starts on Run For Cover
- **THEN** no tank starts in the open centre of the board
