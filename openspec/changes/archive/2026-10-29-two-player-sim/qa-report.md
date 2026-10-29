# QA Report: two-player-sim

**Verdict:** PASS
**Date:** 2026-10-29

This is the second QA run. The first run passed with six non-blocking findings (M1–M6). Since then, M1 (a Waves game
both humans had left didn't end until play resumed) and M4 (test gaps) have been fixed. M2, M3, M5 and M6 were left
as they are on purpose; the reasons are noted below. Nothing in the specs or design changed.

## Build & tests

All run from the repository root on Node v22.13.0, after the fixes.

| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 (sim, client, client tests) |
| `npm run lint` | exit 0, no findings |
| `npm run format:check` | exit 0, all files formatted |
| `npm test` | exit 0: 23 test files, **457 tests passed** (454 before, plus 3 new) |
| `npm run build` | exit 0 |

Extra checks I ran myself (scratchpad only; nothing in the repo was changed):

- **Old vs new, single-player** (first run). I stepped the code from `HEAD` (c92c89b) side by side with the new code
  over 210 single-player games: 7 boards × 3 seeds × 5 option sets × 2 HP configs, up to 12,000 ticks each. Every
  tick's events and the final state were identical, once the new score shape was mapped back to the old one. The M1
  fix only changes `waves.left`, which `leave` never reaches in single-player (`leave` returns early when
  `options.humans < 2`). So the comparison still holds without re-running it.
- **Edge probes**, re-run against the fixed code, all as the spec says:
  - LOS: leaving during the countdown is a forfeit win with 0 rounds played. A human who was already eliminated can
    leave mid-round, and the other wins by forfeit.
  - Waves: the host (`p1`) leaves and `p2` plays on for several waves, with the right colours.
  - Friendly fire on: both humans die in the same tick with AI alive → game over.
  - The last human and the last AI die in the same tick → the wave counts as cleared, then the game ends.
  - Calling `leave` twice: the second call does nothing.
  - **Both humans leave, in the countdown or in the pause between waves → `gameEnded` (`over`) is emitted by the
    second `leave` and the phase is `gameOver` at once.** Before the fix this took 181+ ticks.

## Scenario coverage

66 scenarios: 66 Verified, 0 Implemented-untested, 0 Missing/wrong.

Test paths are relative to `src/sim/test/` unless shown otherwise. Code paths are relative to `src/sim/src/`.

### simulation

| Requirement | Scenario | Status | Code | Test |
|---|---|---|---|---|
| One or two human players | Two humans, two sets of controls | Verified | match.ts:41,64; match.ts step (inputs by id) | twoPlayer.test.ts:72 |
| One or two human players | Single-player is unchanged | Verified | match.ts:41; tank.ts:9 | determinism.test.ts:27,35,44; golden.test.ts (spawns unchanged); my 210-game old-vs-new check |
| One or two human players | Too many tanks rejected | Verified | options.ts:16,46 | twoPlayer.test.ts:91 |
| Leaving a match | A clean exit | Verified | match.ts:135 | twoPlayer.test.ts:111 (play); :371 and :534 (countdown); :359 and :546 (pause) |
| Leaving a match | Too late to leave | Verified | match.ts:135 (gameOver guard) | twoPlayer.test.ts:126; :534 (leave after a forfeit) |
| Shell hits and damage | Hitting an opponent | Verified | world.ts moveShell | combat.test.ts:125 |
| Shell hits and damage | No self-hit on launch | Verified | world.ts moveShell | combat.test.ts:138 |
| Shell hits and damage | Self-hit after a bounce | Verified | world.ts moveShell | combat.test.ts:147 |
| Shell hits and damage | Friendly fire off (bounced or not) | Verified | world.ts:178,249; options.ts:102 | twoPlayer.test.ts:157, :167 |
| Shell hits and damage | Friendly fire on | Verified | options.ts:102 | twoPlayer.test.ts:176 |
| Shell hits and damage | Still hoisted by your own shell | Verified | world.ts:178 | twoPlayer.test.ts:183 (AI shells still hurt: :191) |

### last-one-standing

| Requirement | Scenario | Status | Code | Test |
|---|---|---|---|---|
| Forfeit | Winning by forfeit | Verified | rules/lastOneStanding.ts:64 | twoPlayer.test.ts:514 |
| Forfeit | Leaving between rounds | Verified | rules/lastOneStanding.ts:64; match.ts:135 | twoPlayer.test.ts:546 (countdown too: :534) |
| Game options | Valid options accepted | Verified | options.ts:46 | rules.test.ts:34 |
| Game options | Out-of-range options rejected | Verified | options.ts:46 | rules.test.ts:49 |
| Game options | Two humans, at most three AI | Verified | options.ts:16,46 | twoPlayer.test.ts:409 |
| Round end and scoring | Human wins the round | Verified | rules/lastOneStanding.ts:98 | rules.test.ts:106 |
| Round end and scoring | Human eliminated | Verified | rules/lastOneStanding.ts:84 | rules.test.ts:118 |
| Round end and scoring | Mutual destruction | Verified | rules/lastOneStanding.ts:84–96 | rules.test.ts:129 |
| Round end and scoring | Shells after round end have no effect | Verified | match.ts step | rules.test.ts:144 |
| Round end and scoring | One human down, play on | Verified | rules/lastOneStanding.ts:84 | twoPlayer.test.ts:415 |
| Round end and scoring | Last human standing | Verified | rules/lastOneStanding.ts:98 | twoPlayer.test.ts:421 |
| Round end and scoring | The AI wins a two-player round | Verified | rules/lastOneStanding.ts:84 | twoPlayer.test.ts:437 |
| Round end and scoring | Sharing the point | Verified | rules/lastOneStanding.ts:95 | twoPlayer.test.ts:446 (all out together: :454) |
| Round end and scoring | Going out with the last AI | Verified | rules/lastOneStanding.ts:96 | twoPlayer.test.ts:460 |
| Game end | Majority clinches the game | Verified | rules/lastOneStanding.ts:102 | rules.test.ts:168 |
| Game end | AI clinches the game | Verified | rules/lastOneStanding.ts:102 | rules.test.ts:181 |
| Game end | Early end despite draws | Verified | rules/lastOneStanding.ts:102 | rules.test.ts:188 |
| Game end | Drawn game | Verified | rules/lastOneStanding.ts:102 | rules.test.ts:197 |
| Game end | Out of reach | Verified | rules/lastOneStanding.ts:102 | twoPlayer.test.ts:469 |
| Game end | AI rounds still count | Verified | rules/lastOneStanding.ts:102 | twoPlayer.test.ts:481 |
| Game end | The AI's rounds are only for show | Verified | rules/lastOneStanding.ts:102 | twoPlayer.test.ts:503 |
| Game end | Level after the last round | Verified | rules/lastOneStanding.ts:102 | twoPlayer.test.ts:493 |

### waves

| Requirement | Scenario | Status | Code | Test |
|---|---|---|---|---|
| Respawn at the next wave | Back for the next wave | Verified | rules/waves.ts:104; match.ts startRound | twoPlayer.test.ts:286 |
| Respawn at the next wave | Sitting it out | Verified | rules/waves.ts:125; match.ts step (dead tanks get no input) | twoPlayer.test.ts:299 (rewritten; see M4) |
| A human leaves | Carrying on alone | Verified | rules/waves.ts:140 | twoPlayer.test.ts:337 (countdown: :371) |
| A human leaves | Nobody left to carry on | Verified | rules/waves.ts:140 | twoPlayer.test.ts:350 (both leave: :381) |
| A human leaves | A cleared wave still earns the respawn | Verified | rules/waves.ts:140 | twoPlayer.test.ts:359 |
| A human leaves | No reinforcements for the AI | Verified | rules/waves.ts:102 | twoPlayer.test.ts:398 |
| Waves options | Choosing the starting wave size | Verified | options.ts:46 | waves.test.ts:173 |
| Waves options | Invalid starting count is rejected | Verified | options.ts:46 | waves.test.ts:181; twoPlayer.test.ts:91 |
| Waves options | A long game outlasts its sequence | Verified | map rotation (unchanged) | maps.test.ts:141 |
| Waves options | Friendly fire is off unless chosen | Verified | options.ts:102 | twoPlayer.test.ts:157 |
| Wave start | Full armour every wave | Verified | rules/waves.ts:104 | waves.test.ts:239 |
| Wave start | Countdown before each wave | Verified | match.ts step | waves.test.ts:249 |
| Wave start | Mortar refilled each wave | Verified | rules/waves.ts:106 | mortars.test.ts:451 |
| Wave start | Only humans have mortars | Verified | rules/waves.ts:113 | mortars.test.ts:463 |
| Wave start | Both humans armed | Verified | rules/waves.ts:104–106 | twoPlayer.test.ts:262 |
| Wave size grows | One more tank each wave | Verified | rules/waves.ts:23 | waves.test.ts:199 |
| Wave size grows | Never more than five tanks | Verified | rules/waves.ts:23 | waves.test.ts:108, :209 |
| Wave size grows | Two humans, three AI at most | Verified | rules/waves.ts:23,102 | twoPlayer.test.ts:237 |
| Escalation | Armour comes first | Verified | rules/waves.ts:23 | waves.test.ts:304 |
| Escalation | Armour recovers to normal | Verified | rules/waves.ts:23 | waves.test.ts:157 |
| Escalation | Damage rises until one hit is lethal | Verified | rules/waves.ts:23 | waves.test.ts:126 |
| Escalation | Shell speed is capped | Verified | rules/waves.ts:23 | waves.test.ts:116 |
| Escalation | The human never escalates | Verified | rules/waves.ts:104 | waves.test.ts:317 |
| Escalation | Two-player escalation starts at three | Verified | rules/waves.ts:23 | twoPlayer.test.ts:248 |
| Wave end | Clearing a wave | Verified | rules/waves.ts:125,131 | waves.test.ts:335 |
| Wave end | Game over | Verified | rules/waves.ts:125 | waves.test.ts:353 |
| Wave end | Going down together | Verified | rules/waves.ts:131 | waves.test.ts:365 |
| Wave end | Hoisted by your own shell | Verified | rules/waves.ts:125 | waves.test.ts:382 |
| Wave end | One down is not game over | Verified | rules/waves.ts:125 | twoPlayer.test.ts:271 |
| Wave end | Both down is game over | Verified | rules/waves.ts:125 | twoPlayer.test.ts:278 |

### game-client

| Requirement | Scenario | Status | Code | Test |
|---|---|---|---|---|
| AI colours with two humans | No blue AI in a two-player match | Verified | tank.ts:9,12; client colours.ts:4 (index 2 is blue) | twoPlayer.test.ts:209 |
| AI colours with two humans | Single-player colours unchanged | Verified | tank.ts:9 | twoPlayer.test.ts:220 |
| AI colours with two humans | Colours stay put across waves | Verified | rules/waves.ts:113 | twoPlayer.test.ts:225 |

### Tasks

All 19 tasks in `tasks.md` are ticked.

### Architectural rules (CLAUDE.md)

- **The simulation stays pure.** `leave`, `ModeRules.left` and the friendly-fire check work only on match state:
  no DOM, timers, rendering or networking. `leave` is documented as a between-ticks call.
- **Client and server share the code.** The same code runs for single-player and for the future server.
- **Determinism is tested for two players.** There's a two-player determinism test (determinism.test.ts:57), two
  two-player golden runs, and a two-player soak on every board.
- **The client only adapts to the new types.** It still plays single-player only, as intended.

## Findings

### Implementation bugs (spec was right, code wasn't)

None.

- **M1 (fixed).** If both humans left a Waves game during the countdown or the pause between waves, the game used to
  stay open until play resumed.
  - The fix: `waves.left` (rules/waves.ts:140) now ends the game whenever no human tank remains, whatever the phase.
    It still ends the game when the phase is `playing` and the human who stays isn't alive.
  - The test: twoPlayer.test.ts:381 covers both leaving in the countdown and in the pause.
  - My probe confirms `gameEnded` comes from the second `leave` and the phase is `gameOver` at once.
  - The *A cleared wave still earns the respawn* path is unchanged: one human leaves in the pause, the other is
    still in the match, and play carries on (:359).

### Spec gaps (spec wrong or incomplete)

None.

### Minor / suggestions (do not block)

- **M2 (left as is).** The golden fingerprints were re-recorded. My 210-game old-vs-new comparison is the evidence that
  single-player play didn't change. The developer accepts that as the proof.
- **M3 (left as is).** The Purpose paragraphs in the main specs were edited before archive. The developer says
  archive applies only the delta specs, and the Purposes aren't in them, so there's no risk of applying them twice.
- **M4 (fixed).**
  - *Sitting it out* (twoPlayer.test.ts:299) now proves its point. It runs 600 ticks with `p2` and `ai1` kept
    unkillable while the destroyed `p1` presses throttle, turn and fire. It asserts:
    - the phase stays `playing` on every tick;
    - `p1`'s position and heading don't move;
    - `p1` fires no `shotFired` (I checked the event name is real, so this filter isn't vacuous);
    - `p1` is back for wave 2.
  - New tests cover leaving during the countdown, in Waves (:371) and in LOS (:534, including a second `leave`
    afterwards changing nothing).
- **M5 / M6 (belong to the networking change).** The client doesn't handle `friendlyHit` yet, and two-player Waves
  balance still needs playtesting. Please carry both onto that change's task list.

## Manual checks for the human

The developer has done the single-player smoke test: the score line, round banners and result screens in both modes,
with no problems reported. Nothing else needs playing: this change adds no new UI.
