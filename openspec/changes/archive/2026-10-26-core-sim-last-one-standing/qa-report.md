# QA Report: core-sim-last-one-standing

**Verdict:** PASS
**Date:** 2026-10-26

This is a re-run after the fixes for the previous report (B1 AI freeze, B2 validator naming, B3 point-blank ordering,
plus the key-mashing suggestion). All three bugs are fixed, each fix has a test that exercises it, and the B1 fix
holds up well beyond the regression seeds. I re-ran the same 500-seed sweeps that found the freeze, and added a
random-input human and a human hiding in awkward spots. That came to 7,940 rounds, none of which froze, and no tank
ever ended up inside a wall. Nicely done. What remains is non-blocking: two small notes and the browser checks that
only a human can do.

## Build & tests

Everything was run from the repo root on Node v22.13.0 / npm 10.9.2.

| Command | Result |
|---|---|
| `npm install` | OK, 0 vulnerabilities |
| `npm run typecheck` (`tsc -p src/sim --noEmit && tsc -p src/client --noEmit`) | OK, no errors |
| `npm run lint` (`eslint .`) | OK, no errors or warnings |
| `npm run format:check` | OK: all files Prettier-clean |
| `npm test -- --reporter=verbose` (`vitest run`) | OK: 11 files, **105/105 tests passed** (4.7 s) |
| `npm run build` (`vite build` in `@tank/client`) | OK: `dist/` produced (JS 26.15 kB, 10.12 kB gzip) |
| Purity probe: `eslint --stdin --stdin-filename src/sim/src/probe.ts` with `Math.random()`, `Date.now()`, `setTimeout` | All three reported as errors (D2 bans work) |
| `grep` for `window`/`document`/`Date`/`performance`/timers/`Math.random` in `src/sim/src` | None. `src/sim/tsconfig.json` has `lib: ["ES2022"]` only |

I also ran some headless probes against `@tank/sim` from a scratch Vitest config outside the repo (the source tree was
not modified). Each round was capped at 120 s:

| Probe | Rounds | Unfinished | Notes |
|---|---|---|---|
| Idle human, 1/2/3/4 AI, seeds 1–500 | 2,000 | **0** | Previously 7/4/5/0. Longest round 22.0 s, median 3.1–4.7 s |
| AI-only, 2/3/4 AI, seeds 1–500 | 1,500 | **0** | Previously 1 (seed 242, 4 AI) |
| Human with seeded random inputs, 1–4 AI, seeds 1–300 | 1,200 | **0** | No tank overlapped a wall or boundary on any tick |
| Idle human placed in 10 hiding spots (L-corner nooks, behind barriers and the centre block), 1–4 AI, seeds 1–40 | 3,240 run (spots overlapping a tank skipped) | **0** | Longest 23.4 s |
| Instrumented "Lined up but blocked by cover" test | — | — | `blockedTicks` reaches 21 (one re-aim), then it fires at tick 42. The test genuinely drives the new branch |
| In-flight shell kills a tank on the tick it presses fire | — | — | That tank's shot is not fired. See note M1 |

## Tasks

All 44 tasks in `tasks.md` are ticked (`- [x]`), including the new section 9 (QA fixes). None are outstanding.

## Scenario coverage

There are 69 scenarios in total: **62 Verified**, **7 manual-only** (they genuinely need a browser and are listed under
manual checks), **0 Implemented, untested** and **0 Missing / wrong**.

Line references: `world.ts`, `match.ts`, `think.ts` and `validate.ts` are in `src/sim/src/` (`think.ts` is in `ai/`),
and sim tests are in `src/sim/test/`.

### simulation

| Requirement | Scenario | Status | Code | Test |
|---|---|---|---|---|
| Fixed-timestep, input-driven | Ticks advance by a fixed step | Verified | `match.ts:97-99`, `config.ts:96-104` | `foundations.test.ts:110` |
| Fixed-timestep, input-driven | Deterministic replay | Verified | `match.ts:97-130`, `rng.ts` | `determinism.test.ts:22` |
| Environment independence | Runs headless in Node | Verified | `src/sim/tsconfig.json` (no DOM), `eslint.config.js:27-45` | `determinism.test.ts:34` |
| Environment independence | Randomness is seeded | Verified | `match.ts:85-86,173-176`, `rng.ts` | `determinism.test.ts:30`, `foundations.test.ts:25-51`, `arena.test.ts:92` |
| Tank input model | Missing input means idle | Verified | `world.ts:33,55` (`?? IDLE_INPUT`), `match.ts:112-115` | `foundations.test.ts:119` (+ eliminated tanks ignored `:129`) |
| Tank movement | Driving forward | Verified | `world.ts:78-92` | `movement.test.ts:6` |
| Tank movement | Reversing is slower | Verified | `world.ts:83` | `movement.test.ts:16` |
| Tank movement | Turning on the spot | Verified | `world.ts:81` | `movement.test.ts:27` (+ turn and move together `:37`) |
| Tank collisions | Blocked by an obstacle | Verified | `world.ts:90-91,96-110` | `movement.test.ts:49` |
| Tank collisions | Sliding along a wall | Verified | `world.ts:88-91` | `movement.test.ts:62` |
| Tank collisions | Tanks block each other | Verified | `world.ts:103-108` | `movement.test.ts:77` |
| Firing shells | Pressing fire launches a shell | Verified | `world.ts:52-60,112-144` | `combat.test.ts:7` |
| Firing shells | Holding fire does not auto-fire | Verified | `world.ts:56-58` | `combat.test.ts:23` |
| Firing shells | Cooldown limits fire rate | Verified | `world.ts:32,58,132` | `combat.test.ts:33` |
| Shells bounce once | Bounce off a wall | Verified | `world.ts:228-234`, `geometry.ts` sweep | `combat.test.ts:49` (+ boundary `:78`) |
| Shells bounce once | Second contact destroys the shell | Verified | `world.ts:222-225` | `combat.test.ts:66` |
| Shells bounce once | No tunnelling | Verified | `geometry.ts` swept slab test | `combat.test.ts:88`, `foundations.test.ts:83` |
| Shells bounce once | Shells do not collide with each other | Verified | `world.ts:150-237` (no shell-to-shell test) | `combat.test.ts:110` (+ lifetime `:99`) |
| Shell hits and damage | Hitting an opponent | Verified | `world.ts:207-220` | `combat.test.ts:125` |
| Shell hits and damage | No self-hit on launch | Verified | `world.ts:174` | `combat.test.ts:138` |
| Shell hits and damage | Self-hit after a bounce | Verified | `world.ts:174` | `combat.test.ts:147` (+ muzzle in wall `:159`) |
| Elimination | Tank destroyed | Verified | `world.ts:63-75` | `combat.test.ts:172` |
| Elimination | Shells outlive their tank | Verified | `world.ts:38-48` | `combat.test.ts:189` |
| Elimination | Simultaneous elimination | Verified | `world.ts:63-75` | `combat.test.ts:204` |
| Elimination | Point-blank trade | Verified (both tank orders) | `world.ts:50-60` (who fires is decided before any new shell does damage) | `combat.test.ts:220` |
| Elimination | Destroyed tank still stops shells that tick | Verified | `world.ts:63-75` (`alive` only clears in the end-of-tick pass), `:173` | `combat.test.ts:238` |
| Hit points | Full health at round start | Verified | `match.ts:177-187` | `rules.test.ts:62` |

### arena

| Requirement | Scenario | Status | Code | Test |
|---|---|---|---|---|
| Board definition | Board loads from data | Verified | `boards/provingGround.ts`, `match.ts:42-91` | `arena.test.ts:15` |
| Board validity | Built-in board passes validation | Verified | `validate.ts:15-68` | `arena.test.ts:25` |
| Board validity | Sealed spawn is rejected | Verified (B2 fixed: the largest spawn-holding area is treated as the arena, so a sealed spawn 0 is named correctly) | `validate.ts:48-65` | `arena.test.ts:30` (seals spawn 2 and spawn 0) |
| Board validity | Too few obstacles is rejected | Verified | `validate.ts:19-23` | `arena.test.ts:49` (+ spacing `:56`, clearance `:62`) |
| Single built-in board | Same board each round | Verified | `match.ts:71`, `client/src/main.ts:86` | `arena.test.ts:70` |
| Spawn assignment | Distinct spawns | Verified | `match.ts:173-182` | `arena.test.ts:81` |
| Spawn assignment | Spawns vary between rounds | Verified | `match.ts:173-176` | `arena.test.ts:92` |

### ai-opponents

| Requirement | Scenario | Status | Code | Test |
|---|---|---|---|---|
| AI acts only through player inputs | Same rules for everyone | Verified | `match.ts:111-116`, `think.ts:40` | `ai.test.ts:48` |
| Every tank for itself | AI tanks fight each other | Verified | `think.ts:111-138` | `ai.test.ts:69` |
| Target selection | Retarget after elimination | Verified | `think.ts:113-135` | `ai.test.ts:91` (+ `:103`, `:113`) |
| Navigation | Hunting a hidden target | Verified | `think.ts:140-171,202-224`, `nav.ts` | `ai.test.ts:127`, soak `soak.test.ts:49` |
| Navigation | Recovering from being stuck | Verified (now also while advancing on a visible target) | `think.ts:100-102,169,177-199` | `ai.test.ts:141`, `:160` |
| Aiming and firing | Fires when lined up | Verified | `think.ts:69-88` | `ai.test.ts:176` |
| Aiming and firing | Lined up but blocked by cover | Verified (instrumented: the blocked branch runs) | `think.ts:90-98` | `ai.test.ts:185`, `soak.test.ts:10-16` regression seeds |
| Aiming and firing | Holds fire behind cover | Verified | `think.ts:56,73-83` | `ai.test.ts:202` |
| Beatable imperfection | Reaction delay | Verified | `think.ts:57-58,72` | `ai.test.ts:216` |
| Beatable imperfection | AI fires slower than the reload allows | Verified | `think.ts:84-88` | `ai.test.ts:244` |
| Beatable imperfection | Reproducible behaviour | Verified | `match.ts:86`, `think.ts` (only `state.aiRng`) | `ai.test.ts:267`, `determinism.test.ts:22` |

### last-one-standing

| Requirement | Scenario | Status | Code | Test |
|---|---|---|---|---|
| Game options | Valid options accepted | Verified | `match.ts:24-36` | `rules.test.ts:22` |
| Game options | Out-of-range options rejected | Verified | `match.ts:24-36,48-49` | `rules.test.ts:29` |
| Round start | Countdown freezes tanks | Verified | `match.ts:102-108` | `rules.test.ts:47` |
| Round end and scoring | Human wins the round | Verified | `match.ts:133-138,148-164` | `rules.test.ts:75` |
| Round end and scoring | Human eliminated | Verified | `match.ts:136` | `rules.test.ts:84` |
| Round end and scoring | Mutual destruction | Verified | `match.ts:136` | `rules.test.ts:95` (+ rounds played `:126`) |
| Round end and scoring | Shells after round end have no effect | Verified | `match.ts:122-127` (world frozen) | `rules.test.ts:110` |
| Game end | Majority clinches the game | Verified | `match.ts:141-146` | `rules.test.ts:134` |
| Game end | AI clinches the game | Verified | `match.ts:141-146` | `rules.test.ts:144` |
| Game end | Early end despite draws | Verified | `match.ts:141-146` | `rules.test.ts:151` |
| Game end | Drawn game | Verified | `match.ts:141-146` | `rules.test.ts:160` (+ `:167`, `:172`) |
| Rounds are independent | Fresh round | Verified | `match.ts:167-192` | `rules.test.ts:182` |

### game-client

| Requirement | Scenario | Status | Code | Test |
|---|---|---|---|---|
| Setup screen | Starting a game | Manual only (option validation is unit-tested) | `client/src/main.ts:52-66,84-100` | none (DOM wiring) |
| Setup screen | Defaults allow an immediate start | Manual only | `main.ts:20,37` | none |
| Keyboard controls | Both key sets work | Verified | `client/src/input.ts:17-27` | `client/test/input.test.ts:8` |
| Keyboard controls | Keys do not scroll the page | Verified (unit) + manual | `input.ts:41-51`, `main.ts:93` | `input.test.ts:29`, `:39` |
| Arena rendering | Identify your tank | Manual only | `client/src/renderer.ts` | none |
| Arena rendering | Window resize | Manual only | `renderer.ts` resize, `main.ts:70` | none |
| Arena rendering | Elimination is visible | Manual only | `effects.ts`, `renderer.ts:90` (skips dead tanks) | none |
| Heads-up display | Damage shown | Verified (text) + manual | `screens.ts`, `main.ts:175-179` | `client/test/screens.test.ts:50` |
| Round and game flow | Next round starts automatically | Manual only for the display. The sim side is verified (`roundOver` → countdown with no input, `match.ts:122-124`) | `match.ts:122-124`, `screens.ts` | `arena.test.ts:70`, `screens.test.ts:26` |
| Round and game flow | Play again | Manual only | `main.ts:65,84-100` | none |
| Pause | Escape pauses | Verified (loop) + manual (overlay, key wiring) | `loop.ts`, `main.ts:182-186,205-209` | `client/test/loop.test.ts:40` |
| Pause | Switching tabs pauses | Verified (loop) + manual | `main.ts:71-74,200-203` | `loop.test.ts:40` |

## Findings

### Implementation bugs (spec was right, code wasn't)

None outstanding. Here is how the previous findings check out:

- **B1 (AI freezes with its target in view): fixed.** `think.ts:90-98` re-aims every reaction delay while the barrel is
  blocked, and backs off after a stuck window. `:100-102` runs stuck detection while advancing. `:62-68` routes round
  cover when the lane is too narrow for the tank. 0 freezes in 7,940 probe rounds, against 17 in 3,500 before.
- **B2 (validator names the wrong spawn): fixed.** `validate.ts:48-65`. The test now seals spawn 0 and spawn 2.
- **B3 (point-blank shots resolved in array order): fixed.** `world.ts:50-60` decides who fires before any new shell
  does damage. The test runs with both tank orders.
- **Key-mashing past the result screen (task 9.4): fixed in code.** Enter is locked and "Play again" isn't focused
  until 1.8 s after `gameEnded` (`main.ts:24-25,140-149,187-192`). This still needs a manual check.

### Spec gaps (spec wrong or incomplete)

None blocking. The previous S1 and S2 were addressed in the spec ("Destroyed tank still stops shells that tick",
"Lined up but blocked by cover").

### Minor / suggestions (do not block)

- **M1. A tank hit by a shell that was already in flight can't fire on that same tick.** In `world.ts:38-48`, older
  shells move before firing is decided. The firing check at `:58` requires `hp > 0`, so a 1-HP tank that presses fire
  on the exact tick an older shell reaches it doesn't get its shot away (confirmed by probe). This is even-handed:
  there's no tank-order bias, and "the shell got there first" is a fair reading. The Elimination requirement says
  *"every tank that fires in a tick SHALL get its shot away even if another tank's shot in that same tick destroys
  it"*, which could be read either way. Its scenario only covers shots fired in the same tick. One sentence in the
  spec would settle which is intended. I recommend keeping the current behaviour and narrowing the wording to "a shot
  fired in that same tick".
- **M2. Validator tie-break.** If the spawns are split evenly between disconnected areas (for example 2 + 2 + 1), the
  first area found is treated as "the arena", and the others are reported as unreachable. The board is still rejected
  correctly. Only the wording of which spawns are named is arbitrary. This is worth remembering for the board
  generator in change 5, but it's fine for now.
- **"Same rules for everyone"** (`ai.test.ts:48`) still compares HP only while neither tank has been hit. Putting one
  identical shell into each tank would make the "take damage identically" clause meaningful. (Carried over from last
  time.)
- **Snapshot size.** `MatchState` carries `config`, `board` and the nav grid. That's fine now, but the multiplayer
  change will want static data kept out of per-tick snapshots. (Carried over.)
- **HUD placement.** The HUD sits over the top centre of the canvas and may cover the north mid-side barrier in some
  letterboxed layouts. See the manual checks.

## Manual checks for the human

These need a browser (`npm run dev`):

1. **Starting a game:** choose 2 AI and 3 rounds, then press Start. You should see "Round 1 of 3" and three tanks.
2. **Defaults:** press Start without changing anything. You should get 3 AI and 5 rounds.
3. **Identify your tank:** the human tank has a "YOU" marker and pulsing ring, and all five colours are easy to tell
   apart.
4. **Window resize:** resize mid-round to very wide, very tall and small windows. The whole arena should stay visible,
   letterboxed at 3:2 and undistorted. Also check whether the HUD covers any play area.
5. **Elimination is visible:** an explosion appears where the tank was, and the tank disappears.
6. **Damage shown:** the armour pips drop when you're hit.
7. **Keys don't scroll:** Space and the arrow keys don't scroll the page during play.
8. **Next round starts automatically:** the round result banner shows, then the 3-2-1 countdown begins with no input.
9. **Play again / Change settings:** Play again keeps the options and resets the score to 0–0. Change settings returns
   to setup.
10. **Key-mashing at game end (task 9.4):** keep hammering Space, and separately Enter, as the last round ends. The
    result screen should stay up, and a new game should only start on a deliberate press after it appears.
11. **Escape pauses:** everything freezes and the Paused overlay shows until Escape is pressed again.
12. **Switching tabs:** switch tab mid-round, wait, then come back. The game should be paused with no time elapsed.
    Repeat with alt-tab (window blur), and check that no keys are stuck afterwards.
13. **AI liveliness:** hide out of sight against 1–3 AI and confirm that no AI tank sits still facing you without
    firing. The headless probes say it won't, but it's worth seeing in play.

## Manual check results (human developer, 2026-10-26)

All manual checks passed in the browser. Points of note:

- **HUD (check 4):** it stays above the play area, except in a maximised window, where it overlaps slightly without
  getting in the way.
- **Key-mashing at game end (check 10):** after "Play again" appears there is a long enough delay before Enter does
  anything, so the button isn't triggered by accident.
- **AI liveliness (check 13):** across 15 rounds hiding from 3 AI tanks, no tank got stuck.
- **M1** was resolved by narrowing the Elimination wording to "a shot fired in that same tick".
