# game-client Specification

## Purpose

The browser experience around the simulation: choosing options, driving with the keyboard, seeing the arena and
what's happening in it, and moving between rounds and games. Kept separate from the rules so the same rules can later
run on a server.

## Requirements

### Requirement: Setup screen
When the game loads, the player SHALL see a setup screen offering a choice of mode: Last One Standing (the default)
or Waves. For Last One Standing it SHALL offer the number of AI opponents and the number of rounds. For Waves it SHALL
offer the starting number of AI tanks. Only the selected mode's options SHALL be shown, each with sensible defaults.
The screen SHALL also show a summary of both keyboard and gamepad controls, a note that the game is best played with
a gamepad, and a Start button. On the setup and result screens, the arrow keys and W/A/S/D SHALL move around the
options and buttons as the gamepad's d-pad does, and Enter or Space SHALL select.

#### Scenario: Starting a game
- **WHEN** the player chooses 2 AI opponents and 3 rounds and presses Start
- **THEN** round 1 begins with the human and 2 AI tanks

#### Scenario: Defaults allow an immediate start
- **WHEN** the player presses Start without changing anything
- **THEN** a game starts with the default options

#### Scenario: Controls for both devices
- **WHEN** the setup screen is showing
- **THEN** it lists the keyboard and the gamepad controls, and says the game is best played with a gamepad

#### Scenario: Starting a Waves game
- **WHEN** the player selects Waves, chooses a starting count of 2 and presses Start
- **THEN** wave 1 begins with the human and 2 AI tanks

#### Scenario: Options follow the mode
- **WHEN** the player switches the mode between Last One Standing and Waves
- **THEN** only that mode's options are shown, and they can be reached and changed with the keyboard, mouse or
  gamepad

#### Scenario: Menus with the keyboard
- **WHEN** the setup or result screen is showing and the player presses the arrow keys or W/A/S/D
- **THEN** the focus moves between rows and options as it does with the gamepad's d-pad, and Enter or Space selects
  the focused option or button

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

### Requirement: Gamepad controls
When a gamepad is connected, the human tank SHALL also be controllable with it:
- **Left stick:** sideways steers and forward/back drives. Small movements within a dead zone SHALL be ignored.
  Beyond the dead zone, steering SHALL be proportional to how far the stick is pushed. Driving SHALL be forward or
  reverse once the stick is pushed clearly in that direction.
- **D-pad:** steers and drives with full turn and fixed speed, like the keyboard.
- **Fire:** the A button (bottom face button) or the right trigger.
- **LB and RB** SHALL have no effect in this change; they are reserved.

Keyboard and gamepad SHALL both work at all times. When both give an input in the same tick, the stronger turn and
throttle SHALL apply, and fire SHALL count as held if either holds it. A fire button already held when a game starts
SHALL NOT fire until it has been released and pressed again.

#### Scenario: Analogue steering
- **WHEN** the player pushes the left stick halfway to the right, beyond the dead zone, with no throttle
- **THEN** the tank turns right more slowly than at full stick

#### Scenario: Stick dead zone
- **WHEN** the left stick rests slightly off-centre within the dead zone
- **THEN** the tank neither turns nor moves

#### Scenario: Fire with A or the trigger
- **WHEN** the player presses A, or pulls the right trigger
- **THEN** the tank fires, subject to the same cooldown as the keyboard

#### Scenario: Keyboard and gamepad together
- **WHEN** the player holds W on the keyboard while steering with the gamepad's left stick
- **THEN** the tank drives forward and turns, combining both

#### Scenario: Starting a game does not fire
- **WHEN** the player starts a game by pressing A and keeps holding it into the first round
- **THEN** the tank does not fire until A is released and pressed again

### Requirement: Gamepad menu navigation
Every screen outside play (setup, pause and game result) SHALL be usable with a gamepad alone:
- The d-pad or left stick SHALL move between controls and change option values. Holding a direction SHALL repeat
  after a short delay.
- A SHALL activate the focused control.
- B SHALL go back where that makes sense: resume from pause, or return to setup from the game result screen.
- Start SHALL start the game from setup, and resume from pause.

The control currently selected SHALL be clearly visible. The result screen SHALL ignore gamepad presses for the same
short grace period as the keyboard, so a player still pressing fire does not skip it.

#### Scenario: Choosing options with the d-pad
- **WHEN** on the setup screen the player moves to the AI opponents option, presses right once, moves down to Start
  and presses A
- **THEN** a game starts with one more AI opponent than before

#### Scenario: Selection is visible
- **WHEN** the player moves between controls with the gamepad
- **THEN** the selected control is visibly highlighted

#### Scenario: Back from the result screen
- **WHEN** the game result screen is showing and the player presses B
- **THEN** the setup screen appears

#### Scenario: Result screen grace period
- **WHEN** the player keeps pressing A as the final round ends
- **THEN** the result screen stays up and no new game starts until a press after the grace period

### Requirement: Gamepad detection
The setup screen SHALL show whether a gamepad is available. Browsers only reveal a gamepad after one of its buttons
is pressed on the page, so until one is detected the screen SHALL invite the player to press a button on their
gamepad. Once one is detected, the screen SHALL say so. If several gamepads are connected, input from any of them
SHALL control the human tank and the menus.

#### Scenario: Gamepad appears after a press
- **WHEN** the setup screen is showing and the player presses a button on a connected gamepad for the first time
- **THEN** the screen changes from the invitation to a "gamepad detected" message

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
During play the client SHALL show the human's current hit points. In Last One Standing it SHALL also show the current
round number and total rounds, and the score (human vs AI). In Waves it SHALL show the current wave number and the
number of waves cleared.

#### Scenario: Damage shown
- **WHEN** the human's tank is hit
- **THEN** the displayed hit points decrease accordingly

#### Scenario: Wave shown
- **WHEN** a Waves game is in its third wave
- **THEN** the HUD shows wave 3 and 2 waves cleared

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
  of AI tanks (starting with more is a different game). A new best SHALL be called out.

#### Scenario: Next round starts automatically
- **WHEN** a round ends and the game is not over
- **THEN** the round result is shown briefly and the next round's countdown begins without further input

#### Scenario: Play again
- **WHEN** the player chooses "play again" on the game result screen
- **THEN** a new game starts with the same mode and options, and scores (or waves cleared) reset to zero

#### Scenario: Escalation is announced
- **WHEN** a wave begins in which AI tanks have more armour than in the previous wave
- **THEN** the countdown banner says that the AI armour has gone up

#### Scenario: Thinner armour is announced
- **WHEN** a wave begins with more AI tanks than the previous wave, each with less armour
- **THEN** the countdown banner says there are more tanks with thinner armour

#### Scenario: Best on this device
- **WHEN** a Waves game ends with more waves cleared than any earlier Waves game in this browser with the same
  starting number of AI tanks
- **THEN** the result screen says it is a new best, and later games show it as the best so far

#### Scenario: Best survives storage being unavailable
- **WHEN** the browser blocks local storage
- **THEN** Waves still plays normally, and the result screen shows the waves cleared without a best

### Requirement: Pause
The player SHALL be able to pause and resume with Escape or the gamepad's Start button. The game SHALL also pause
automatically when the browser tab is hidden, when the window loses focus, or when a gamepad that was in use is
disconnected. While paused the simulation SHALL NOT advance, and a paused overlay SHALL be shown that says how to
resume with either device.

#### Scenario: Escape pauses
- **WHEN** the player presses Escape during a round
- **THEN** all movement stops and a paused overlay appears until Escape is pressed again

#### Scenario: Switching tabs pauses
- **WHEN** the player switches to another browser tab mid-round and later returns
- **THEN** no simulation time has passed while the tab was hidden and the game is shown paused

#### Scenario: Start pauses
- **WHEN** the player presses Start on the gamepad during a round
- **THEN** the game pauses, and pressing Start again (or B) resumes it

#### Scenario: Gamepad disconnect pauses
- **WHEN** the gamepad the player is using is disconnected mid-round
- **THEN** the game pauses
