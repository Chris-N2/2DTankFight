# QA Report: mortars

**Verdict:** PASS
**Date:** 2026-10-27 (re-run after fixes)

This is a re-check of the earlier FAIL. Its one blocking finding was that an AI could retarget mid-lob onto a tank it
could simply shoot. That is now fixed, and a regression test covers it. An independent probe over 100 seeds confirms
the fix. The build and every test pass. The remaining notes are minor and don't block archiving.

## Build & tests

All commands were run from the repository root (`D:\Applications\NDD\Games\2DTankFight`).

| Command | Result |
|---|---|
| `npm run typecheck` (`tsc -p src/sim --noEmit && tsc -p src/client --noEmit`) | Pass (exit 0) |
| `npm run lint` (`eslint .`) | Pass (exit 0, no findings) |
| `npm test` (`vitest run`) | Pass: 15 files, **263 tests** (up from 261), 30.8 s |
| `npm run build` | Pass: 42.32 kB JS (15.60 kB gzip) |
| `npm run format:check` | Pass |

### Independent probe (scratchpad only, not part of the suite)

**Setup:** Last One Standing with 4 AI and mortars on, the human idle and unkillable, seeds 1–100, up to 90 s each.
Every AI press and launch was checked against the AI's own `hasClearLane(…, SHOT_LANE)`, using positions from
*before* the tick (what the AI actually saw when it decided).

| Measure | Before the fix | After the fix |
|---|---|---|
| AI launches | 49 | 45 |
| Mortar button pressed while the lob's target had a clear turret lane | not measured | **0** |
| Lob target changed between press and launch | 23 | **0** |
| Launched at a target with a clear turret lane | 18 | **0** |
| Launched at an already-destroyed target | not measured | 0 |
| AI slowed by its own mortar | 0 | 0 |
| Lobs called off before pressing (target became visible or was destroyed; mortar kept) | none (no call-off rule existed) | 4 |
| Longest lob, from commit to release | not measured | 71 ticks (about 1.2 s), so lobs stay bounded |
| Landed further from the target than splash reach | 23 | 6 |

The 6 lobs that still land wide are expected. The target was free to drive away during the flight, and the lob
includes the seeded range and aim error. The spec only promises a slow "if the target does not move", and
*Flushing out a hider* tests exactly that.

## Scenario coverage

| Requirement | Scenario | Status | Code | Test |
|---|---|---|---|---|
| mortars: Mortars option | Classic play | Verified | `src/sim/src/mortar.ts:86`; `rules/lastOneStanding.ts:16`; `rules/waves.ts:95` | `src/sim/test/mortars.test.ts` "Classic play" |
| mortars: Mortars option | Invalid setting rejected | Verified | `src/sim/src/options.ts:10` | `mortars.test.ts` "Invalid setting rejected" |
| mortars: One mortar per round or wave | Refilled each round | Verified | `rules/lastOneStanding.ts:16` | `mortars.test.ts` "Refilled each round" |
| mortars: One mortar per round or wave | Unused mortars don't stack | Verified | `rules/lastOneStanding.ts:16` | `mortars.test.ts` "Unused mortars don't stack" |
| mortars: One mortar per round or wave | One shot only | Verified | `mortar.ts:86,107` | `mortars.test.ts` "One shot only" |
| mortars: Charging and launching | A tap is the minimum range | Verified | `mortar.ts:16-20,82-88` | `mortars.test.ts` "A tap is the minimum range" |
| mortars: Charging and launching | Range grows with the hold | Verified | `mortar.ts:16-20` (timing now documented in design §4) | `mortars.test.ts` "Range grows with the hold" |
| mortars: Charging and launching | Full charge is capped | Verified | `mortar.ts:18` | `mortars.test.ts` "Full charge is capped" |
| mortars: Charging and launching | Aiming near a wall | Verified | `mortar.ts:26-37` | `mortars.test.ts` "Aiming near a wall" |
| mortars: Charging and launching | Moving while charging | Verified | `world.ts:84-104` | `mortars.test.ts` "Moving while charging" and the plant-while-charging switch test |
| mortars: Charging and launching | Destroyed mid-charge | Verified | `mortar.ts:84-85`; `world.ts:72` | `mortars.test.ts` "Destroyed mid-charge" and "Released in the tick it is destroyed" |
| mortars: Mortar flight | Over the wall | Verified | `mortar.ts:43-69` | `mortars.test.ts` "Over the wall" |
| mortars: Mortar flight | Flight time doesn't depend on range | Verified | `mortar.ts:95` | `mortars.test.ts` "Flight time doesn't depend on range" |
| mortars: Mortar flight | Outlives its tank | Verified | `mortar.ts:47` | `mortars.test.ts` "Outlives its tank" |
| mortars: Splash slows tanks | Bogged down | Verified | `mortar.ts:53-57`; `world.ts:90-95` | `mortars.test.ts` "Bogged down" |
| mortars: Splash slows tanks | No damage | Verified | `mortar.ts:43-69` | `mortars.test.ts` "No damage" |
| mortars: Splash slows tanks | Turning and firing unaffected | Verified | `world.ts:87,90` | `mortars.test.ts` "Turning and firing unaffected" |
| mortars: Splash slows tanks | Caught in your own splash | Verified | `mortar.ts:53` | `mortars.test.ts` "Caught in your own splash" |
| mortars: Splash slows tanks | Walls don't shield | Verified | `mortar.ts:54` | `mortars.test.ts` "Walls don't shield" |
| mortars: Splash slows tanks | Out of range | Verified | `mortar.ts:45,54` | `mortars.test.ts` "Out of range" |
| mortars: Splash slows tanks | A second splash restarts the slow | Verified | `mortar.ts:56` | `mortars.test.ts` "A second splash restarts the slow" |
| mortars: Splash slows tanks | Fresh start each round | Verified | `match.ts:118,135-137` | `mortars.test.ts` "Fresh start each round" |
| simulation: Tank input model | Missing input means idle | Verified | `types.ts` `IDLE_INPUT`; `mortar.ts:78` | `foundations.test.ts` "Missing input means idle"; `mortars.test.ts` "missing input is idle, mortar included" |
| simulation: Tank input model | Out-of-range turn is clamped; Invalid turn is ignored | Verified (unchanged) | `world.ts:112-115` | existing `foundations.test.ts` |
| simulation: Tank movement | Driving forward; Reversing is slower; Turning on the spot; Partial turn | Verified (unchanged) | `world.ts:84-104` | existing classic suite |
| simulation: Tank movement | Slowed driving | Verified | `world.ts:90-95` | `mortars.test.ts` "Bogged down" and "Slowed driving (reverse too)" |
| last-one-standing: Game options | Valid options accepted | Verified | `options.ts`; `rules/lastOneStanding.ts` | `rules.test.ts:26`; `mortars.test.ts` "Everyone is armed" (4 AI, mortars on) |
| last-one-standing: Game options | Out-of-range options rejected | Verified | `options.ts` | `rules.test.ts:37` |
| last-one-standing: Round start | Countdown freezes tanks | Verified | `match.ts` (`stepWorld` only runs during play) | `rules.test.ts:56`; `mortars.test.ts` "Countdown freezes tanks, mortar included" |
| last-one-standing: Round start | Everyone is armed | Verified | `rules/lastOneStanding.ts:13-17` | `mortars.test.ts` "Everyone is armed" |
| waves: Waves options | Choosing the starting wave size; Invalid starting count is rejected | Verified | `options.ts`; `rules/waves.ts` | `waves.test.ts:178` and existing tests |
| waves: Wave start | Full armour every wave; Countdown before each wave | Verified (unchanged) | `rules/waves.ts`; `match.ts` | `waves.test.ts:246` and existing tests |
| waves: Wave start | Mortar refilled each wave | Verified | `rules/waves.ts:93-96` | `mortars.test.ts` "Mortar refilled each wave" |
| waves: Wave start | Only humans have mortars | Verified | `rules/waves.ts:93-99`; `tank.ts` | `mortars.test.ts` "Only humans have mortars" |
| ai-opponents: AI acts only through player inputs | Same rules for everyone | Verified | `match.ts:83`; `ai/think.ts` | `ai.test.ts:48`; `mortars.test.ts` "Same rules for everyone" |
| ai-opponents: Mortar use | Flushing out a hider | Verified | `ai/think.ts:133-145,165-188` | `mortars.test.ts:507` |
| ai-opponents: Mortar use | Turret first | **Verified** (fixed) | `ai/think.ts:55-66` (the lob keeps its own target and is called off before the press if that target is visible); `:153` `shouldLob` | `mortars.test.ts:533` (1v1); `mortars.test.ts:555` (4 AI, 30 seeds, regression); probe above |
| ai-opponents: Mortar use | Patience | Verified | `ai/think.ts:153` `shouldLob` | `mortars.test.ts:518` |
| ai-opponents: Mortar use | No mortars, no lobbing | Verified | `ai/think.ts` `shouldLob` | `mortars.test.ts:546`; "Only humans have mortars" |
| ai-opponents: Mortar use | Reproducible lobs | Verified | `aiRng` only | `mortars.test.ts:598`; `determinism.test.ts` "Deterministic replay with mortars" |
| game-client: Setup screen | Starting a game; Starting a Waves game | Verified (unchanged) | `main.ts:148-151`; `screens.ts` `matchOptionsFor` | existing `screens.test.ts` |
| game-client: Setup screen | Defaults allow an immediate start | Verified | `screens.ts` `DEFAULT_CHOICES` | `screens.test.ts` "Defaults allow an immediate start, with mortars on" |
| game-client: Setup screen | Controls for both devices | Implemented; manual check | `index.html` Mortar row | none (static HTML) |
| game-client: Setup screen | Options follow the mode (the Mortars row) | Implemented; manual check | `index.html` `#opt-mortars`; `main.ts:108-114` | none (DOM) |
| game-client: Setup screen | Classic play | Verified | `screens.ts` `mortarHud`; `main.ts:273-275` | `screens.test.ts` "Classic play" |
| game-client: Setup screen | Menus with the keyboard | Verified (unchanged) | `input.ts` | existing tests |
| game-client: Keyboard controls | Either Shift fires the mortar | Verified | `input.ts:29-30` | `input.test.ts:21` |
| game-client: Keyboard controls | Keys do not scroll the page | Verified | `input.ts:15-16` | existing tests |
| game-client: Gamepad controls | Mortar with LB or RB | Verified | `gamepad.ts:80` | `gamepad.test.ts:82` |
| game-client: Gamepad controls | Keyboard and gamepad together | Verified | `input.ts` `combineInputs` | `input.test.ts:120` |
| game-client: Gamepad controls | A held mortar button waits for a fresh press | Verified | `input.ts` `FireLatch` | `input.test.ts:130,149` |
| game-client: Gamepad controls | Analogue steering; Stick dead zone; Fire with A or the trigger; Starting a game does not fire | Verified (unchanged) | `gamepad.ts`; `input.ts` | existing tests |
| game-client: Arena rendering | Aiming the mortar | Implemented; manual check (the developer's playtest confirms it) | `renderer.ts` `drawReticle`, which uses the sim's `mortarLanding` | the shared helper is tested in `mortars.test.ts` "the reticle point matches where the mortar lands" |
| game-client: Arena rendering | Mortar in flight | Implemented; the arc maths is tested, the drawing is a manual check | `renderer.ts` `mortarPose`, `drawMortar`, `drawLandingMarker` | `screens.test.ts` "Mortar in flight…" |
| game-client: Arena rendering | Slowed tanks are obvious | Implemented; manual check (the developer's playtest confirms it) | `renderer.ts` `drawMud` | none (canvas) |
| game-client: Heads-up display | Mortar readiness shown | Verified | `screens.ts` `mortarHud` | `screens.test.ts:107` |
| game-client: Round and game flow | Play again | Verified at the options level; the button wiring is a manual check | `main.ts:151` (`start()` reads the persisted `this.choices`) | `screens.test.ts:96` "Play again keeps the mortars setting" |
| game-client: Round and game flow | Bests are kept per mortars setting | Verified | `best.ts` `bestKey`; `main.ts:213-218` | `waves-screens.test.ts:163` |
| game-client: Round and game flow | Earlier bests are classic bests | Verified | `best.ts` `bestKey` | `waves-screens.test.ts:171` |
| game-client: Round and game flow | Best on this device; Best survives storage being unavailable; other flow scenarios | Verified (unchanged) | `best.ts` | existing `waves-screens.test.ts` |

**Status counts:**

| Status | Count |
|---|---|
| Verified | 54 (including "Turret first", now fixed) |
| Implemented, only verifiable by looking or playing | 5 |
| Missing / wrong | 0 |

The 5 manual-check scenarios are the controls table, the Mortars-row navigation, the reticle, the mud look and the
in-flight drawing. The developer's playtest notes already cover the visual ones.

**Tasks:** all 23 tasks in `tasks.md` are ticked.

**Architecture checks:**
- **The simulation stays pure.** There is no DOM, timer or networking code in `mortar.ts`, `world.ts` or
  `ai/think.ts`.
- **State is plain data.** The JSON round-trip and `cloneState` tests pass with the new `lob.targetId`, `x` and `y`
  fields.
- **Randomness is seeded.** All AI randomness still comes from `aiRng`, and the determinism tests pass with mortars
  on.
- **Classic play is unchanged.** With mortars off, the unchanged classic suite still passes.
- **Test-only exports.** `hasClearLane` and `SHOT_LANE` are now exported from `ai/think.ts` for tests. They are not
  added to the package's public `index.ts`, which is fine.

## Findings

### Implementation bugs (spec was right, code wasn't)

None outstanding.

**Previously blocking, now fixed:** an AI could swing a committed lob onto a new, visible target.
- The fix (`ai/think.ts:55-66`):
  - `AiMemory.lob` now carries its own `targetId` and the target's last known position.
  - The lob check runs before the "no target" early return.
  - Before the button is pressed, the lob is called off (and the mortar kept) if its target is destroyed or comes
    into a clear lane.
  - Once charging, the lob is finished at the target's last known position.
- This matches the spec's "turret first" and "complete a committed lob" rules. The regression test at
  `mortars.test.ts:555` and the probe above both confirm it.

### Spec gaps (spec wrong or incomplete)

None.

### Minor / suggestions (do not block)

1. **A small timing difference in the regression test.** The test at `mortars.test.ts:555` checks lane visibility
   using positions from *after* the press tick, while the AI decided on positions from *before* it. Tanks move
   only a few units in one tick, so this is very unlikely to cause a false result, and my probe used the
   before-the-tick positions and found 0 violations. Using the earlier positions would make the test exact, if
   anyone touches it again.
2. **A tank eliminated in the same tick can still be listed as slowed.** `mortarLanded.slowedIds` can include such a
   tank. This is harmless, and was deliberately left alone. Worth remembering when multiplayer starts consuming
   events.
3. **The "Play again" test now plays a real game first.** It shows the options survive a played game, but it still
   doesn't exercise the DOM wiring in `main.ts`. That wiring is listed as a manual check below.
4. **Design notes are updated.** `design.md` now documents the tap timing (§4), the exception where a lob aimed past
   the arena edge can land next to the firer (§8), and the lob keeping its own target with its call-off rules (§9).
   This resolves the earlier documentation notes.

## Manual checks for the human

The developer's playtest (`playtest-notes.md`) already covers the visuals and the hidden HUD cell. Remaining quick
checks:

- [ ] In Last One Standing with 3–4 AI: AI lobs come only from tanks you're hiding from, never from one with a clear
      shot at you. A tank that stops to aim a lob and then sees you should switch to its turret.
- [ ] Setup screen: the Mortars row can be reached and changed with the mouse, the keyboard (arrows/WASD + Enter) and
      the gamepad d-pad, in **both** modes. The controls table lists Shift and LB/RB.
- [ ] Play a game with Mortars off, then choose **Play again**. The new game still has mortars off (no HUD mortar
      cell). Repeat with Mortars on.
- [ ] Reticle: it grows outwards as you hold Shift, swings with your heading, and stops at the arena edge.
