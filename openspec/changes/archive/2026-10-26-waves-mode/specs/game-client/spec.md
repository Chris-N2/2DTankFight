## MODIFIED Requirements

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
