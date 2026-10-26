## Purpose

The browser experience around the simulation: choosing options, driving with the keyboard, seeing the arena and
what's happening in it, and moving between rounds and games. Kept separate from the rules so the same rules can later
run on a server.

## ADDED Requirements

### Requirement: Setup screen
When the game loads, the player SHALL see a setup screen offering the Last One Standing options (number of AI
opponents, number of rounds) with sensible defaults, a summary of the controls, and a Start button.

#### Scenario: Starting a game
- **WHEN** the player chooses 2 AI opponents and 3 rounds and presses Start
- **THEN** round 1 begins with the human and 2 AI tanks

#### Scenario: Defaults allow an immediate start
- **WHEN** the player presses Start without changing anything
- **THEN** a game starts with the default options

### Requirement: Keyboard controls
The human tank SHALL be driven with either the arrow keys or W/A/S/D (up/W forward, down/S reverse, left/A turn left,
right/D turn right), and fire with Space. While a game is in progress, these keys SHALL NOT scroll or otherwise affect
the page.

#### Scenario: Both key sets work
- **WHEN** the player presses W, or the up arrow
- **THEN** the human tank drives forward in either case

#### Scenario: Keys do not scroll the page
- **WHEN** the player presses Space or an arrow key during play
- **THEN** the page does not scroll

### Requirement: Arena rendering
The client SHALL draw the arena, obstacles, live tanks (showing their heading), shells in flight, and visible effects
for shots, bounces, hits and eliminations. Each tank SHALL have a distinct colour, and the human's tank SHALL be
clearly identifiable as "you". Motion SHALL appear smooth regardless of the display's refresh rate, and the arena
SHALL scale to fit the browser window while keeping its aspect ratio.

#### Scenario: Identify your tank
- **WHEN** a round begins
- **THEN** the human's tank is visually distinguished from all AI tanks

#### Scenario: Window resize
- **WHEN** the browser window is resized during play
- **THEN** the whole arena remains visible and undistorted

#### Scenario: Elimination is visible
- **WHEN** a tank is eliminated
- **THEN** an explosion or similar effect is shown where it was and the tank is no longer drawn

### Requirement: Heads-up display
During play the client SHALL show the human's current hit points, the current round number and total rounds, and the
score (human vs AI).

#### Scenario: Damage shown
- **WHEN** the human's tank is hit
- **THEN** the displayed hit points decrease accordingly

### Requirement: Round and game flow screens
The client SHALL show the round-start countdown, then after each round a short result message (won, lost or drawn
round, with the updated score) before the next round begins automatically. When the game ends the client SHALL show
the final result (win, loss or draw) and score, with options to play again with the same settings or return to the
setup screen.

#### Scenario: Next round starts automatically
- **WHEN** a round ends and the game is not over
- **THEN** the round result is shown briefly and the next round's countdown begins without further input

#### Scenario: Play again
- **WHEN** the player chooses "play again" on the game result screen
- **THEN** a new game starts with the same number of AI opponents and rounds, and scores reset to zero

### Requirement: Pause
The player SHALL be able to pause and resume with Escape. The game SHALL also pause automatically when the browser
tab is hidden or the window loses focus. While paused the simulation SHALL NOT advance, and a paused overlay SHALL be
shown.

#### Scenario: Escape pauses
- **WHEN** the player presses Escape during a round
- **THEN** all movement stops and a paused overlay appears until Escape is pressed again

#### Scenario: Switching tabs pauses
- **WHEN** the player switches to another browser tab mid-round and later returns
- **THEN** no simulation time has passed while the tab was hidden and the game is shown paused
