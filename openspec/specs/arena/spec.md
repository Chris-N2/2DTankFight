# arena Specification

## Purpose

The playing field: its bounds, the obstacles tanks hide behind, and where tanks start. It also sets the rules every
board must satisfy so that games are fair and nobody is trapped.

## Requirements

### Requirement: Board definition
A board SHALL be defined as data, consisting of a rectangular playing area enclosed by a boundary, a set of
axis-aligned rectangular obstacles, and at least five spawn points, each with a position and an initial heading.

#### Scenario: Board loads from data
- **WHEN** the game loads the built-in board
- **THEN** the simulation receives its dimensions, obstacles and spawn points without any board-specific code

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

### Requirement: Single built-in board
This change SHALL provide exactly one hand-made board, used for every round.

#### Scenario: Same board each round
- **WHEN** a new round starts
- **THEN** it is played on the built-in board

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
