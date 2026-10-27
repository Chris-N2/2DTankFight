## 1. Simulation types, config and options

- [x] 1.1 Add the mortar config values from design §8 to `SimConfig`/`DEFAULT_CONFIG`, with doc comments. Verify with a
      test that `mortarMinRange > mortarSplashRadius + 2 * tankRadius` holds for the defaults.
- [x] 1.2 Extend the types:
      - `TankInput.mortar` (and `IDLE_INPUT`);
      - `TankState` fields `mortars`, `mortarCharge`, `mortarHeld`, `slowTicks`;
      - `MortarState`, plus `MatchState.mortarShells` and `nextMortarId`;
      - the `mortarLaunched` and `mortarLanded` events;
      - `mortars: boolean` on both `MatchOptions` variants.

      Verify that `npm run build` type-checks.
- [x] 1.3 Make `validateOptions` reject a non-boolean `mortars` setting. Update the test helpers and existing tests to
      pass `mortars: false`. Verify that the whole existing suite passes unchanged: the classic regression check.

## 2. Mortar mechanics in the world tick

- [x] 2.1 Add the exported helpers `mortarRange(config, chargeTicks)` and `mortarLanding(state, tank, chargeTicks)`,
      the latter clamping into the arena. Verify with unit tests for a tap, half and over-full charges, and
      clamping at the boundary.
- [x] 2.2 Implement charging and launching in `stepWorld`, following the tick order in design §4:
      - a charge starts on a press only when a mortar is loaded;
      - launch happens on release;
      - an eliminated tank's charge is dropped;
      - the `mortarPlantWhileCharging` switch is honoured.

      Verify with tests for the "Charging and launching" and "One mortar per round or wave" scenarios, including
      moving while charging and being destroyed mid-charge.
- [x] 2.3 Implement flight and landing: a fixed flight time, no collisions, mortars outlive their tank, and the
      splash uses body overlap with walls ignored. Verify with tests for the "Mortar flight" scenarios and
      `mortarLanded.slowedIds`.
- [x] 2.4 Implement the slow: it applies to forward and reverse driving, a repeat catch restarts the duration
      without stacking, and turning and firing are unaffected. Verify with tests for the "Splash slows tanks"
      scenarios and the simulation "Slowed driving" scenario, including self-splash and no damage.
- [x] 2.5 Verify that mortars-off games never launch or slow anything, even with the mortar input held, using the
      "Classic play" scenario test.

## 3. Mode rules

- [x] 3.1 In the shared round and wave start, clear `mortarShells` and reset each tank's charge, held flag and slow.
      Verify with the "Fresh start each round" scenario test.
- [x] 3.2 Arm the tanks:
      - `lastOneStanding.setUp` gives every tank one mortar when mortars are on;
      - `waves.setUp` gives humans only one.

      Verify with tests for "Everyone is armed", "Refilled each round", "Unused mortars don't stack", "Mortar
      refilled each wave", "Only humans have mortars", and the countdown ignoring the mortar input.

## 4. AI mortar use

- [x] 4.1 Add `hiddenTicks` and `lob` to `AiMemory`, and implement the lob state in `think` as in design §9. Use seeded
      range and aim error, finish a committed lob, and refuse to lob below the minimum range. Verify with tests for
      "Flushing out a hider", "Turret first", "Patience", and "No mortars, no lobbing".
- [x] 4.2 Extend the determinism and soak tests to run with mortars on, including Last One Standing with 4 AI. Verify
      that "Reproducible lobs" holds and that the soak completes rounds without stalls.

## 5. Client input

- [x] 5.1 Map `ShiftLeft`/`ShiftRight` to `mortar` and add them to `GAME_KEYS`. Map LB/RB to `mortar` on the gamepad
      and remove their "reserved" comments. OR `mortar` in `combineInputs`. Verify with input and gamepad unit tests
      for both Shift keys, LB and RB, and combining devices.
- [x] 5.2 Generalise `FireLatch` so it latches fire and mortar independently. Verify with a test that a mortar button
      held at game start does nothing until it is re-pressed.

## 6. Client screens, HUD and bests

- [x] 6.1 Add a Mortars On/Off row to both modes on the setup screen, defaulting to On. Make it reachable by keyboard,
      mouse and gamepad, pass it into `MatchOptions`, and keep it for "play again". Add the mortar to the controls
      summary. Verify with screens tests for the defaults, classic play and play-again.
- [x] 6.2 Show the mortar's loaded or used state in the HUD, and hide it when mortars are off. Verify with a test or
      manual check of "Mortar readiness shown".
- [x] 6.3 Change `bestKey`/`recordBest` to take the mortars setting. Mortars off keeps the legacy key, and on appends
      `.mortars`. Verify with best tests for separate bests per setting and for earlier bests counting as classic.

## 7. Client rendering and effects

- [x] 7.1 Draw the human's landing reticle while charging, using the sim's `mortarLanding`. Verify manually that it
      tracks the charge and heading.
- [x] 7.2 Draw mortars in flight: an interpolated ground position, an arc height and scale, a ground shadow and a
      landing marker. Verify manually that the shell clears walls visually and lands on the marker.
- [x] 7.3 Add the splash effect on `mortarLanded`, and a bogged-down look for tanks with `slowTicks > 0`. Verify
      manually, including on a self-splash.

## 8. Docs and wrap-up

- [x] 8.1 Update CLAUDE.md's Combat, Waves and Last One Standing sections to the new mortar design:
      - 1 per round or wave;
      - slows rather than damages;
      - the firer is affected;
      - humans only in Waves;
      - an on/off option, on by default.

      Verify by reading it back against the proposal.
- [x] 8.2 Run `npm run build` and the full test suite, then play a few rounds of each mode with mortars on and off.
      Note any tuning observations in this change's folder. Suggest `/qa` before `/opsx:archive`. At archive,
      refresh the `waves` spec's Purpose line.
