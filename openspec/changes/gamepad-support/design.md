## Context

See proposal.md for why. The current state that shapes the approach:

- **Turn input is whole-number only.** The simulation's `TankInput` has `turn: -1 | 0 | 1`, and `moveTank` multiplies
  it by the turn rate. Throttle is applied as a sign: it picks one of the fixed speeds. The AI produces whole-number
  inputs.
- **Keyboard input.** `KeyboardState` in `src/client/src/input.ts` tracks pressed keys from events and turns them into
  a `TankInput` once per tick through the pure `inputFromKeys`. `Game.tick()` passes that to `step()`.
- **Screens.** The overlays (setup, pause, game result) are plain DOM with `<button>`s. The setup options are radio
  groups built by `buildChoices`. Keyboard users get Tab and Enter from the browser. A grace period on the result
  screen (`RESULT_KEY_GRACE_MS`) stops a player who is still pressing fire from starting a new game.
- **The Gamepad API is polled, not event-driven.** `navigator.getGamepads()` returns a fresh state when asked. The
  only events are `gamepadconnected` and `gamepaddisconnected`. A pad is invisible to the page until one of its
  buttons is pressed while the page is open. The API needs a secure context, which localhost counts as.
- **Client tests run in Node** without a DOM, so new logic has to be testable as pure code.

## Goals / Non-Goals

**Goals:**
- Turning and gamepad mapping logic that is pure and unit-tested. Only a thin layer touches `navigator` and the DOM.
- One way of handling input in menus, so the gamepad drives the existing buttons rather than a parallel UI.
- Keep the simulation deterministic, and safe against whatever input a future network client sends.

**Non-Goals:**
- Remapping, vibration, analogue throttle, local two-player, and touch controls (see proposal.md).
- Arrow-key menu navigation for keyboard users. Tab and Enter already work, and adding arrow keys can come later
  through the same menu layer.
- Showing the gamepad's model name or per-brand button icons. Labels use Xbox-style names, with "bottom button"
  where the position matters.

## Decisions

### D1. Widen `turn` to a number and clean it inside the simulation
- **Change:** `TankInput.turn` becomes `number`. In the world step, each tank's turn is cleaned before use: values
  that aren't finite become 0, and the rest are clamped to [−1, 1]. Then `heading += turn × turnRate × dt`, as now.
- **Throttle stays `-1 | 0 | 1`:** the spec keeps fixed speeds, and analogue throttle isn't wanted.
- **Why clean it in the simulation rather than the client:** the multiplayer server will receive inputs from
  untrusted clients, and the simulation is the one place every input passes through. A NaN reaching the heading would
  spread into every later tick and break determinism.
- **Who is affected:** the AI and the keyboard keep producing −1, 0 or 1, so their behaviour doesn't change. The
  existing determinism and soak tests confirm that.
- **Alternative considered:** a separate `turnAmount` field next to a whole-number `turn`. Rejected: it's two sources
  of truth for one thing.

### D2. Pure gamepad mapping over a snapshot
- **Snapshot:** `GamepadSnapshot` holds `{ axes: readonly number[], buttons: readonly { pressed: boolean; value: number }[] }`,
  which is the subset of the browser's `Gamepad` the game reads. A real `Gamepad` fits it as-is, and tests build
  plain objects.
- **`inputFromGamepad(snapshot): TankInput`** reads the browser's "standard" layout:

  | Control | Standard index |
  |---|---|
  | Left stick | axes 0 (x), 1 (y) |
  | A (bottom face button) | button 0 |
  | B (right face button) | button 1 |
  | LB / RB | buttons 4 / 5 (read by nothing in this change) |
  | Right trigger | button 7 (`value`) |
  | Start | button 9 |
  | D-pad up / down / left / right | buttons 12 / 13 / 14 / 15 |

- **Steering:** a round dead zone of 0.2 is applied to the stick as a whole, so drift in any direction is ignored.
  Beyond it, `turn` is the stick's x value rescaled from the dead zone edge to 1, so steering doesn't jump the moment
  it leaves the dead zone.
- **Driving:** `throttle` is 1 when y ≤ −0.5 (pushed up) and −1 when y ≥ 0.5, giving a clear push to drive and a wide
  band for turning on the spot.
- **D-pad and fire:** the d-pad gives whole-number turn and throttle. If the stick and d-pad are both in use, the
  stronger value wins, as in D3. Fire is held when A is pressed or the trigger value is at least 0.5.
- **Tuning:** the dead zone, throttle threshold and trigger threshold are named constants in the client gamepad
  module, ready for playtest tuning.
- **Pads that don't report the standard layout:** these are read with the same indices as a best effort. Common
  controllers report the standard layout in Chromium and Firefox on Windows. This is a risk; see below.

### D3. Combining devices
`combineInputs(a, b)`:
- **Turn and throttle:** the value with the larger size wins. If two opposite values are equally strong (keyboard
  forward against a stick pushed fully back), the result is 0, matching how opposite keys cancel on the keyboard.
- **Fire:** held if either device holds it.
- **Several pads:** combined the same way, so any connected pad works.

This is pure and unit-tested. `Game.tick()` combines keyboard and gamepad input, then applies the fire latch from D4.

### D4. A fire latch at game start
`FireLatch` is a small pure state holder. When a game starts it is armed. While armed, it reports fire as not held
until the combined fire input has been seen released, and then it disarms. This covers starting with A (or Space)
and holding it into round 1. It sits after device combining, so it works for both devices.

### D5. Polling and edge detection
- **Polling:** each animation frame, the client calls `navigator.getGamepads()` once and keeps the non-null pads as
  snapshots. Simulation ticks run inside the frame (`FixedStepLoop.frame`), so each tick samples the latest snapshot
  with no extra polling.
- **Menu presses:** `MenuInput`, a pure class, takes the snapshots and the current time each frame and returns menu
  actions: `up`, `down`, `left`, `right`, `confirm`, `back`, `start`.
  - A, B and Start fire once when pressed.
  - Directions come from the d-pad or the stick past 0.5. They fire on press, then repeat after 400 ms every
    120 ms while held.
  - Tests drive it with made-up timestamps.
- **Pause during play:** `MenuInput` also reports `start` presses, which toggle pause.

### D6. Menus as rows of existing buttons
- **Rows:** each overlay declares its navigable controls as rows.
  - **Setup:** [AI opponents radio group], [Rounds radio group], [Start].
  - **Result:** [Play again], [Change settings]: two rows, because the buttons are stacked, so up and down move
    between them. (Implementation note: the first draft listed them as one left/right row.)
  - **Pause:** no controls.
- **Moving:** up and down move between rows. Left and right move within a row. In a radio group they change the
  selected value and focus follows the checked button, the usual radio-group behaviour.
- **Buttons:**
  - `confirm` calls `.click()` on the focused element, so the existing click handlers do all the work.
  - `back` on the result screen clicks "Change settings"; on pause it resumes.
  - `start` on setup clicks Start; on pause it resumes.
- **Grace period:** the result screen's existing grace period also applies to `confirm` and `start`.
- **Making the selection visible:** a programmatic `focus()` doesn't reliably trigger `:focus-visible`. So the body
  gets `data-input="gamepad"` while the gamepad is the last device used, and CSS gives `:focus` a strong outline in
  that mode. Keyboard focus styling is unchanged. A mouse move or key press switches the mode back.
- **Alternative considered:** a custom-drawn menu cursor. Rejected: native focus also helps screen readers and keeps
  one source of truth.

### D7. Detection and disconnects
- **Detection:** `gamepadconnected` and `gamepaddisconnected` keep a count of pads. The setup panel shows a status
  line:
  - With no pad: "Have a gamepad? Press any button on it to wake it up."
  - Once one is detected: "Gamepad detected: A selects, Start begins."
- **Disconnects:** if a pad disconnects during a round and the gamepad was the last device used, the game pauses
  through the same path as tab switching.
- **Pause overlay:** it reads "Press Esc or Start to resume".

### D8. The setup screen hint
- **Controls summary:** it gets a gamepad column: left stick or d-pad to drive, A or RT to fire, Start to pause.
- **Hint line:** "Best played with a gamepad." This is the agreed answer to analogue steering's edge over keyboard
  players for now.

## Risks / Trade-offs

- **[Analogue steering gives gamepad players finer aim]** Accepted for single-player and signposted on the setup
  screen. Revisit in the multiplayer change, for example by snapping turns to whole values for fairness, or making
  that a host option.
- **[Pads without the standard layout map buttons differently]** Best-effort mapping. If manual testing finds a common
  pad that misbehaves, add a small fallback table in a later change. The detection line lets players see the pad was
  found even if buttons are off.
- **[Stick drift beyond 0.2]** The dead zone is a named constant, tuned in the playtest.
- **[Secure context and iframes]** Fine on localhost. When deployed, the site must use https, and an embedding iframe
  needs `allow="gamepad"`. Noted in the README.
- **[Browser support]** The Gamepad API is supported in all current major browsers. Nothing breaks without it: if
  `navigator.getGamepads` is missing, the gamepad layer does nothing.
- **[Focus styling may look different to mouse users]** The strong outline only applies in gamepad mode (D6), so
  mouse and keyboard users see today's styling.

## Open Questions

- Exact dead zone, throttle threshold and repeat timings: settled by the playtest. They don't affect structure.
- Whether a response curve, such as squaring the stick value, aims better than the linear rescale: to try during
  the playtest; it changes one function.
