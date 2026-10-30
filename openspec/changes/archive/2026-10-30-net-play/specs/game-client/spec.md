## MODIFIED Requirements

### Requirement: Setup screen
When the game loads, the player SHALL see a setup screen offering a choice of mode: Last One Standing (the default)
or Waves. For Last One Standing it SHALL offer the number of AI opponents and the number of rounds. For Waves it SHALL
offer the starting number of AI tanks. Both modes SHALL offer a Mortars on/off option, on by default; off is classic
play. Both modes SHALL also offer a Maps option, Random (the default) or Sequence (see *Map picker*). Only the selected
mode's options SHALL be shown, each with sensible defaults.
The screen SHALL also show a summary of both keyboard and gamepad controls, a note that the game is best played with
a gamepad, and a Start button. When the host page names a multiplayer server, the screen SHALL also offer "Host online
game" and "Join a game" (see the `online-play` spec). Without one it SHALL offer neither, and nothing else on the
screen SHALL change. On the setup and result screens, the arrow keys and W/A/S/D SHALL move around the options and
buttons as the gamepad's d-pad does, and Enter or Space SHALL select.

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

#### Scenario: Online only with a server
- **WHEN** the game is on a page that names no multiplayer server
- **THEN** the setup screen offers neither "Host online game" nor "Join a game"

### Requirement: Arena rendering
The client SHALL draw the arena, obstacles, live tanks (showing their heading), shells in flight, and visible effects
for shots, bounces, hits, friendly hits and eliminations. A friendly hit SHALL look and feel harmless (a small
ricochet spark, not the hit flash). The arena's floor, grid, obstacles and border SHALL be drawn in the theme's
colours (see the `theme` spec). Each tank SHALL have a distinct colour. The player's own tank SHALL always be drawn in
the "you" colour, green, whatever the theme, and SHALL be clearly identifiable as "you" by its ring and label. In an
online game the other human's tank SHALL always be drawn blue. Motion SHALL appear smooth regardless of the display's
refresh rate, and the arena SHALL scale to fit the browser window while keeping its aspect ratio.

For mortars, the client SHALL draw:
- a landing reticle in front of the player's own tank while they charge, showing where the mortar would land if
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

#### Scenario: The other human is blue
- **WHEN** an online game is in play, on either player's screen
- **THEN** the other human's tank is drawn blue, and only the player's own tank has the "YOU" ring and label

#### Scenario: A harmless clang
- **WHEN** with friendly fire off one human's shell reaches the other
- **THEN** a small ricochet is shown where it struck, with no hit flash and no change to the HUD's hit points

### Requirement: Heads-up display
During play the client SHALL show the player's own current hit points, and, when mortars are on, whether their mortar
is loaded or used. In Last One Standing it SHALL also show the current round number and total rounds, and the score:
human vs AI in single-player, and the player against the other human ("You N – M Them") online. In Waves it SHALL show
the current wave number and the number of waves cleared.

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

#### Scenario: Your own numbers online
- **WHEN** in an online Last One Standing game the guest has 2 points and the host 1
- **THEN** the guest's HUD shows "You 2 – 1 Them" and the guest's own hit points, and the host's shows "You 1 – 2 Them"
  and the host's own hit points

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

Online games show their round and game results from each player's point of view, do not record bests, and leave the
choice of what's next to the host (see the `online-play` spec).

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

### Requirement: Pause
In a single-player game, the player SHALL be able to pause and resume with Escape or the gamepad's Start button. The
game SHALL also pause automatically when the browser tab is hidden, when the window loses focus, or when a gamepad
that was in use is disconnected. While paused the simulation SHALL NOT advance, and a paused overlay SHALL be shown
that says how to resume with either device. Online games never pause (see the `online-play` spec).

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

#### Scenario: Online games don't pause
- **WHEN** a player in an online game switches to another tab
- **THEN** the game carries on, and their own tank gets no input while they're away
