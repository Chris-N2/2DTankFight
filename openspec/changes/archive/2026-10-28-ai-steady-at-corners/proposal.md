## Why

AI tanks sometimes sit beside an obstacle corner and turn back and forth on the spot, neither moving nor firing. The
playtests saw it most on Ricochet Alley ("quite often sitting and turning back and forth"). It looks broken rather than
cautious. A simulated run found it is far worse in Waves than in Last One Standing, and it showed one AI pinned behind
an ally for over a minute. That breaks the existing *Navigation* requirement: an AI must not stay stuck against another
tank indefinitely.

The goal is to make the AI **look** decisive, **not** to make it more dangerous. The hesitation takes some pressure off
in Waves, and a much more effective AI would need Waves rebalancing (longer pauses between shots, wider aim error),
which is out of scope.

## What Changes

- **Measured baseline** (exploration harness: 4 AIs, an invulnerable scripted human, 8 seeds × 90 s per board). A
  "dance window" is one second in which an AI moves under 12 units, reverses its turn at least twice and doesn't fire.

  | Board | Waves | Last One Standing |
  |---|---|---|
  | Ricochet Alley | 4.1% | 0.2% |
  | Frustration | 2.5% | 0.0% |
  | Checkerboard | 1.2% | 0.0% |
  | Proving Ground | 0.2% | 0.0% |

  The longest time on Ricochet Alley Waves without moving or firing was 73.6 s.
- **Causes found** (all in `ai/think.ts`):
  1. *Mode flicker:* engage and navigate are chosen afresh every tick from hard thresholds (shot lane clear, range over
     420, tank-wide lane clear). Next to a corner, a 1-unit nudge flips the choice, and each mode turns a different
     way. Each engage tick also resets the stuck counter, so stuck recovery never runs.
  2. *Ally pile-ups (Waves):* every AI heads for the nearest cell with a clear shot at the same human, so they queue
     at the same corner and block each other.
  3. *Aim re-roll wobble:* lined up but with the barrel clipping cover, the AI re-rolls its aim every reaction delay
     (left, then right) before backing off.
  4. *Goal flip:* a replan can move the goal to the other side of an obstacle. Rarer, and mostly together with cause 1.
- **Fixes:**
  - **Hysteresis between engage and navigate:** entering engage is exactly as strict as today; leaving it needs a
    clear change (narrower lanes, a longer range). A tank that isn't moving no longer flips between modes.
  - **A progress watchdog:** an AI that has neither moved nor fired for a while takes the existing recovery action,
    whatever mode it's in. It catches cause 2 and anything we haven't found.
  - **Hold still while the barrel is blocked:** keep the aim instead of re-rolling it, and back off when the existing
    blocked window runs out. It reads as waiting for a shot rather than glitching.
  - **Steer clear after getting stuck:** after a recovery, the AI won't settle back near the same spot for a few
    seconds. (Measuring showed the watchdog alone turned the wobble into a reverse-and-return shuffle.)
  - **Smaller fixes found while measuring:** sticky plan goals, no small turn reversals while navigating, and waiting
    on arrival at a goal. They are tuned so that the AI doesn't hit any more often than before.
  - **Steadier target choice:** in Last One Standing, an AI could swing round between two targets every couple of
    seconds. A much nearer hidden tank can now beat a distant visible one, and an AI keeps a target that has only just
    ducked out of sight.
- **Targets** (the same harness becomes a regression test): Ricochet Alley Waves dance windows below 1%, and no AI
  goes more than 6 s without moving or firing. 3 s was the first aim; what's left over it is AIs queuing behind a
  parked ally (see below). Results are in design.md.
- **Not in this change** (and why):
  - *AI spreading out (Waves):* AIs avoiding the cells allies hold or are heading for. AIs often line up three in a
    row, which is too easy when each one dies to a single hit. Worth doing, but it makes the AI genuinely stronger, so
    it belongs with Waves rebalancing. It would also fix the last stalls this change leaves: an AI queued behind an
    ally parked in its route backs off and retries every couple of seconds.
  - *Blacklisting failed firing spots* in general, *AI bank shots* and *difficulty settings*, for the same reason.
  - No change to aim error, reaction delay, fire pauses or shell behaviour.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-opponents`:
  - *Navigation* adds a scenario for being blocked by an ally.
  - *Aiming and firing* changes the lined-up-but-blocked behaviour from "re-aim or reposition" to "hold aim, then
    reposition".
  - *Target selection* lets a much nearer hidden tank beat a distant visible one, and keeps a target that has only
    briefly slipped out of sight.
  - A new *Decisive movement* requirement: no turning back and forth on the spot, and a bounded time without
    progress.

## Impact

- **Simulation (`src/sim/src/ai/think.ts`):** mode hysteresis, the watchdog and the blocked-barrel hold. A few new
  `AiMemory` fields (`types.ts`, `createAiMemory`) and possibly new AI tuning values in `config.ts`.
- **Tests (`src/sim/test`):**
  - a regression test built from the exploration harness (Waves on Ricochet Alley and Frustration, with a human who
    survives);
  - unit tests for each scenario;
  - existing AI tests that pin exact turn or aim behaviour may need updating.
- **Determinism:** AI decisions change, so the golden test's recorded values must be re-recorded on purpose (its
  comment already allows for this). Same-seed reproducibility is unaffected.
- **Balance:** Last One Standing should barely change. Waves AIs will be stuck less, so they may feel a little more
  present. Playtest Waves on each board before archiving.
- **Client:** none. No new dependencies.
