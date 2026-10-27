## Context

See proposal.md for why mortars slow tanks rather than damaging them. The design here follows the shape of the
existing code:

- `world.ts` runs the physical tick: movement, shells, firing, then eliminations, all resolved together.
- `rules/*` set tanks up per round or wave through `ModeRules.setUp`.
- `ai/think.ts` turns state into a `TankInput`.
- The client renders interpolated snapshots and turns `SimEvent`s into effects.

Everything in `MatchState` stays plain data, so it can be cloned, compared and later sent over the network.

## Goals / Non-Goals

**Goals:**
- Mortars fit the existing tick order and the "all hits resolve together" rule without disturbing either.
- With mortars off, behaviour is identical to today. The existing test suite becomes the regression check for
  classic play.
- All balance numbers live in `config.ts`, so a playtest can tune them.

**Non-Goals:**
- Mortars that damage, mortar pickups, or more than one mortar per round. These are deliberately ruled out.
- AI dodging of mortars. Being slowed doesn't hurt directly, so the AI ignores incoming mortars.
- Two-human behaviour. Everything is written per tank, so the co-op and multiplayer changes need no more mortar
  work, but they aren't built here.
- Waves escalation that gives AI mortars in later waves. This was noted as a possible future lever, and is not part
  of this change.

## Decisions

### 1. Input: a fourth field, edge-triggered like fire
`TankInput` gains an optional `mortar?: boolean`. Absent means not held, matching "missing input means idle", and
existing callers that know nothing of mortars stay valid. `IDLE_INPUT` sets it false. (During apply this changed
from a required field, to avoid churning about thirty classic test inputs.) `TankState` gains `mortarHeld` to detect the
press transition, mirroring `fireHeld`.

*Alternative:* a single "weapon" enum. This was rejected because the turret and the mortar must be usable in the same
tick.

### 2. Tank state: three small numbers
`TankState` gains:
- `mortars` (0 or 1): loaded or not;
- `mortarCharge` (ticks held so far, or -1 when not charging);
- `slowTicks` (remaining slow, 0 when not slowed).

The range is a pure function of the charge, `mortarRange(config, chargeTicks)`. It is exported from the sim, so the
client reticle and the AI use exactly the same maths as the launch. The landing point comes from another exported
helper, `mortarLanding(state, tank, chargeTicks)`, which applies the clamp into the arena.

### 3. Mortars in flight are their own list
`MatchState` gains `mortarShells: MortarState[]` and `nextMortarId`. Each `MortarState` holds `{ id, ownerId, fromX,
fromY, toX, toY, flightTicks, ticksLeft }`.

The flight is a straight lerp in the ground plane plus a purely cosmetic height. The sim never needs the height,
because mortars don't collide with anything in flight. The client derives the height as
`progress * (1 - progress)`, scaled by range.

*Alternative:* reusing `ShellState` with a flag. This was rejected because shells sweep, bounce and hit, while
mortars do none of those. Sharing the type would put `if (mortar)` branches through `moveShell`.

### 4. Tick order
```
  stepWorld:
    1. tank movement            <- speed x slowFactor while slowTicks > 0; slowTicks--
    2. shells fly               (unchanged)
    3. mortars fly; landings    <- every landing this tick slows its tanks
    4. turret firing            (unchanged)
    5. mortar charge / launch   <- release => new MortarState (from this tick's position)
    6. eliminations             (unchanged)
```
- Mortars land before new launches. A mortar launched this tick can never land on the same tick, because the flight
  time is at least one tick.
- Landing is not a hit, so it never touches `hp` or `lastHitBy`.
- Charging starts only on a press transition while the tank has `mortars === 1`.
- Release launches using the charge held so far. The press tick sets the charge to 0, and each further tick held adds
  one. So a one-tick tap launches at exactly the minimum range, and holding for 1 + N ticks gives a charge of N. The
  tank still moves on the press tick, before the charge begins.
- An eliminated tank's charge is simply dropped.
- `stepWorld` only runs during play, so mortars in flight freeze during pauses, and nothing lands after a round ends.

### 5. Splash test: body overlap, walls ignored
A tank is caught when `distance(centre, landing) <= splashRadius + tankRadius`. This matches the spec's "body lies at
least partly within".

Walls don't shield tanks. Mud goes everywhere, and it keeps the rule simple to read on screen.

Re-catching a slowed tank sets `slowTicks` back to the full duration rather than adding to it.

### 6. Who gets a mortar: the mode's `setUp` decides
- `lastOneStanding.setUp` gives every tank `mortars = options.mortars ? 1 : 0`.
- `waves.setUp` gives humans the same and AI tanks 0.

Both reset `mortarCharge`, `mortarHeld` and `slowTicks`. The shared round-start code clears `mortarShells` alongside
`shells`.

This keeps the humans-only-in-Waves rule in the one place that already owns the per-mode tank set-up.

### 7. Options: an explicit `mortars: boolean` on both modes
`MatchOptions` gains a required `mortars: boolean`, and `validateOptions` rejects anything that isn't a boolean,
because options may one day come from a network client. It is required rather than optional so that no code path
can silently pick a default.

The client's setup screen defaults it to `true`. Existing sim tests pass `mortars: false`, which turns them into the
classic regression suite.

### 8. Config values (starting guesses, to be tuned)

| Key | Default | Note |
|---|---|---|
| `mortarMinRange` | 150 | Must exceed `mortarSplashRadius + 2 * tankRadius`, so a tap in open ground never catches the firer. The exception is a lob aimed beyond the arena edge: the landing point is pulled back inside, which can put it next to you. That's accepted: the spec's clamp rule and the self-splash rule allow it, and it's very much "trying to make it happen" |
| `mortarMaxRange` | 600 | Half the arena width |
| `mortarChargeTime` | 1.0 s | Time from minimum to maximum range |
| `mortarFlightTime` | 0.8 s | Readable, but too short to stroll away from |
| `mortarSplashRadius` | 60 | |
| `mortarSlowFactor` | 0.5 | Applies to forward and reverse speed |
| `mortarSlowDuration` | 2.5 s | |
| `mortarPlantWhileCharging` | false | Playtest switch, not in the UI (like `wavesAiCooperate`). When true, throttle is ignored while charging |
| `aiMortarPatience` | 2.0 s | How long a target must stay hidden before an AI lobs |
| `aiMortarRangeError` | 0.08 | Fraction of the distance, applied either side of exact |

A test asserts the minimum-range inequality for `DEFAULT_CONFIG`, so tuning can't quietly break it.

### 9. AI: a small "lob" state, entered only from the hidden branch
`AiMemory` gains:
- `hiddenTicks`: how long the target has been out of turret lane, incremented in the existing "no clear lane" path
  and reset when the lane clears or the target changes;
- `lob: { targetId, x, y, range, aimOffset } | null`: the committed lob. It carries its **own** target, separate
  from `targetId`, because target selection re-runs every `aiRetargetInterval` and prefers visible tanks. Without it,
  a retarget mid-lob would swing the AI round onto a tank it could simply shoot, still using the range planned for
  the old one. QA found this. `x`/`y` is that target's last known position.

In `think`, before navigating, the AI starts a lob when all of these hold:
- the tank has `mortars === 1`;
- the mode is not Waves (which is already implied by `mortars === 0`);
- `hiddenTicks >= aiMortarPatience`;
- the distance to the target is within the minimum and maximum range.

The planned range is the distance multiplied by a seeded `1 ± aiMortarRangeError`. The aim reuses `rollAimError`.

While lobbing, the AI:
1. sets throttle to 0 and turns towards the lob's target, whatever the AI's current `targetId` is;
2. once within aim tolerance, holds `mortar` until `mortarRange(charge)` is at least the planned range;
3. releases, which launches, and clears `lob`.

Before the button goes down, the lob is called off and the mortar kept if its target is destroyed, or if it steps
into a clear turret lane. The turret takes over from there. Once charging, the lob is finished regardless,
at the target's last known position if need be. It's a short window, and the spec says a committed lob is
completed. The lob check runs before the "no target" early return, so a charge in progress is always released.

All randomness comes from `aiRng`, so the determinism tests cover lobs.

*Alternative:* the AI lobs predictively at moving targets. This was rejected as unnecessary for a slow-only weapon,
and harder to make beatable.

### 10. Events
- `{ type: 'mortarLaunched'; mortarId; tankId; x; y; toX; toY }`
- `{ type: 'mortarLanded'; mortarId; ownerId; x; y; slowedIds: string[] }`

The client uses them for launch and landing effects. They also let tests assert behaviour without poking at state.

### 11. Client
- **Input:**
  - `inputFromKeys` maps `ShiftLeft` or `ShiftRight` to `mortar`, and both are added to `GAME_KEYS`.
  - The gamepad maps LB or RB to `mortar`.
  - `combineInputs` ORs `mortar` across devices.
  - `FireLatch` generalises to latch both buttons independently, so a held LB at game start waits for a fresh press.
- **Renderer:**
  - The reticle is drawn for the human only, from `mortarLanding(...)`, and only while `mortarCharge >= 0`.
  - Mortars in flight are drawn as an interpolated shell with a height offset and scale, a ground shadow, and a
    small ring at `toX`/`toY`.
  - Slowed tanks get a mud tint plus a few brown blobs at the tracks.
  - The splat effect is spawned from `mortarLanded` in `effects.ts`.
- **HUD:** a mortar icon, filled when loaded and outlined when used, hidden entirely when mortars are off.
- **Setup:** a Mortars On/Off row in both modes, defaulting to On. The controls summary gains "Shift / LB, RB:
  mortar (hold to aim)".
- **Bests:** `bestKey(startAiCount, mortars)`:
  - mortars off keeps today's key, `tank-command.waves-best.N`, so existing bests become classic bests;
  - mortars on uses `tank-command.waves-best.N.mortars`.

## Risks / Trade-offs

- **[A round-start mud barrage in Last One Standing]** With 4 AI, everyone could lob at once at the start.
  → `aiMortarPatience` makes the AI wait until a target has stayed hidden, and AI target the nearest tank, which is
  often another AI. If it still feels oppressive in a playtest, raise the patience.
- **[The mortar feels pointless]** A 50% slow for 2.5 s might be too weak to matter. → All values are in config; the
  playtest decides. The obvious knobs are factor, duration and radius.
- **[Hidden-branch lobbing makes the AI stand still near cover]** A lob takes up to about 1.5 s of standing still.
  → This is also a window for the human to punish, which is good. The stuck detection only counts driving ticks, so
  it won't misfire.
- **[Reticle only for the human]** A future second human in multiplayer may want to see their own reticle, but not
  the opponent's. → The render decision is per local player, so it follows naturally.
- **[A larger state shape]** New fields on every tank. → They are plain numbers, so cloning, comparison and
  determinism tests cover them automatically.

## Migration Plan

- No data migration is needed. Waves bests stay under their existing keys, which now mean "mortars off".
- To roll back, revert the change. Bests recorded with mortars on simply become unused keys.
- Docs:
  - update CLAUDE.md's Combat, Waves and Last One Standing wording to the new mortar design;
  - at archive, refresh the `waves` spec's Purpose line, which still lists mortar refills as future work.
