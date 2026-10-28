## MODIFIED Requirements

### Requirement: Setup screen
When the game loads, the player SHALL see a setup screen offering a choice of mode: Last One Standing (the default)
or Waves. For Last One Standing it SHALL offer the number of AI opponents and the number of rounds. For Waves it SHALL
offer the starting number of AI tanks. Both modes SHALL offer a Mortars on/off option, on by default; off is classic
play. Both modes SHALL also offer a Maps option, Random (the default) or Sequence (see *Map picker*). Only the selected
mode's options SHALL be shown, each with sensible defaults.
The screen SHALL also show a summary of both keyboard and gamepad controls, a note that the game is best played with
a gamepad, and a Start button. On the setup and result screens, the arrow keys and W/A/S/D SHALL move around the
options and buttons as the gamepad's d-pad does, and Enter or Space SHALL select.

#### Scenario: Starting a game
- **WHEN** the player chooses 2 AI opponents and 3 rounds and presses Start
- **THEN** round 1 begins with the human and 2 AI tanks

#### Scenario: Defaults allow an immediate start
- **WHEN** the player presses Start without changing anything
- **THEN** a game starts with the default options, with mortars on and Random maps

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

## ADDED Requirements

### Requirement: Map picker
When Maps is set to Sequence, the setup screen SHALL show:
- every built-in board as a small picture of its layout (floor and obstacles in the theme's colours, without spawn
  points), with its name;
- the sequence chosen so far, in order and numbered, with how many maps it holds and its limit.

The picker SHALL work like this:
- Choosing a board SHALL add it to the end of the sequence. Choosing an entry in the sequence SHALL remove that entry.
- A Clear control SHALL empty the sequence.
- The limit SHALL be 7 maps, or the number of rounds in Last One Standing if that is fewer. No board SHALL be added
  once the sequence is at its limit.
- If the limit drops below the sequence's length, the sequence SHALL be shortened from its end straight away. This
  happens when the number of rounds is lowered, or when switching from Waves to Last One Standing with fewer rounds
  than the sequence holds.
- With Sequence selected and an empty sequence, the game SHALL NOT start, by any means. The screen SHALL say that at
  least one map must be picked.
- The sequence SHALL be kept when switching mode or Maps setting, and between games, until the page is reloaded,
  except where it is shortened to fit its limit.
- All of this SHALL be usable with the mouse, the keyboard and the gamepad, using the same movement and selection as
  the other options.

#### Scenario: Building a sequence
- **WHEN** the player selects Sequence and chooses Pac-Tank, then Run For Cover, then Pac-Tank, and presses Start
- **THEN** the game is played on Pac-Tank, Run For Cover and Pac-Tank in that order

#### Scenario: Removing a map
- **WHEN** the sequence is Pac-Tank, Run For Cover, Proving Ground and the player chooses the second entry
- **THEN** the sequence becomes Pac-Tank, Proving Ground

#### Scenario: Limit follows the rounds
- **WHEN** Last One Standing has 3 rounds and the sequence holds 3 maps
- **THEN** no further map can be added, and the screen shows the sequence as full

#### Scenario: Fewer rounds shortens the sequence
- **WHEN** the sequence holds 5 maps and the player changes the rounds from 5 to 3
- **THEN** the sequence keeps its first 3 maps

#### Scenario: Empty sequence can't start
- **WHEN** Maps is set to Sequence with no maps chosen and the player presses Start, Enter on Start, or the gamepad's
  Start button
- **THEN** no game starts and the screen says to pick at least one map

#### Scenario: Picking with the gamepad
- **WHEN** the player selects Sequence, moves into the board pictures with the d-pad and presses A on one
- **THEN** that board is added to the sequence

#### Scenario: Sequence survives a mode switch
- **WHEN** the player builds a sequence, switches to Waves and back to Last One Standing
- **THEN** the sequence is unchanged

#### Scenario: Switching to fewer rounds shortens the sequence
- **WHEN** Waves has a sequence of 5 maps and the player switches to Last One Standing with 3 rounds
- **THEN** the sequence keeps its first 3 maps

### Requirement: Map name shown
The countdown at the start of each round or wave SHALL name the board it is being played on, alongside the round or
wave number. The arena SHALL be drawn as the round's or wave's board from the moment its countdown begins.

#### Scenario: Name in the countdown
- **WHEN** round 2 of 5 is about to be played on Pac-Tank
- **THEN** the countdown shows the round number and the name Pac-Tank

#### Scenario: Next wave's board appears with its countdown
- **WHEN** a wave is cleared and the next wave is on a different board
- **THEN** the arena shows the new board, and the countdown names it, as soon as the new wave's countdown begins
