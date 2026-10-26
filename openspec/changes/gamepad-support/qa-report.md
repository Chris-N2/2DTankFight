# QA Report: gamepad-support

**Verdict:** PASS
**Date:** 2026-10-26

## Build & tests

All commands were run from the repository root (`D:\Applications\NDD\Games\2DTankFight`) on the working tree, which
has the change uncommitted.

| Command | Result |
|---|---|
| `npm install` | OK, 0 vulnerabilities |
| `npm run typecheck` (`tsc -p src/sim --noEmit && tsc -p src/client --noEmit`) | Exit 0, no errors |
| `npm run lint` (`eslint .`) | Exit 0, no warnings |
| `npm run format:check` (`prettier --check .`) | "All matched files use Prettier code style!" |
| `npm test` (`vitest run`) | 12 files, **124 tests passed**, 0 failed |
| `npm run build` (Vite) | Built OK: `dist/index.html` 3.42 kB, CSS 3.13 kB, JS 30.14 kB |

All 13 tasks in `tasks.md` are ticked. `playtest-notes.md` exists, so task 5.2 has evidence behind it.

## Scenario coverage

Totals: 24 scenarios. **14 Verified**, **10 Manual only** (DOM or browser wiring, listed under manual checks),
**0 Implemented, untested**, **0 Missing / wrong**.

The client has no DOM test environment. As in the previous change's QA, scenarios that depend only on DOM wiring
are classed as "Manual only". The pure logic underneath them (`MenuInput`, `FireLatch`, `combineInputs`) has unit
tests.

| Requirement | Scenario | Status | Code | Test |
|---|---|---|---|---|
| Gamepad controls | Analogue steering | Verified | `client/src/gamepad.ts:62-69` (dead zone rescale); sim `world.ts:81` | `client/test/gamepad.test.ts:28`; `sim/test/movement.test.ts:38` (partial turn is slower) |
| Gamepad controls | Stick dead zone | Verified | `gamepad.ts:51-55` (round dead zone), `:64` | `gamepad.test.ts:40`, `:50-55` (sideways wobble while driving) |
| Gamepad controls | Fire with A or the trigger | Verified | `gamepad.ts:78`; cooldown is the sim's (`world.ts:56-57,141`) | `gamepad.test.ts:58` |
| Gamepad controls | Keyboard and gamepad together | Verified | `input.ts:63-84`; wired in `main.ts:137` | `client/test/input.test.ts:71`, `:77` |
| Gamepad controls | Starting a game does not fire | Verified (unit) + manual (wiring) | `input.ts:90-102`; armed in `main.ts:114`, applied `main.ts:138` | `input.test.ts:97` (A and Space), `:116` |
| Gamepad menu navigation | Choosing options with the d-pad | Manual only | `main.ts:231-283` (rows, radio select on left/right, confirm clicks) | Direction and press edges: `gamepad.test.ts:106`, `:120`, `:133` |
| Gamepad menu navigation | Selection is visible | Manual only | `main.ts:182-183,286-288`; `styles.css:207-210` | none (CSS) |
| Gamepad menu navigation | Back from the result screen | Manual only | `main.ts:276-278` | none (DOM) |
| Gamepad menu navigation | Result screen grace period | Manual only | `main.ts:162,239` (same `enterLockedUntil` as the keyboard) | Edge detection, so a held A never re-fires: `gamepad.test.ts:106` |
| Gamepad detection | Gamepad appears after a press | Manual only | `main.ts:83-87,290-299`; `index.html` `#pad-status` | none (browser event) |
| Setup screen | Starting a game | Manual only (unchanged by this change) | `main.ts:60-72,104-121` | none (DOM) |
| Setup screen | Defaults allow an immediate start | Manual only (unchanged) | `main.ts:21` | none |
| Setup screen | Controls for both devices | Manual only (static markup, checked by reading the HTML) | `client/index.html` controls table and "Best played with a gamepad." hint | none |
| Pause | Escape pauses | Verified (loop) + manual (unchanged) | `main.ts:212-216,306-310` | `client/test/loop.test.ts` (paused loop doesn't advance) |
| Pause | Switching tabs pauses | Verified (loop) + manual (unchanged) | `main.ts:90-93,301-304` | `loop.test.ts` |
| Pause | Start pauses | Manual only (Start/B edges are unit-tested) | `main.ts:232-235`; overlay text `index.html` `#pause` | `gamepad.test.ts:106` (B and Start act once per press) |
| Pause | Gamepad disconnect pauses | Manual only | `main.ts:84-87,182-185`, `:78` (keyboard clears "in use") | none (browser event) |
| Tank input model | Missing input means idle | Verified | `types.ts:36` (`IDLE_INPUT`) | `sim/test/foundations.test.ts:119` |
| Tank input model | Out-of-range turn is clamped | Verified | `sim/src/world.ts:100-103` | `movement.test.ts:47` (2.5 vs 1, and −7 vs −1) |
| Tank input model | Invalid turn is ignored | Verified | `world.ts:101` | `movement.test.ts:57` (NaN, ±Infinity, and a determinism check on a clone) |
| Tank movement | Driving forward | Verified | `world.ts:83-92` | `movement.test.ts:7` |
| Tank movement | Reversing is slower | Verified | `world.ts:83` | `movement.test.ts:17` |
| Tank movement | Turning on the spot | Verified | `world.ts:81` | `movement.test.ts:28` |
| Tank movement | Partial turn | Verified | `world.ts:81` | `movement.test.ts:38` |

### Architecture (CLAUDE.md)

- **Simulation stays pure.** The only sim changes are the wider `turn` type (`types.ts:24-34`) and `cleanTurn`
  (`world.ts:96-103`). Neither adds DOM, timers, rendering or networking. The cleaning happens in the sim rather
  than the client, so the future multiplayer server is protected against bad inputs too, as D1 intends.
- **AI and keyboard unaffected.** The AI still emits −1, 0 or 1 (`ai/think.ts:46,50,198`). The determinism
  (`determinism.test.ts`) and soak (`soak.test.ts`) suites pass unchanged.
- **Browser access stays thin.** `navigator.getGamepads()` is called only in `main.ts:342-349`, which guards against
  the API being missing or throwing. All mapping logic in `gamepad.ts` is pure and runs in Node.

## Findings

### Implementation bugs (spec was right, code wasn't)

None found.

### Spec gaps (spec wrong or incomplete)

None of real consequence. Two small gaps, neither blocking:

1. **Combining three or more devices depends on order.** `combineInputs` folds two inputs at a time
   (`input.ts:63-84`), and equal opposites cancel to 0 at each step. With keyboard right (1), pad 1 full left (−1)
   and pad 2 at 0.5, the result is 0.5. Feed the same inputs in a different order (0.5, 1, −1) and the result is 0.
   This only happens with two pads plus the keyboard all pulling different ways, which is unlikely in single-player.
   Worth settling, though, if multi-pad input matters in the multiplayer change. "Strongest absolute value overall;
   ties between opposites cancel" would be order-independent.
2. **Which disconnect should pause?** The spec says "a gamepad that was in use". The code pauses when *any* pad
   disconnects while `gamepadInUse` is set (`main.ts:84-87`), and that flag is cleared only by a game key on the
   keyboard (`main.ts:78`), not by starting a new game. With one pad this is exactly what the spec says. With two
   pads, unplugging the idle one also pauses. That's harmless, and arguably the safer choice.

### Minor / suggestions (do not block)

1. **Comment and behaviour differ when nothing is focused** (`main.ts:247-252`). The comment says "the first press
   just shows where you are". That's true for A and B, but a direction press also moves. For example, after a mouse
   click leaves nothing focused on setup, pressing up focuses Start and then moves straight to the Rounds row. Either
   behaviour is fine; the comment and code should agree.
2. **The result-screen rows differ from design D6.** D6 lists the result screen as one row,
   `[Play again, Change settings]`, for left and right. The code uses two rows for up and down (`main.ts:244`). That
   suits the vertically stacked buttons (`styles.css:197-201`) better. Consider updating `design.md` so the record
   matches what was built.
3. **Menu row navigation could be unit-tested.** `onMenuAction` (`main.ts:231-283`) is the largest piece of new
   logic without a test, because it reads `document.activeElement` directly. It could become a pure function
   (rows of ids, focused id, action → new focus or click target) with a thin DOM wrapper, in the spirit of D2's
   "only a thin layer touches the DOM". The playtest covered the main flow, so this is a suggestion, not a blocker.
4. **Holding fire through a later countdown fires at "Go"** (applies to the keyboard too; not new in this change).
   `startRound` resets `fireHeld` (`match.ts:185`), and the world only steps during `playing`. So a fire button held
   through the countdown of round 2 or later fires on the first tick of play. The spec only covers game start, and
   the playtest notes say the latch is deliberately not re-armed between rounds. Noting it in case anyone finds the
   free opening shot surprising. It's equally available to everyone.
5. **"Firing felt delayed" from the playtest.** I found no delay path either. The latch disarms on the first tick
   where fire isn't held (`input.ts:98-102`) and is armed only in `start()`. The reload explanation in the playtest
   notes is consistent with the code.

## Manual checks for the human

The playtest (see `playtest-notes.md`) already covered driving, steering, A/RT/d-pad/Start mapping, menu repeat
speed, and whole games from setup to "Play again" on the gamepad alone. These scenarios were not explicitly called
out there and are worth a quick check:

1. **Choosing options with the d-pad:** on setup, press up twice to reach AI opponents, press right once, press down
   twice to Start, then press A. The game should have one more AI tank than before.
2. **Selection is visible:** move round setup with the d-pad. The focused button should have a thick accent outline.
   Then move the mouse or press a key: the outline should go back to the usual keyboard and mouse styling.
3. **Back from the result screen:** finish a game, wait for the result screen, then press B. The setup screen
   should appear with Start focused.
4. **Result screen grace period:** keep tapping A as the final round ends. The result screen should stay up, and
   only a press after about 0.6 s should act on it.
5. **Gamepad appears after a press:** reload with the pad connected but untouched. The setup screen should show
   "Have a gamepad? Press any button on it to wake it up." Press a button: it should change to "Gamepad detected: A
   selects, Start begins."
6. **Start pauses:** mid-round, press Start. The game should pause with the overlay reading "Press Esc or Start to
   resume". Start resumes it; pause again and check that B resumes it too.
7. **Gamepad disconnect pauses:** drive with the pad mid-round, then unplug it or switch it off. The game should
   pause.
8. **Controls for both devices:** the setup screen should show the Keyboard/Gamepad controls table and "Best played
   with a gamepad."
9. **Starting a game does not fire:** start with A and keep holding it. No shell should appear until you release A
   and press it again.
