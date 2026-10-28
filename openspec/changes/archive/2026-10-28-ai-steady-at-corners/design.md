## Context

See proposal.md (*Why* and *Causes found*) for the problem and the measurements. Relevant parts of `ai/think.ts` today:

- `think()` picks a branch afresh every tick: **engage** if `hasClearLane(…, SHOT_LANE = 8)`, unless the range is over
  `ENGAGE_ADVANCE_DISTANCE` (420) and there's no tank-wide lane (`tankRadius` = 18), in which case it **navigates**.
- Engage resets `stuckTicks` whenever its throttle is 0 (line 125). Navigate counts `stuckTicks` only while its throttle
  is 1. Recovery (`startRecovery`) runs only when `isStuck` fills a whole `aiStuckWindow` (1 s).
- Lined up with the barrel blocked: `blockedTicks` counts up, the aim is re-rolled every `aiReactionDelay` (0.35 s),
  and recovery runs at `aiStuckWindow`.
- All AI randomness comes from `state.aiRng`, so the number and order of draws decide every later AI choice.

## Goals / Non-Goals

**Goals:**
- No visible back-and-forth turning on the spot.
- A stall of any kind ends in recovery within about 1.5 s of no progress.
- Accuracy, reaction time and fire rate exactly as now.

**Non-Goals:**
- Better positions, spreading AIs out, or avoiding allies when planning (parked; see the proposal).
- Making `plan()` pick better spots. Its goal choice changes only as decisions 4, 6 and 7 describe, and those were
  measured so that the AI doesn't hit the human any more often than before.

## Decisions

### 1. Hysteresis on the engage / navigate choice, kept in `AiMemory`

Add `engaging: boolean` to `AiMemory`. The thresholds depend on it:

| Check | Not engaging (to enter) | Engaging (to stay) |
|---|---|---|
| Shot lane half-width | `SHOT_LANE` (8) | `SHOT_LANE_KEEP` (about 4) |
| Range for the tank-wide-lane fallback | > 420 | > `ENGAGE_KEEP_DISTANCE` (about 450) |
| Tank-wide lane half-width | `tankRadius` (18) | about `tankRadius - 4` |

Entering is exactly as strict as now, so the AI never engages, and so never fires, any sooner or into tighter gaps
than today. The barrel check before firing (`barrelClear`, `allyInLane`) is unchanged, so a wider "stay" band can't
fire into cover either. A shell needs a centre line of sight, so losing that always ends engagement, whatever the
band.

*Alternatives:*
- **Minimum time in a mode (e.g. 0.25 s).** Simpler, but a pinned tank would still flip between modes, just more
  slowly, and each flip would become a visible swing of about 45° instead of a 3° jitter. Worse to look at.
- **Smoothing the turn input.** Hides the symptom and leaves the stuck counter broken.

The margins are starting values. Tune them with the harness, then make them named constants (or config entries, if a
test needs to change them).

### 2. A progress watchdog, separate from `isStuck`

Add `progressTicks`, `progressRefX` and `progressRefY` to `AiMemory`. Every tick the AI is in play and not in a
committed lob or recovery:

- if the tank is more than `aiStuckDistance` from the reference point, or fired this tick, move the reference to the
  tank and reset the count;
- otherwise count up, and at `aiProgressWindow` (new config, about 1.5 s) call `startRecovery`.

`startRecovery` resets the watchdog too. "Fired this tick" is the AI's own `fire` output, so `think()` doesn't need
to see sim events.

The existing `isStuck` stays as it is: it's the quick (1 s) check for driving into a wall. The watchdog is the
backstop that every branch shares; no branch can reset it, which is exactly what went wrong in the 73 s stall.

*Alternative:* fix `isStuck` alone (stop engage resetting it). That handles cause 1 but not a pinned AI whose throttle
keeps switching between 0 and 1, or stalls we haven't found yet.

### 3. Hold aim while the barrel is blocked

Remove the periodic `aimOffset` re-roll while blocked (`think.ts:119`). The AI keeps its aim, sits still and turns no
further, and at `aiStuckWindow` it backs off as now (`startRecovery` already re-rolls the aim). A new aim on each
attempt is still random, so this doesn't make the AI more accurate. It just stops the barrel swinging in the meantime.

*Determinism:* this removes `aiRng` draws, so every later AI choice moves for a given seed. That's expected; see
*Migration Plan*.

### 4. Steer clear of where it got stuck, for a while

*Measured necessary, and in a wider form than first planned.* After 1–3, an AI blocked by cover would reverse a tank's
length, still see the target, and engage again from almost the same spot: a reverse-and-return shuffle. The problem
spot is where the tank *was*, not only a planned goal.

So `startRecovery` records the tank's position (`avoidX`, `avoidY`), and for `AVOID_SECONDS` (3 s):
- the AI won't engage from within `AVOID_RADIUS` (40, one grid square) of it; it navigates instead;
- `plan()` won't choose a goal within `AVOID_RADIUS` plus the waypoint reach of it, because a tank stops anywhere within
  reach of its goal and mustn't find itself inside the zone when it gets there.

It applies only after getting stuck, and only for one spot at a time, so it isn't general position-picking
intelligence. A test that pins an AI in place can't leave the zone, so *Holding fire for an ally* now lets the AI drive
once the ally has moved.

### 5. The harness becomes a test

Turn the exploration harness into `test/aiSteadiness.test.ts`:

- Waves, 4 AIs, mortars off, Ricochet Alley and Frustration, a fixed set of seeds, about 60–90 s each;
- a scripted wandering human kept alive by resetting its HP every tick (a test hack, like the existing helpers);
- it asserts the *Corner dance stays rare* targets.

Dance window: 60 ticks with displacement under 12, at least 2 reversals of the turn direction, and no shot fired.
Keep the runtime close to the existing soak tests; reduce seeds or seconds if it's slow.

Focused unit tests for the other scenarios:

- **Steady at a corner:** set up the pinned position from the trace (Ricochet Alley, an AI at about (415, 237), an
  ally at (377, 238), the human in the top-left corner).
- **Blocked by an ally:** the same setup; recovery happens within the watchdog window.
- **Lined up but blocked by cover:** the existing test, plus "the turn input doesn't reverse while blocked".
- **Always making progress:** the watchdog fires; no recovery during a committed lob.

### 6. Sticky goals, and no small turn reversals while navigating

*Found while measuring.* Two more sources of back-and-forth turning:
- **Goal flip (cause 4).** Each replan (every 0.5 s) picked the nearest clear-shot cell afresh, which could switch to
  the other side of an obstacle; the tank turned one way, then the other. Now `plan()` keeps the goal it was heading
  for while that cell still has a clear shot within `ENGAGE_KEEP_DISTANCE`. A recovery or a new target clears the
  path, so a fresh goal is chosen then.
- **Waypoint jitter.** A tank pushing against an ally is nudged about by the collision, and the bearing to a nearby
  waypoint jumps from tick to tick. `navigate` won't reverse its last turn direction (`navTurn`) for an error under
  `NAV_REVERSE_ANGLE` (10°). Small errors are left alone while driving, which the 35° drive angle already tolerates.

### 7. Arriving at a goal

*Found while measuring.* Goals are checked from the cell's centre, but a tank stops anywhere within the waypoint reach
(13.5) of it. From where it actually stopped, the lane could clip a corner. It then drove at the target, left the cell,
was sent back, and went round and round.
- **Wait on arrival:** once the path is used up, the AI stays put and turns to face the target. If the shot never opens
  up, the watchdog (decision 2) moves it on.
- **A little slack in the goal's lane:** goals need `SHOT_LANE + GOAL_LANE_MARGIN` (4) clear, so an AI can usually
  shoot when it arrives.

The margin was chosen by measurement. Goal margin vs AI hits per minute on an invulnerable wandering human (all boards,
Waves; the committed code scored 140.4):

| Margin | Hits/min | Blocked-by-cover AI fires after | Dance targets |
|---|---|---|---|
| 0 | 134.1 | 3–10 s (it retreats step by step) | Frustration fails |
| **4** | **134.5** | **about 3 s** | **pass** |
| 9 | 139.8 | about 3 s | pass |
| 13.5 (the whole reach) | 154.8 | about 3 s | pass |

The whole reach was the obvious choice, but it sends AIs to cleaner firing spots and they hit 10% more often, against
this change's goal.

### 8. Steadier target choice

*Found while measuring Last One Standing on every board.* An AI swung round by about 180° every couple of seconds,
switching targets at each retarget (every 0.5 s). Two causes:
- **A visible target always won**, however far away. Hunting a nearby hidden tank, the AI turned, a distant tank came
  into view at the edge of its sight, it turned towards that one, lost sight of it, and turned back. Now a hidden tank
  counts as `HIDDEN_TARGET_PENALTY` (500) farther away than a visible one, so a much nearer hidden tank can win.
- **A target ducking in and out of sight** (a moving human, say) handed the choice to another hidden tank and back.
  Now the AI keeps its target until that target has been out of its sights (`hiddenTicks`) for `TARGET_GRACE_SECONDS`
  (2 s), unless the best alternative is in plain view.

This changes the *Target selection* requirement (see the spec delta). Effect: Last One Standing's longest stall on
Proving Ground went from 6.8 s back to 2.1 s, and on Nowhere (Much) To Hide from 7.3 s to 1.8 s. Waves hits are
unchanged (one human to target). In Last One Standing, AI hits on the human fell from 55.6 to 48.2 per minute (AIs
spend a little longer on each other).

## Results

- Ricochet Alley, Waves: dancing 8.4% -> 0.91%, longest stall 73.7 s -> 4.8 s.
- Frustration, Waves: dancing 4.8% -> 0.52%, longest stall 37.3 s -> 5.7 s.
- Last One Standing, every board: dancing 0–0.18% (baseline 0–0.2%), longest stall 0.6–2.5 s.
- Difficulty: AI hits on the human per minute, Waves 140.4 -> 134.5, Last One Standing 55.6 -> 48.2. Slightly easier
  in both.

**Known limit (accepted, 2026-10-28):** the longest stalls left are AI tanks queuing behind an ally parked in their
route. They back off every couple of seconds and try again: a shuffle, not a wobble. Routing round allies is part of
*AI spreading out*, which is parked because it makes the AI stronger. So the stall target is 6 s, not 3 s, and *Steady
at a corner* checks only the time until the AI first backs off.

## Risks / Trade-offs

- **The watchdog triggers during legitimate waiting** (e.g. engaged, target ducking in and out of the lane) →
  Repositioning after 1.5 s of silence is fine behaviour; check that the reaction-delay and fire-pause tests still
  pass.
- **Wobble becomes a reverse-and-return shuffle** → it did; decision 4 fixed it everywhere except ally queues (see
  *Known limit*).
- **Ricochet Alley's dance rate is close to its 1% limit (0.91%)** → any later AI change may need it re-measuring.
  Loosen the limit only with a reason.
- **Waves feels harder because AIs are stuck less** → expected to be small: the ally queues remain, since spreading
  out is out of scope. Playtest Waves on each board before archiving.
- **Exact-behaviour tests break** (anything that pins turn sequences or aim re-rolls) → update them to the new
  behaviour, and say so in the commit.
- **The stay thresholds are too loose:** the AI stays engaged while its tank-wide route is blocked, and doesn't get
  closer → 450 is only 30 over 420, and the watchdog catches any silent stand-off.

## Migration Plan

Simulation-only change; no saved data or protocol is affected. The golden test's recorded hashes will change (the
AI's decisions and its `aiRng` draws change). Re-record them deliberately and say why in the test comment. Rollback
is a revert.
