## MODIFIED Requirements

### Requirement: Setup screen
When the game loads, the player SHALL see a setup screen offering a choice of mode: Last One Standing (the default)
or Waves. For Last One Standing it SHALL offer the number of AI opponents and the number of rounds. For Waves it SHALL
offer the starting number of AI tanks. Both modes SHALL offer a Mortars on/off option, on by default; off is classic
play. Only the selected mode's options SHALL be shown, each with sensible defaults.
The screen SHALL also show a summary of both keyboard and gamepad controls, a note that the game is best played with
a gamepad, and a Start button. On the setup and result screens, the arrow keys and W/A/S/D SHALL move around the
options and buttons as the gamepad's d-pad does, and Enter or Space SHALL select.

#### Scenario: Starting a game
- **WHEN** the player chooses 2 AI opponents and 3 rounds and presses Start
- **THEN** round 1 begins with the human and 2 AI tanks

#### Scenario: Defaults allow an immediate start
- **WHEN** the player presses Start without changing anything
- **THEN** a game starts with the default options, with mortars on

#### Scenario: Controls for both devices
- **WHEN** the setup screen is showing
- **THEN** it lists the keyboard and the gamepad controls, including the mortar button, and says the game is best
  played with a gamepad

#### Scenario: Starting a Waves game
- **WHEN** the player selects Waves, chooses a starting count of 2 and presses Start
- **THEN** wave 1 begins with the human and 2 AI tanks

#### Scenario: Options follow the mode
- **WHEN** the player switches the mode between Last One Standing and Waves
- **THEN** only that mode's options are shown, and they can be reached and changed with the keyboard, mouse or
  gamepad

#### Scenario: Classic play
- **WHEN** the player sets Mortars to off and presses Start
- **THEN** the game starts with mortars off, and the HUD shows no mortar

#### Scenario: Menus with the keyboard
- **WHEN** the setup or result screen is showing and the player presses the arrow keys or W/A/S/D
- **THEN** the focus moves between rows and options as it does with the gamepad's d-pad, and Enter or Space selects
  the focused option or button

### Requirement: Keyboard controls
The human tank SHALL be driven with either the arrow keys or W/A/S/D (up/W forward, down/S reverse, left/A turn left,
right/D turn right), fire with Space, and fire the mortar with either Shift key (hold to charge, release to launch).
While a game is in progress, these keys SHALL NOT scroll or otherwise affect the page.

#### Scenario: Both key sets work
- **WHEN** the player presses W, or the up arrow
- **THEN** the human tank drives forward in either case

#### Scenario: Either Shift fires the mortar
- **WHEN** the player holds and releases the left Shift key, or the right Shift key
- **THEN** the human tank charges and launches its mortar in either case

#### Scenario: Keys do not scroll the page
- **WHEN** the player presses Space or an arrow key during play
- **THEN** the page does not scroll

### Requirement: Gamepad controls
When a gamepad is connected, the human tank SHALL also be controllable with it:
- **Left stick:** sideways steers and forward/back drives. Small movements within a dead zone SHALL be ignored.
  Beyond the dead zone, steering SHALL be proportional to how far the stick is pushed. Driving SHALL be forward or
  reverse once the stick is pushed clearly in that direction.
- **D-pad:** steers and drives with full turn and fixed speed, like the keyboard.
- **Fire:** the A button (bottom face button) or the right trigger.
- **Mortar:** LB or RB (hold to charge, release to launch).

Keyboard and gamepad SHALL both work at all times. When both give an input in the same tick, the stronger turn and
throttle SHALL apply, and fire and mortar SHALL each count as held if either device holds it. A fire or mortar button
already held when a game starts SHALL NOT act until it has been released and pressed again.

#### Scenario: Analogue steering
- **WHEN** the player pushes the left stick halfway to the right, beyond the dead zone, with no throttle
- **THEN** the tank turns right more slowly than at full stick

#### Scenario: Stick dead zone
- **WHEN** the left stick rests slightly off-centre within the dead zone
- **THEN** the tank neither turns nor moves

#### Scenario: Fire with A or the trigger
- **WHEN** the player presses A, or pulls the right trigger
- **THEN** the tank fires, subject to the same cooldown as the keyboard

#### Scenario: Mortar with LB or RB
- **WHEN** the player holds and releases LB, or RB
- **THEN** the tank charges and launches its mortar in either case

#### Scenario: Keyboard and gamepad together
- **WHEN** the player holds W on the keyboard while steering with the gamepad's left stick
- **THEN** the tank drives forward and turns, combining both

#### Scenario: Starting a game does not fire
- **WHEN** the player starts a game by pressing A and keeps holding it into the first round
- **THEN** the tank does not fire until A is released and pressed again

#### Scenario: A held mortar button waits for a fresh press
- **WHEN** the player is holding LB as a game starts
- **THEN** the tank does not charge its mortar until LB is released and pressed again

### Requirement: Arena rendering
The client SHALL draw the arena, obstacles, live tanks (showing their heading), shells in flight, and visible effects
for shots, bounces, hits and eliminations. Each tank SHALL have a distinct colour, and the human's tank SHALL be
clearly identifiable as "you". Motion SHALL appear smooth regardless of the display's refresh rate, and the arena
SHALL scale to fit the browser window while keeping its aspect ratio.

For mortars, the client SHALL draw:
- a landing reticle in front of the human's tank while the human charges, showing where the mortar would land if
  released now;
- each mortar in flight as a shell on an arc above a ground shadow, with a small marker at its landing point;
- a splash effect where a mortar lands;
- a visibly "bogged down" look on any tank that is slowed.

#### Scenario: Identify your tank
- **WHEN** a round begins
- **THEN** the human's tank is visually distinguished from all AI tanks

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

### Requirement: Heads-up display
During play the client SHALL show the human's current hit points, and, when mortars are on, whether the human's
mortar is loaded or used. In Last One Standing it SHALL also show the current round number and total rounds, and the
score (human vs AI). In Waves it SHALL show the current wave number and the number of waves cleared.

#### Scenario: Damage shown
- **WHEN** the human's tank is hit
- **THEN** the displayed hit points decrease accordingly

#### Scenario: Wave shown
- **WHEN** a Waves game is in its third wave
- **THEN** the HUD shows wave 3 and 2 waves cleared

#### Scenario: Mortar readiness shown
- **WHEN** the human launches their mortar
- **THEN** the HUD changes from showing the mortar loaded to showing it used, and shows it loaded again at the start
  of the next round or wave

### Requirement: Round and game flow screens
The client SHALL show the round-start or wave-start countdown.
- **Last One Standing:** after each round, a short result message (won, lost or drawn round, with the updated score)
  SHALL show before the next round begins automatically.
- **Waves:**
  - After each cleared wave, a short "wave cleared" message SHALL show before the next wave's countdown begins
    automatically.
  - Each wave's countdown SHALL announce any escalation that wave brings (for example, tougher AI armour, harder
    hits or faster shells), and any wave in which bigger numbers bring thinner AI armour.

When the game ends, the client SHALL show the final result with options to play again with the same settings or
return to the setup screen:
- **Last One Standing:** win, loss or draw, and the score.
- **Waves:** the number of waves cleared, and the best number cleared on this device for the same starting number
  of AI tanks and the same mortars setting (either difference makes it a different game). A new best SHALL be
  called out. Bests recorded before mortars existed SHALL count as bests with mortars off.

#### Scenario: Next round starts automatically
- **WHEN** a round ends and the game is not over
- **THEN** the round result is shown briefly and the next round's countdown begins without further input

#### Scenario: Play again
- **WHEN** the player chooses "play again" on the game result screen
- **THEN** a new game starts with the same mode and options, including the mortars setting, and scores (or waves
  cleared) reset to zero

#### Scenario: Escalation is announced
- **WHEN** a wave begins in which AI tanks have more armour than in the previous wave
- **THEN** the countdown banner says that the AI armour has gone up

#### Scenario: Thinner armour is announced
- **WHEN** a wave begins with more AI tanks than the previous wave, each with less armour
- **THEN** the countdown banner says there are more tanks with thinner armour

#### Scenario: Best on this device
- **WHEN** a Waves game ends with more waves cleared than any earlier Waves game in this browser with the same
  starting number of AI tanks and the same mortars setting
- **THEN** the result screen says it is a new best, and later games show it as the best so far

#### Scenario: Bests are kept per mortars setting
- **WHEN** a player has a best of 6 waves with mortars off and then plays with mortars on and clears 3
- **THEN** the result screen shows 3 as a new best with mortars on, and the mortars-off best stays at 6

#### Scenario: Earlier bests are classic bests
- **WHEN** a best was recorded on this device before mortars were added, and the player then plays with mortars off
  and the same starting number of AI tanks
- **THEN** that earlier best is shown as the best so far

#### Scenario: Best survives storage being unavailable
- **WHEN** the browser blocks local storage
- **THEN** Waves still plays normally, and the result screen shows the waves cleared without a best
