## 1. Simulation: analogue turn input

- [x] 1.1 Widen `TankInput.turn` to a number and clean it in the world step (non-finite → 0, clamp to [−1, 1]); verify the "Partial turn", "Out-of-range turn is clamped" and "Invalid turn is ignored" scenario tests, and that the existing movement, determinism and soak tests still pass unchanged

## 2. Gamepad input (pure, unit-tested)

- [x] 2.1 Add a `GamepadSnapshot` type and `inputFromGamepad` (standard layout, round dead zone with rescale, throttle threshold, d-pad, A/RT fire) in a new client gamepad module; verify unit tests for the "Analogue steering", "Stick dead zone" and "Fire with A or the trigger" scenarios, plus d-pad and LB/RB having no effect
- [x] 2.2 Add `combineInputs` for keyboard plus any number of pads (stronger turn/throttle wins, equal opposites cancel, fire is OR); verify the "Keyboard and gamepad together" scenario test and the equal-opposites case
- [x] 2.3 Add `FireLatch` (armed at game start, holds fire off until released); verify the "Starting a game does not fire" scenario test for both A and Space
- [x] 2.4 Add `MenuInput` (press edges for A/B/Start, directions from d-pad or stick with 400 ms delay and 120 ms repeat); verify unit tests with made-up timestamps covering single presses, held repeat and the stick threshold

## 3. Client wiring

- [x] 3.1 Poll `navigator.getGamepads()` once per animation frame, doing nothing if the API is missing; combine keyboard and gamepad input and apply the fire latch in `Game.tick()`; verify by typecheck and a manual drive with a gamepad
- [x] 3.2 Make Start toggle pause during play and resume from pause, along with B; update the pause overlay text to "Press Esc or Start to resume"; verify the "Start pauses" scenario manually
- [x] 3.3 Track gamepad connect/disconnect and the last device used; pause on disconnect mid-round when the gamepad was in use; verify the "Gamepad disconnect pauses" scenario manually by unplugging (or switching off) the pad
- [x] 3.4 Implement menu rows for the setup and result screens (up/down between rows, left/right within a row or across radio values, A clicks, B back, Start starts), with the result-screen grace period applied to A and Start; verify the "Choosing options with the d-pad", "Back from the result screen" and "Result screen grace period" scenarios manually
- [x] 3.5 Add gamepad focus styling (`data-input="gamepad"` on the body, strong `:focus` outline), switching back on mouse or keyboard use; verify the "Selection is visible" scenario manually, and that mouse and keyboard styling is unchanged

## 4. Setup screen and docs

- [x] 4.1 Add the gamepad status line (invitation, then "Gamepad detected…"), gamepad controls in the controls summary, and the "Best played with a gamepad." hint; verify the "Gamepad appears after a press" and "Controls for both devices" scenarios manually
- [x] 4.2 Update README controls with gamepad mappings and a note on https and `allow="gamepad"` for deployment; verify the README renders correctly

## 5. Wrap-up

- [x] 5.1 Run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` and `npm run build`; verify all pass with no warnings
- [x] 5.2 Playtest with a real gamepad (full game with menus only, no keyboard) and note impressions and any tuning of dead zone, thresholds or repeat timings in `playtest-notes.md`; verify a whole game, from setup to "Play again", can be played on the gamepad alone
