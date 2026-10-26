## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Setup screen
When the game loads, the player SHALL see a setup screen offering the Last One Standing options (number of AI
opponents, number of rounds) with sensible defaults, a summary of both keyboard and gamepad controls, a note that the
game is best played with a gamepad, and a Start button.

#### Scenario: Starting a game
- **WHEN** the player chooses 2 AI opponents and 3 rounds and presses Start
- **THEN** round 1 begins with the human and 2 AI tanks

#### Scenario: Defaults allow an immediate start
- **WHEN** the player presses Start without changing anything
- **THEN** a game starts with the default options

#### Scenario: Controls for both devices
- **WHEN** the setup screen is showing
- **THEN** it lists the keyboard and the gamepad controls, and says the game is best played with a gamepad

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
