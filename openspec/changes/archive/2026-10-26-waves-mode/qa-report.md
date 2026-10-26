# QA Report: waves-mode

**Verdict:** PASS
**Date:** 2026-10-26

This is a fresh, independent pass after the previous FAIL. That report's single blocker (S1: the best score is
per starting count, but the spec said "per device") is fixed in the game-client delta spec, which now says "for the
same starting number of AI tanks". Its M1 (ai-opponents wording) is fixed too. Its M5 (no soak of the escalated
waves) is now covered by a committed test. The build is green, all 28 tasks are ticked, and every scenario that can
be checked headlessly is covered by a passing test. The Last One Standing safety net is intact.

## Build & tests

All commands were run from the repository root, on the working tree with the change applied (uncommitted).

| Command | Result |
|---|---|
| `npm run typecheck` | Pass (exit 0, no output) |
| `npm run lint` | Pass (exit 0, no warnings) |
| `npm run format:check` | Pass: "All matched files use Prettier code style!" |
| `npm test` | Pass: 14 files, **207 tests passed**, 30.6 s |
| `npm run build` | Pass: vite build, 29 modules, `dist/assets/index-*.js` 36.42 kB |

- **Tasks:** all 28 tasks in `tasks.md` (sections 1–6) are ticked.
- **Last One Standing regressions:** the diffs to `rules.test.ts`, `arena.test.ts`, `foundations.test.ts`,
  `determinism.test.ts`, `soak.test.ts`, `ai.test.ts`, `screens.test.ts` and `helpers.ts` only add
  `mode: 'lastOneStanding'`, plus new Waves tests and helpers. No Last One Standing assertion, seed, baseline or
  `FROZE_*` list was loosened, which matches D1 and task 1.3.
- **Simulation purity:** a grep of `src/sim/src` for `window`, `document`, `setTimeout`, `setInterval`, `Date.`,
  `Math.random`, `performance`, `localStorage` and `fetch(` found nothing. `localStorage` is used only in
  `client/src/best.ts`.

## Scenario coverage

Paths are relative to `src/`. "Manual" means the scenario can really only be checked by playing it. Those are
listed under *Manual checks* below, and the playtest notes say several of them have already been checked.

| Requirement | Scenario | Status | Code | Test |
|---|---|---|---|---|
| waves: Waves options | Choosing the starting wave size | Verified | `sim/src/rules/waves.ts:85-95`, `sim/src/match.ts:47` | `sim/test/waves.test.ts:170` |
| waves: Waves options | Invalid starting count is rejected | Verified | `sim/src/options.ts:18-22`, `match.ts:29-30` | `sim/test/waves.test.ts:178` |
| waves: Wave start | Full armour every wave | Verified | `rules/waves.ts:81`, `match.ts:128` | `sim/test/waves.test.ts:236` |
| waves: Wave start | Countdown before each wave | Verified | `match.ts:69-75`, `:135-136` | `sim/test/waves.test.ts:246`, `:214` (shells cleared, distinct spawns) |
| waves: Wave size grows | One more tank each wave | Verified | `rules/waves.ts:42-44` (`aiCountFor`) | `sim/test/waves.test.ts:196`, table `:46` |
| waves: Wave size grows | Never more than five tanks | Verified | as above, capped at `AI_COUNT_MAX` | `sim/test/waves.test.ts:105`, `:206` |
| waves: AI armour follows wave size | Bigger waves, thinner armour | Verified | `rules/waves.ts:47-49`, `config.ts` `wavesAiMaxHpByCount` | `sim/test/waves.test.ts:268` |
| waves: AI armour follows wave size | A big start is a thin start | Verified | as above | `sim/test/waves.test.ts:296` |
| waves: Escalation | Armour comes first | Verified | `rules/waves.ts:52-73` (`escalationSchedule`) | `sim/test/waves.test.ts:301`, tables `:46-85` |
| waves: Escalation | Armour recovers to normal | Verified | `rules/waves.ts:22`, `:56-57` | `sim/test/waves.test.ts:154` |
| waves: Escalation | Damage rises until one hit is lethal | Verified | `rules/waves.ts:60-65` | `sim/test/waves.test.ts:123`, tables |
| waves: Escalation | Shell speed is capped | Verified | `rules/waves.ts:26`, `:67-71` | `sim/test/waves.test.ts:113` |
| waves: Escalation | The human never escalates | Verified | `rules/waves.ts:80-81`, `sim/src/tank.ts:26-30` | `sim/test/waves.test.ts:314` |
| waves: AI tanks are allies | AI tanks don't fight each other | Verified | `sim/src/ai/think.ts:123`, `:145-150` (`isEnemy`) | `sim/test/ai.test.ts:298`, co-op switch `:311` |
| waves: AI tanks are allies | Holding fire for an ally | Verified | `ai/think.ts:74-81`, `:156-168` (`allyInLane`) | `sim/test/ai.test.ts:332` |
| waves: AI tanks are allies | Accidents still happen | Verified | `sim/src/world.ts:193-218` (no ally filter on hits) | `sim/test/ai.test.ts:370` (direct and bounced) |
| waves: Wave end | Clearing a wave | Verified | `rules/waves.ts:97-113`, `match.ts:86-100` | `sim/test/waves.test.ts:332` |
| waves: Wave end | Game over | Verified | `rules/waves.ts:99`, `:109-112` | `sim/test/waves.test.ts:350` |
| waves: Wave end | Going down together | Verified | `rules/waves.ts:103-113` (D7 order) | `sim/test/waves.test.ts:362` |
| waves: Wave end | Hoisted by your own shell | Verified | as above | `sim/test/waves.test.ts:379` |
| waves: Waves score | Score at game over | Verified | `rules/waves.ts:109-112` | `sim/test/waves.test.ts:393` |
| simulation: Firing shells | Pressing fire launches a shell | Verified (unchanged) | `world.ts` `fire` | `sim/test/combat.test.ts:7` |
| simulation: Firing shells | Holding fire does not auto-fire | Verified (unchanged) | as above | `sim/test/combat.test.ts:23` |
| simulation: Firing shells | Cooldown limits fire rate | Verified (unchanged) | as above | `sim/test/combat.test.ts:33` |
| simulation: Firing shells | Shells carry their tank's speed and damage | Verified | `world.ts:44`, `:136-139`, `:219-226` | `sim/test/combat.test.ts:255` |
| simulation: Hit points | Full health at round start | Verified | `match.ts:128` | `sim/test/rules.test.ts:63` |
| simulation: Hit points | Defaults are equal | Verified | `rules/lastOneStanding.ts:13`, `tank.ts` | `sim/test/combat.test.ts:277` |
| ai-opponents: AI acts only through player inputs | Same rules for everyone | Verified | `match.ts:78-83` (AI goes through `think`) | `sim/test/ai.test.ts:48` |
| ai-opponents: Every tank for itself | AI tanks fight each other | Verified | `ai/think.ts:145-150` | `sim/test/ai.test.ts:69` |
| ai-opponents: Target selection | Retarget after elimination | Verified | `ai/think.ts:113-139` | `sim/test/ai.test.ts:91` |
| ai-opponents: Aiming and firing | Fires when lined up | Verified (unchanged) | `ai/think.ts:56-105` | `sim/test/ai.test.ts:176` |
| ai-opponents: Aiming and firing | Lined up but blocked by cover | Verified (unchanged) | `ai/think.ts:94-100` | `sim/test/ai.test.ts:185` |
| ai-opponents: Aiming and firing | Holds fire behind cover | Verified (unchanged) | as above | `sim/test/ai.test.ts:202` |
| ai-opponents: Aiming and firing | An ally in the way doesn't freeze the AI | Verified | `ai/think.ts:81`, `:94-97` (`blockedTicks` → `startRecovery`) | `sim/test/ai.test.ts:344`; Waves soak `sim/test/soak.test.ts:64`, `:81` |
| game-client: Setup screen | Starting a game | Manual (unchanged) | `client/src/main.ts:380-383` | — |
| game-client: Setup screen | Defaults allow an immediate start | Manual | `client/src/main.ts:32` | — |
| game-client: Setup screen | Controls for both devices | Manual (unchanged) | `client/index.html` | — |
| game-client: Setup screen | Starting a Waves game | Manual (the sim half is verified by `sim/test/waves.test.ts:170`) | `client/src/main.ts:380-383` | — |
| game-client: Setup screen | Options follow the mode | Manual | `client/src/main.ts:386-391`, `:433-437`; `index.html` `data-mode` | — |
| game-client: Setup screen | Menus with the keyboard | Verified (key mapping) + Manual (focus behaviour) | `client/src/input.ts` `menuActionForKey`, `main.ts:279-284` | `client/test/input.test.ts:125-135` |
| game-client: Heads-up display | Damage shown | Verified | `client/src/screens.ts:115-120` (`hpPips`, uses `maxHp`) | `client/test/screens.test.ts:50` |
| game-client: Heads-up display | Wave shown | Verified | `screens.ts:123-132` | `client/test/waves-screens.test.ts:41` |
| game-client: Round and game flow screens | Next round starts automatically | Verified (unchanged) | `match.ts:98-100` | `sim/test/rules.test.ts:183`, `client/test/screens.test.ts:26` |
| game-client: Round and game flow screens | Play again | Manual (the developer confirmed it in the playtest notes) | `client/src/main.ts:110`, `:141-144` | — |
| game-client: Round and game flow screens | Escalation is announced | Verified | `screens.ts:37-43`, `:61-63` | `client/test/waves-screens.test.ts:90`, `:98` |
| game-client: Round and game flow screens | Thinner armour is announced | Verified | as above; `rules/waves.ts:29-31` | `client/test/waves-screens.test.ts:63`, `:79` |
| game-client: Round and game flow screens | Best on this device | Verified | `client/src/best.ts:35-52` (per starting count) | `client/test/waves-screens.test.ts:145` |
| game-client: Round and game flow screens | Best survives storage being unavailable | Verified | `best.ts:23-29`, `:49-51` | `client/test/waves-screens.test.ts:165` |

**Totals (48 scenarios):**
- Verified: 42 (one of them, "Menus with the keyboard", also has a manual check for its focus behaviour)
- Implemented, untested: 0
- Missing / wrong: 0
- Manual only: 6. These are DOM and setup-screen flows with no DOM test harness in the project.

Task 4.4 is also covered: a tank added at a wave start is drawn at its spawn
(`client/test/waves-screens.test.ts:175`, `client/src/renderer.ts` `tankPose`).

## Architectural rules (CLAUDE.md)

- **The simulation stays pure.** The new `options.ts`, `tank.ts` and `rules/*` are plain functions over plain data.
  `ModeRules` is looked up by `state.options.mode` (`rules/index.ts:18-20`) rather than stored in state, so
  `MatchState` still survives a JSON round trip. The "Runs headless in Node" test still passes.
- **Fixed timestep, input-driven and deterministic.** The new Waves determinism test (`determinism.test.ts:42`)
  passes. `isEnemy` and `allyInLane` use no randomness, so the Last One Standing AI's random-number sequence is
  unchanged. The Last One Standing soak and determinism tests pass unchanged.
- **The client/sim split holds.** Storage sits behind `StorageLike` in `best.ts`, and the text functions in
  `screens.ts` stay pure and take the best score as an argument.

## Findings

### Implementation bugs (spec was right, code wasn't)

None found.

### Spec gaps (spec wrong or incomplete)

None blocking. The previous S1 (best score per device vs per starting count) is resolved in the game-client delta
spec.

### Minor / suggestions (do not block)

- **m1. D5 still says Last One Standing "never calls these checks".** `allyInLane` runs in every mode
  (`ai/think.ts:81`). In Last One Standing it always returns false, because `isEnemy` is always true there, and it
  uses no randomness, so neither behaviour nor determinism changes. Softening the sentence in design.md before
  archiving would keep the record accurate.
- **m2. Faster shells fly further.** `shellLifetime` is fixed in seconds, so at 2× speed an AI shell's range doubles
  (about 2160 units instead of 1080). Shells die on their second contact, so this doesn't matter on Proving Ground.
  It becomes a balance lever if larger boards arrive (board-variety change), so a note in `config.ts` might help.
- **m3. Wave 1's `waveStarted` is never delivered.** `createMatch` calls `startRound(state, [])` (`match.ts:56`),
  which drops the event, as it already did for round 1's `roundStarted`. The client copes, because `start()` resets
  `waveChanges` and wave 1 never has changes. When the server starts broadcasting events in the multiplayer change,
  clients may expect it.
- **m4. "Going down together" reads a little oddly on the result screen.** It shows "Destroyed on wave 3" with
  "3 waves cleared". That's correct, but a quip for that case ("Took the last one with you!") would celebrate it.
  Purely cosmetic, and a chance for some fun.
- **m5. "Best: 0".** A first game that clears nothing stores 0 and shows "Best: 0". That's accurate but a bit
  deflating. Leaving the best line out when the best is 0 might read more kindly.
- **m6. The ally-in-lane reach is generous.** It is `SHOT_LANE + tankRadius` (26 units), while a shell actually hits
  within `tankRadius` (18). So an AI sometimes holds fire when its shot would really have cleared the ally. That
  errs on the safe side and suits co-operation, so it's just something to keep in mind when tuning difficulty.

## Manual checks for the human

The playtest notes report a full Waves game from setup to "Play again", and "Play again" keeping the mode and
options in both modes. Please also confirm these, if they weren't already covered:

1. **Defaults allow an immediate start.** Load the page and press Start without touching anything. You should get
   Last One Standing with 3 AI tanks over 5 rounds.
2. **Starting a Waves game.** Choose Waves, set Starting AI tanks to 2 and press Start. Wave 1 should begin with
   you and 2 AI tanks, and the banner should read "Wave 1".
3. **Options follow the mode, with each input device.**
   - Switch modes with the mouse, then with the arrow keys or A/D on the Mode row, then with the gamepad d-pad.
   - Each time, only that mode's option rows should show, and up/down (and Tab) should skip the hidden rows.
   - Switching away and back should keep your earlier choices.
4. **Menus with the keyboard.** On the setup and result screens:
   - The arrow keys and W/A/S/D move focus, and the page doesn't scroll.
   - Enter and Space select.
   - Tab still works.
   - Keys are ignored during the short lock after the result screen appears.
5. **Controls for both devices.** The setup screen still lists the keyboard and gamepad controls, plus the "best
   played with a gamepad" note.
6. **Best score in the browser.**
   - Finish two Waves games with the same starting count. The second should say "New best!" only if it beat the
     first.
   - Then block site data (or use a strict private window). The result screen should leave the best line out, with
     no errors in the console.
7. **Play again in both modes** keeps the mode and options and resets the score or waves cleared. The playtest
   notes say this was confirmed, so this one is just a re-check.
