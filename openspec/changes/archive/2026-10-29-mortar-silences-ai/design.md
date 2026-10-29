## Context

A mortar splash sets `tank.slowTicks` (`mortar.ts`), and `moveTank` (`world.ts`) scales driving speed while it's above
zero and counts it down. Firing is decided in `stepWorld`'s firing loop: a press (edge-triggered via `fireHeld`) fires
if the cooldown is zero and the tank has hit points. Per-tank combat stats that differ by mode (`shellDamage`,
`shellSpeed`, `mortars`) are set by the mode's rules in `setUp`, which keeps mode knowledge out of `world.ts`.

The AI (`ai/think.ts`) presses fire when lined up, ready and with a clear barrel, and then waits out a cooldown plus a
random pause. Its progress watchdog (`makingProgress`) starts a recovery when the tank has neither moved nor fired for
`aiProgressWindow` (1.5 s). The slow lasts `mortarSlowDuration` (2.5 s), longer than the window.

## Goals / Non-Goals

**Goals:**
- An AI tank in Waves can't fire while slowed, for exactly the slow's duration.
- The simulation stays mode-agnostic: the Waves rules switch the behaviour on per tank.
- The AI waits out the jam sensibly rather than wasting fire presses or "recovering" from it.

**Non-Goals:**
- New visuals, new config values, or rebalancing Waves.
- Any change to Last One Standing.

## Decisions

**1. The jam *is* the slow: a per-tank flag, not a second timer.** Add `mudJamsTurret: boolean` to `TankState`
(default `false` in `createTank`). A tank is jammed when `mudJamsTurret && slowTicks > 0`. Sharing `slowTicks` makes
"same duration as the slow", "a second splash restarts both" and "cleared each wave" true by construction.
*Alternative:* a separate `jamTicks` counter. Rejected: two timers that must always agree is a bug waiting to happen.
*Alternative:* check `state.waves !== null && tank.kind === 'ai'` in `world.ts`. Rejected: it puts mode rules into
the world step, which the existing per-tank stats deliberately avoid.

**2. Waves sets the flag on AI tanks in `setUp`**, next to `shellDamage`/`shellSpeed`. AI tanks are rebuilt every
wave, so the flag is always set. Humans keep the default `false`.

**3. The firing loop skips jammed tanks.** The press condition gains `&& !jammed`. `fireHeld` is still updated
from the input, so a press held right through the jam doesn't fire when the jam ends: firing stays edge-triggered.
No shell, no cooldown and no `shotFired` event while jammed.

**Timing:** `moveTank` decrements `slowTicks` before the firing loop runs, and a landing sets it after it (in
`flyMortars`). So a mortar landing on tick *t* slows driving on ticks *t+1* to *t+S*, and jams firing on ticks *t* to
*t+S−1*: the jam bites the moment the mortar lands (that tick's movement has already happened) and lasts exactly as
many ticks as the slow. Tests pin the jam to the slow duration rather than to a hard-coded count.

**4. The AI respects the jam.** A shared helper `turretJammed(tank)` (in `tank.ts`) is used by both `world.ts` and
`think.ts`. In `decide`'s engage branch, a jammed AI is not `ready`: it keeps turning on to its aim but doesn't
press fire, so it doesn't spend its post-shot pause or re-roll its aim error on a shot that never happens. The
watchdog in `makingProgress` treats a jammed turret like a committed lob: it resets the progress window. Otherwise
an AI holding its aim for 2.5 s would trip the 1.5 s watchdog and reverse away, which looks like panic rather than a
jammed gun (and would make a mortared AI harder to finish off).

## Risks / Trade-offs

- [The jam makes later waves too easy] → it only lasts as long as the slow (2.5 s), and the human has one mortar per
  wave. Tune `mortarSlowDuration` or the splash radius after a playtest if needed; both are already config.
- [Players don't notice the jam] → the mud drawn on slowed tanks already marks them; the menu hint and README say so.
  A dedicated cue is a follow-up if playtesting asks for it.
- [Golden / determinism recordings change] → only if a recorded Waves game lands a mortar on an AI. If so, refresh
  the recording and note why in the commit.
- [A jammed AI parked in an ally's path holds it up longer] → bounded by the slow duration; the ally's own watchdog
  still runs.
