## Why

The first playtest found the game fun but fiddly on a keyboard: turning is all-or-nothing, so lining up a shot means
tapping keys, and firing means hammering Space. A top-down tank game suits a gamepad well. Gamepad support makes the
game more comfortable and more accessible, and it is small and self-contained enough to land before Waves mode.

## What Changes

- **Gamepad driving and firing.** Through the browser's Gamepad API, the left stick steers and drives, with the
  d-pad as a digital alternative. A or the right trigger fires. LB and RB are left free for mortars later.
- **Analogue steering.** Pushing the stick part-way turns the tank at part of the full turn rate, for fine aim.
  Driving forward and back stays at fixed speeds. This is a deliberate choice: in single-player, the precision is
  worth having. Whether analogue steering is fair against keyboard players will be revisited in the multiplayer
  change. The setup screen says the game is best played with a gamepad.
- **Simulation: turn input becomes a value from −1 to 1** instead of only left, right or none. Out-of-range or
  invalid values are clamped or treated as no turn. The AI still uses only full turns, and keyboard input is
  unchanged.
- **Menus work with the gamepad.** The setup, pause and result screens can all be used without touching the
  keyboard: d-pad or stick to move, A to confirm, B to go back, and Start to pause and resume.
- **Keyboard and gamepad work together.** Either can be used at any moment, with no switching step.
- **Gamepad detection.** Browsers only reveal a gamepad after one of its buttons is pressed on the page. The setup
  screen invites the player to press a button, then confirms when a gamepad is detected.
- **A disconnected gamepad pauses the game,** just as switching tabs does.
- Not included: control remapping, vibration, analogue throttle, local two-player on one machine, and touch
  controls.

## Capabilities

### New Capabilities

None. Gamepad support is part of the existing browser client experience.

### Modified Capabilities

- `game-client`: adds gamepad controls, gamepad menu navigation and gamepad detection. The setup screen gains
  gamepad controls and the "best played with a gamepad" hint. Pause gains the Start button and pausing on
  disconnect.
- `simulation`: the tank input model allows a turn amount between −1 and 1, and turning speed scales with it.

## Impact

- **Client (`src/client`):** a new gamepad input module, kept as pure functions over a gamepad snapshot so it can
  be tested in Node. It also needs:
  - a way to combine keyboard and gamepad input;
  - a menu navigation layer for the overlays;
  - visible focus styling;
  - setup screen and pause screen text updates;
  - README controls.
- **Simulation (`src/sim`):** `TankInput.turn` widens from `-1 | 0 | 1` to a number. The input is cleaned at the
  boundary, so bad values can't break determinism. Turning is scaled by the turn amount. Existing tests still pass,
  and new tests cover partial and invalid turn values.
- **No new dependencies.** The Gamepad API is built into browsers. It requires a secure context (https or
  localhost), which matters when the game is deployed.
