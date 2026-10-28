## 1. Reproduce first

- [x] 1.1 Add `test/aiSteadiness.test.ts` from the exploration harness (see design, decision 5): Waves, 4 AIs, mortars off, Ricochet Alley and Frustration, fixed seeds, and a scripted wandering human kept alive. Measure the dance-window rate and the longest stretch without moving or firing (lobs excepted), and assert the *Corner dance stays rare* targets. Check that it **fails** on the current code, with figures close to the proposal's baseline, and record those figures. Baseline (one-second spans that don't overlap, so higher than the exploration's sliding windows): Ricochet Alley Waves 8.4% dancing, longest stall 73.7 s; Frustration Waves 4.8%, 37.3 s; Ricochet Alley Last One Standing already passes.
- [x] 1.2 Add unit tests for *Steady at a corner* and *Blocked by an ally*, using the traced setup (Ricochet Alley, AI at about (415, 237), an allied AI at (377, 238), the human in the top-left corner). Check that both fail on the current code. Result: *Steady at a corner* fails (12 reversals in one second). *Blocked by an ally* already passes in isolation: the AI backs off about every 2.5 s and drives straight back (the shuffle, not the freeze). The full-match freeze is caught by `aiSteadiness`'s stall check.

## 2. Fixes

- [x] 2.1 Hysteresis (design, decision 1): add `engaging` to `AiMemory` and `createAiMemory`. Use the "stay" thresholds (shot lane about 4, range about 450, tank-wide lane about `tankRadius - 4`) while engaging and the current ones otherwise, as named constants. Verify that *Steady at a corner* passes and the existing AI tests still pass (reaction delay, fire gaps, holds fire behind cover). Done; *Steady at a corner* needed the later tasks as well (see 2.4).
- [x] 2.2 Hold aim while blocked (design, decision 3): stop re-rolling `aimOffset` while the barrel is blocked; recovery still happens at `aiStuckWindow`. Update the *Lined up but blocked by cover* test to check that the turn input doesn't reverse while blocked, and that the AI still moves and fires within a bounded time. Done; it fires after about 2.8 s (seed 1).
- [x] 2.3 Progress watchdog (design, decision 2): add `aiProgressWindow` (about 1.5 s) to the config, and progress fields to `AiMemory`. Make sure no branch can reset them, and pause them during a committed lob and during recovery. Add an *Always making progress* test (a recovery happens within the window; none happens during a lob), and verify that *Blocked by an ally* passes. Done (`makingProgress` wraps `decide`, so no branch can skip it). *Always making progress* is covered by *Blocked by an ally* and `aiSteadiness`'s stall check; no lob test was needed, because a committed lob pauses the watchdog in the same check as recovery does.
- [x] 2.4 Re-run `aiSteadiness`. If the targets are met, skip decision 4 and say so here. If a pinned AI reverses and comes straight back, add the short avoid-list (design, decision 4) and re-run. Tune the margins as needed, and record the before/after figures in this task.
  - Decision 4 was needed, and in a wider form (design, decision 4): after *any* recovery, the AI doesn't engage from or plan to within 40 of where it got stuck, for 3 s.
  - Two more fixes turned up while measuring (design, decision 6): sticky plan goals, and no turn reversal under 10° while navigating.
  - Arrival handling was also needed (design, decision 7): a 4-unit goal-lane margin, and waiting on arrival. A 13.5 margin was tried first, but it raised AI hits on the human by 10%.
  - Remaining stalls are AI tanks queuing behind a parked ally. With the user's agreement (2026-10-28) they're accepted and parked with *AI spreading out*. The stall target became 6 s, and *Steady at a corner* checks the time until the AI first backs off.
  - Figures (before -> after):

    | | Dancing | Longest stall |
    |---|---|---|
    | Ricochet Alley, Waves | 8.4% -> 0.91% | 73.7 s -> 4.8 s |
    | Frustration, Waves | 4.8% -> 0.52% | 37.3 s -> 5.7 s |
    | Ricochet Alley, Last One Standing | (passed) -> 0.18% | (passed) -> 1.8 s |

    Ricochet Alley Waves is close to its 1% limit.
  - Difficulty check (all boards, Waves, invulnerable wandering human): AI hits on the human 140.4 -> 134.5 per minute, AI shots 218 -> 216 per minute.

## 3. Knock-on effects and checks

- [x] 3.1 Re-record the golden test's values on purpose, with a line in its comment saying why (AI decisions and `aiRng` draws changed). Update any other test that pinned exact AI turn or aim sequences, and verify that the full sim suite and the soak tests pass.
  - The golden values are re-recorded; the spawns are unchanged.
  - *Reproducible lobs* moved from seed 1 to seed 5: with the new movement, seed 1 has no lob. Lob frequency overall is about the same (33 -> 37 launches over every board × 6 seeds).
  - *Holding fire for an ally* now lets the AI drive once the ally has moved (the avoid zone; design, decision 4).
  - The full suite passes.
- [x] 3.2 Check that Last One Standing behaviour is broadly unchanged: run the harness's Last One Standing figures and check that they are no worse than the baseline (0–0.2%).
  - Dancing is fine on every board (0–0.18%). But stalls had grown on Nowhere (Much) To Hide (2.4 s -> 7.3 s) and then Proving Ground (6.8 s): the AI was flip-flopping between targets.
  - Fixed by steadier target choice (design, decision 8; spec *Target selection*), with tests *Sticks with a target that ducks out of sight* and *A distant tank in view doesn't pull it off a nearby hunt*. Both fail on the old code.
  - Now every board's longest stall is 0.6–2.5 s. AI hits on the human in Last One Standing: 55.6 -> 48.2 per minute.
- [x] 3.3 Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`, and verify they all pass. Then suggest `/qa`, and a Waves playtest on Ricochet Alley, Frustration and Checkerboard (one-map Sequence each), watching for corner wobble and whether Waves feels harder. Done: typecheck, lint, Prettier, 386 tests and the build all pass.
