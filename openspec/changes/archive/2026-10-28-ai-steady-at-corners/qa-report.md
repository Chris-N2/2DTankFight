# QA Report: ai-steady-at-corners

**Verdict:** PASS
**Date:** 2026-10-28

This is a re-check after the first QA run, which failed on one point: the watchdog's lob exception wasn't tested (I-1).
That now has a test, and so does the hold-aim behaviour (M-1). The source in `src/sim/src` hasn't changed since the
first run; I compared `think.ts` byte for byte with the copy I tested. Every fix in this change now has at least one
test that fails when the fix is taken out.

## Build & tests

All run from the repo root on the working tree.

| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0 |
| `npm test` | exit 0: 22 files, **387 tests passed** |
| `npm run build` | exit 0 |
| `openspec validate ai-steady-at-corners --strict` (PowerShell, first run) | valid |

**Tasks:** all 10 tasks in `tasks.md` are ticked.

**Harness figures** (instrumented copy of `aiSteadiness.test.ts`). They match design.md *Results*:

| Run | Spans | Dance rate | Longest stall |
|---|---|---|---|
| Ricochet Alley, Waves | 2310 | 0.91% | 4.82 s |
| Frustration, Waves | 1534 | 0.52% | 5.68 s |
| Ricochet Alley, Last One Standing | 2784 | 0.18% | 1.77 s |

**Mutation checks.** I made each change to a scratch copy of `src/sim`, never the repo, and re-ran the tests to see
which ones fail:

| Fix removed | Tests that fail |
|---|---|
| A. Progress watchdog | 21: both Waves `aiSteadiness` runs, golden, and most soak tests |
| B. Lob exemption in `makingProgress` | **now** *A long lob is seen through* (it failed none at the first run) |
| C. Hysteresis | *Steady at a corner*, both Waves `aiSteadiness` runs, golden |
| D. Aim re-roll while blocked put back | **now** *Lined up but blocked by cover* (before, only `aiSteadiness` and golden) |
| E. Target grace | *Sticks with a target that ducks out of sight* |
| F. Old 1e6 hidden penalty | *A distant tank in view doesn't pull it off a nearby hunt*, golden |
| G. Avoid zone in engage | both Waves `aiSteadiness` runs, golden |
| H. Navigation reversal guard | both Waves `aiSteadiness` runs, golden |
| I. Wait on arrival | Frustration `aiSteadiness`, golden |
| J. Sticky goal | Frustration `aiSteadiness`, golden |

I re-ran B and D on this re-check, with the updated tests copied in. Rows A and C to J are from the first run; those
tests haven't changed since, apart from the line shifts in `ai.test.ts`.

## Scenario coverage

| Requirement | Scenario | Status | Code | Test |
|---|---|---|---|---|
| Target selection | Retarget after elimination | Verified | `src/sim/src/ai/think.ts:276-307` | `src/sim/test/ai.test.ts:102` |
| Target selection | Sticks with a target that ducks out of sight | Verified | `think.ts:296`, `think.ts:218` | `ai.test.ts:136` |
| Target selection | A distant tank in view doesn't pull it off a nearby hunt | Verified | `think.ts:289` | `ai.test.ts:152` |
| Navigation | Hunting a hidden target | Verified | `think.ts:338-376`, `think.ts:419-444` | `ai.test.ts:164` |
| Navigation | Recovering from being stuck | Verified | `think.ts:382-392`, `think.ts:398-413` | `ai.test.ts:178`, `ai.test.ts:197` |
| Navigation | Blocked by an ally | Verified | `think.ts:96`, `think.ts:104-114`, `think.ts:203-205` | `ai.test.ts:514`; `src/sim/test/aiSteadiness.test.ts:123` |
| Aiming and firing | Fires when lined up | Verified | `think.ts:191-198` | `ai.test.ts:213` |
| Aiming and firing | Lined up but blocked by cover | Verified | `think.ts:200-208` | `ai.test.ts:222` (fails under mutation D) |
| Aiming and firing | Holds fire behind cover | Verified | `think.ts:183-193` | `ai.test.ts:254` |
| Aiming and firing | An ally in the way doesn't freeze the AI | Verified | `think.ts:190`, `think.ts:203-205` | `ai.test.ts:405`, `ai.test.ts:384` |
| Decisive movement | Steady at a corner | Verified | `think.ts:149-177`, `think.ts:48-58` | `ai.test.ts:485` |
| Decisive movement | Always making progress | Verified | `think.ts:96`, `think.ts:104-114`; `config.ts:97`, `config.ts:155` | `aiSteadiness.test.ts:123` and soak tests (mutation A); `src/sim/test/mortars.test.ts:505` for the lob exception (mutation B) |
| Decisive movement | Corner dance stays rare | Verified | whole change | `aiSteadiness.test.ts:123`, `aiSteadiness.test.ts:130` |

Totals: **13 Verified**, 0 Implemented, untested, 0 Missing / wrong.

The other *Decisive movement* rule (no more accurate, faster-reacting or quicker-firing AI) is still covered by the
reaction-delay test (`ai.test.ts:268`), the aim-error bound (`ai.test.ts:280`) and the fire-gap test
(`ai.test.ts:296`), all passing.

**Architecture (CLAUDE.md):** the simulation is still pure. There's no DOM, no timers, no `Math.random` or `Date`, and
all AI randomness comes from `state.aiRng`. AI memory is rebuilt at every round or wave start (`match.ts:130`,
`match.ts:150`). There are no client changes.

## Findings

### Implementation bugs (spec was right, code wasn't)

None outstanding.

- **I-1 (fixed).** *A long lob is seen through* (`mortars.test.ts:505`) uses the worst case: the AI faces directly
  away and needs a full charge. It checks three things: the AI doesn't back off mid-lob, the launch comes after
  `aiProgressWindow`, and the shell lands within 60 of the target. With `mem.lob ||` removed, the test fails. With the
  real code, it passes.

### Spec gaps (spec wrong or incomplete)

None blocking.

### Minor / suggestions (do not block)

- **M-1 (fixed).** *Lined up but blocked by cover* now works out the turn sign with `angleDiff`. It also asserts that
  `aimOffset` doesn't change between blocked ticks, so it catches the old periodic re-roll.
- **S-1 (open, needs the human developer).** *Steady at a corner* says "in any one-second span". The test checks
  one-second blocks that don't overlap, and only until the AI first backs off. The cut-off is the agreed known limit in
  design.md, but the spec scenario doesn't say so. Suggest adding "until it first backs off" when the spec is synced.
  This is wording only; the behaviour is as agreed.
- **M-2.** Ricochet Alley Waves sits at 0.91% against its 1% limit. Expect to re-measure after any AI change that
  alters `aiRng` draws.
- **M-3.** While waiting on arrival, `navigate` replans every tick (`think.ts:349`), not every `aiReplanInterval`. That
  is cheap today because the sticky goal keeps the path trivial. Worth remembering for the server's per-tick budget in
  multiplayer.
- **M-4.** The spec says the AI keeps a hidden target "unless another tank it may target is in plain view". The code
  changes only if the *best-scoring* tank is in view (`think.ts:296`). The code's behaviour is the sensible one; the
  spec wording could follow design decision 8 ("unless the best alternative is in plain view").
- **M-5.** Target choice uses a zero-width line of sight, but `hiddenTicks` counts ticks without an 8-unit shot lane.
  A target seen through a narrow gap therefore builds up grace-period time while also counting as "visible" for
  scoring. This is harmless as far as I can tell; a short comment would help.
- **M-6** (this was already the case before this change). If an AI ever outlives every enemy, `selectTarget` leaves a
  stale `targetId`, so the watchdog would keep backing off an idle AI. No current mode reaches this, because the round
  or game ends first.

## Manual checks for the human

1. **Waves playtest on Ricochet Alley, Frustration and Checkerboard** (one-map Sequence each). Watch for back-and-forth
   turning at corners. The leftover queuing behind a parked ally should read as a shuffle, not a glitch.
2. **Does Waves feel harder?** The measurements say slightly easier (140.4 -> 134.5 AI hits per minute), but AIs being
   stuck less may still feel more present.
3. **Last One Standing with mortars on.** AI lobs should look committed: stop, turn, charge, release.
4. **Target choice in Last One Standing.** AIs should no longer swing round between two targets every half-second.
5. **An AI blocked by cover should look like it's waiting**: barrel steady, then a back-off after about a second.
