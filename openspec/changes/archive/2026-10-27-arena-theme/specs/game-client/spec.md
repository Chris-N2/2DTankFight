## MODIFIED Requirements

### Requirement: Arena rendering
The client SHALL draw the arena, obstacles, live tanks (showing their heading), shells in flight, and visible effects
for shots, bounces, hits and eliminations. The arena's floor, grid, obstacles and border SHALL be drawn in the
theme's colours (see the `theme` spec). Each tank SHALL have a distinct colour. The human's tank SHALL always be drawn
in the "you" colour, green, whatever the theme, and SHALL be clearly identifiable as "you" by its ring and label.
Motion SHALL appear smooth regardless of the display's refresh rate, and the arena SHALL scale to fit the browser
window while keeping its aspect ratio.

For mortars, the client SHALL draw:
- a landing reticle in front of the human's tank while the human charges, showing where the mortar would land if
  released now;
- each mortar in flight as a shell on an arc above a ground shadow, with a small marker at its landing point;
- a splash effect where a mortar lands;
- a visibly "bogged down" look on any tank that is slowed.

#### Scenario: Identify your tank
- **WHEN** a round begins
- **THEN** the human's tank is visually distinguished from all AI tanks

#### Scenario: You are green
- **WHEN** a game is played with any theme, in either mode
- **THEN** the human's tank is drawn in the "you" green, with its ring and "YOU" label

#### Scenario: Themed arena
- **WHEN** the theme sets the floor, grid, wall, wall edge and border colours
- **THEN** the arena is drawn in those colours

#### Scenario: Window resize
- **WHEN** the browser window is resized during play
- **THEN** the whole arena remains visible and undistorted

#### Scenario: Elimination is visible
- **WHEN** a tank is eliminated
- **THEN** an explosion or similar effect is shown where it was and the tank is no longer drawn

#### Scenario: Aiming the mortar
- **WHEN** the human holds the mortar button with a mortar loaded
- **THEN** a reticle shows the landing point, moving outwards as the charge grows, and following the tank's heading

#### Scenario: Mortar in flight
- **WHEN** any tank launches a mortar
- **THEN** the shell is drawn arcing towards its landing point, with a shadow on the ground and a marker where it
  will land

#### Scenario: Slowed tanks are obvious
- **WHEN** a tank is slowed by a mortar
- **THEN** it is drawn bogged down until the slow ends
