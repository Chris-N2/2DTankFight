## 1. Groundwork (no behaviour change)

- [x] 1.1 Change `MatchOptions` to the tagged union with `mode` (D1) and update every Last One Standing call site in sim tests, client and helpers; verify typecheck passes and the full existing test suite is green
- [x] 1.2 Add per-tank `maxHp`, `shellDamage` and `shellSpeed`, and per-shell `damage`; make `fire()` and `moveShell` use them, with Last One Standing setting config defaults (D3); verify the "Shells carry their tank's speed and damage" and "Defaults are equal" scenario tests, and that determinism and soak tests pass unchanged
- [x] 1.3 Move Last One Standing rules behind the `ModeRules` interface in `rules/lastOneStanding.ts`, with `match.ts` keeping only the shared phase machine (D2); verify all existing rules, determinism and soak tests pass with no edits beyond 1.1

## 2. Waves rules

- [x] 2.1 Add the Waves balance values to `config.ts` and the pure `waveSetup(config, startAiCount, wave)` (D4); verify a table-driven test of the D4 example (start 1), plus a start of 3, covering the "One more tank each wave", "Never more than five tanks", "Armour comes first", "Damage rises until one hit is lethal", "Shell speed is capped" and "The human never escalates" scenarios
- [x] 2.2 Validate Waves options (start count 1–4); verify the "Invalid starting count is rejected" and "Choosing the starting wave size" scenario tests
- [x] 2.3 Implement `rules/waves.ts`: rebuild AI tanks per wave (D6), set combat values from `waveSetup`, heal the human, emit `waveStarted` with `changes`; verify the "Full armour every wave" and "Countdown before each wave" scenario tests
- [x] 2.4 Implement the end-of-wave rules, `waveCleared` and `gameEnded { result: 'over', wavesCleared }` (D7); verify the "Clearing a wave", "Game over", "Going down together", "Hoisted by your own shell" and "Score at game over" scenario tests

## 3. AI allies

- [x] 3.1 Add `isEnemy` and filter target selection by mode, with the `wavesAiCooperate` switch (D5); verify the "AI tanks don't fight each other" scenario test, the existing "AI tanks fight each other" test still passing for Last One Standing, and a test that `wavesAiCooperate: false` restores infighting in Waves
- [x] 3.2 Add the ally-in-lane check to firing in Waves, routed through the blocked-barrel recovery; verify the "Holding fire for an ally", "An ally in the way doesn't freeze the AI" and "Accidents still happen" scenario tests
- [x] 3.3 Add a Waves soak test (idle human, starting counts 1–4, a range of seeds; every game ends, no tank inside a wall) and a Waves determinism test; verify both pass, and that Last One Standing soak and determinism results are unchanged

## 4. Client

- [x] 4.1 Add the mode row and per-mode option groups to the setup screen (Waves: starting AI tanks, default 1), building gamepad menu rows from the visible groups (D8); verify the "Starting a Waves game", "Options follow the mode" and "Defaults allow an immediate start" scenarios manually, with mouse, keyboard and gamepad
- [x] 4.2 Add Waves HUD, countdown and breather banners and result-screen text as pure functions in `screens.ts`; verify unit tests for the "Wave shown" and "Escalation is announced" scenarios and the result text
- [x] 4.3 Store and show the best waves cleared per starting count in `localStorage`, wrapped so it fails safely; verify unit tests for the "Best on this device" and "Best survives storage being unavailable" scenarios using a fake storage
- [x] 4.4 Confirm newly added AI tanks at a wave start draw at their spawn without interpolating from elsewhere (D6); verify with a renderer snapshot test or a manual check
- [x] 4.5 Make "Play again" keep the mode and options; verify the "Play again" scenario manually in both modes
- [x] 4.6 Map the arrow keys and W/A/S/D to the d-pad's menu actions on the setup and result screens (D8); verify a unit test of the key mapping and the "Menus with the keyboard" scenario manually, and update the README's controls table

## 5. Wrap-up

- [x] 5.1 Update README ("Currently playable" and a short Waves description); verify it renders correctly
- [x] 5.2 Run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` and `npm run build`; verify all pass with no warnings
- [x] 5.3 Run the headless difficulty measurement (D9: idle human and a scripted hider, co-operation on and off) and record the results in `playtest-notes.md`; verify the file contains the numbers
- [x] 5.4 Playtest Waves (several games, including at least one reaching the escalation waves) and note impressions, especially whether co-operating AI is too hard, in `playtest-notes.md`; verify a full Waves game is playable from setup to "Play again"

## 6. Revision after the first playtest: AI armour by wave size

- [x] 6.1 Replace `wavesArmourSteps` with `wavesAiMaxHpByCount: [3, 2, 1, 1]` and make `waveSetup` derive AI armour from the wave size, with armour steps rebuilding it to `tankMaxHp` (D4); verify updated table tests for starts of 1, 3 and 4, and the "Bigger waves, thinner armour", "A big start is a thin start", "Armour comes first" and "Armour recovers to normal" scenario tests
- [x] 6.2 Add the `'thinnerArmour'` change and its "More tanks, thinner armour" banner text; verify the "Thinner armour is announced" scenario test and that wave 1 never announces it
- [x] 6.3 Rerun the D9 measurement with the new curve and record it alongside the original numbers in `playtest-notes.md`; verify the file contains both sets
- [x] 6.4 Run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` and `npm run build`; verify all pass with no warnings
