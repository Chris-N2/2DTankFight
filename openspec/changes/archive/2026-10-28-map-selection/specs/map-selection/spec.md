## Purpose

Choosing which board each round or wave is played on: picked at random without repeats, or following a sequence the
host chose. The choice is made by the simulation from the options and the match seed, so every player and the future
server agree on it.

## ADDED Requirements

### Requirement: Map mode option
Every game SHALL have a map mode, either **Random** or **Sequence**. A Sequence SHALL be an ordered list of 1 to 7
board ids. The same id may appear more than once. In Last One Standing a Sequence SHALL be no longer than the number
of rounds. Options SHALL refer to boards only by id. A game requested with an unknown map mode, an empty or too-long
sequence, or an id that is not a built-in board SHALL NOT be created, and the reason SHALL be reported.

#### Scenario: Valid sequence accepted
- **WHEN** a Last One Standing game is requested with 5 rounds and the sequence Pac-Tank, Run For Cover, Pac-Tank
- **THEN** the game is created

#### Scenario: Sequence longer than the rounds rejected
- **WHEN** a Last One Standing game is requested with 3 rounds and a sequence of 4 maps
- **THEN** the game is not created and the reason is reported

#### Scenario: Waves sequence limit
- **WHEN** a Waves game is requested with a sequence of 8 maps, or of none
- **THEN** the game is not created and the reason is reported

#### Scenario: Unknown map rejected
- **WHEN** a game is requested with a sequence containing an id that is not a built-in board
- **THEN** the game is not created and the reason is reported

#### Scenario: Unknown map mode rejected
- **WHEN** a game is requested with a map mode other than Random or Sequence
- **THEN** the game is not created and the reason is reported

### Requirement: Board for each round or wave
At the start of each round (Last One Standing) or wave (Waves) the simulation SHALL choose that round's board as the
map mode directs. Tanks SHALL then be spawned on that board. The board SHALL NOT change during a round or wave.

#### Scenario: Board changes between rounds
- **WHEN** round 1 is played on one board and the map mode selects a different board for round 2
- **THEN** round 2's obstacles, spawn points and AI navigation are those of the new board

#### Scenario: Board fixed within a wave
- **WHEN** a wave is in progress
- **THEN** it is played to its end on the board it started on

### Requirement: Sequence order
With a Sequence, round or wave *n* SHALL be played on the sequence's entry at position *n*. When the sequence runs
out it SHALL start again from its first entry.

#### Scenario: Played in order
- **WHEN** a Last One Standing game with the sequence Run For Cover, Pac-Tank, Proving Ground is played
- **THEN** rounds 1, 2 and 3 are played on Run For Cover, Pac-Tank and Proving Ground in that order

#### Scenario: Sequence repeats in Waves
- **WHEN** a Waves game with a sequence of 2 maps reaches wave 3
- **THEN** wave 3 is played on the first map of the sequence and wave 4 on the second

#### Scenario: Always this map
- **WHEN** a game is played with a one-map sequence
- **THEN** every round or wave is played on that map

### Requirement: Random without repeats
With Random, the boards SHALL be played in a shuffled order where every built-in board is played once before any
board is played again. Once every board has been played, a new shuffled order SHALL begin. No board SHALL be played
in two consecutive rounds or waves, including where one shuffled order ends and the next begins.

#### Scenario: Every map before a repeat
- **WHEN** a Random Waves game reaches as many waves as there are built-in boards
- **THEN** each built-in board has been played exactly once

#### Scenario: No back-to-back repeat
- **WHEN** a Random game is played for three times as many rounds or waves as there are built-in boards
- **THEN** no two consecutive rounds or waves are played on the same board

### Requirement: Reproducible map choice
The boards chosen SHALL be determined by the options and the match seed alone. Map choice SHALL NOT change which
spawn points tanks are given, or what the AI does, compared with a game on the same boards with the same seed.

#### Scenario: Same seed, same maps
- **WHEN** two Random games are created with the same options and seed
- **THEN** they are played on the same boards in the same order

#### Scenario: Map choice doesn't disturb spawns
- **WHEN** a game with a one-map Proving Ground sequence is played with a given seed and the same inputs as a game
  recorded before map selection existed
- **THEN** every tank is given the same spawn point in every round, and the game plays out identically
