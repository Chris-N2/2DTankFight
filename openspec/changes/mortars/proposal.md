## Why

The game is fast, brief and fun because of its Combat roots: three clean hits, with cover and bounce angles deciding
who lands them. In Waves, "hide and hunt" is often the human's only way to survive against superior numbers. Every
tank also plays the same way all the time, so there is no moment that asks for a decision beyond "shoot now or
later".

The original vision called for 3 damaging mortars per round. Explored against the current game, that looked likely
to break it:

- cover stops protecting anyone;
- a burst of splash damage ends a round with no counterplay (a tank has only 3 hit points);
- hold-to-charge rewards parking and lobbing, which slows the pace;
- in Waves, refilled splash damage on bunched-up 1-hit-point AI tanks wipes waves for free.

This change adds a mortar that gives the human **one tactical decision per round or wave** without taking any of
that away. It does **no damage**. Instead it bogs tanks down, setting up a turret kill rather than replacing one. A
setup toggle keeps "classic" play one switch away.

## What Changes

- **New: the mortar.** Each tank that has a mortar gets **one shot per round (Last One Standing) or per wave
  (Waves)**, refilled at each start.
  - Hold the mortar button to charge. Range grows from a minimum to a maximum. Release to launch straight ahead.
  - The shell arcs over obstacles and lands at the charged range.
  - Its splash **does no damage**. It **slows the driving speed** of every tank in range for a short time,
    **including the firer's**. Turning and the turret are unaffected.
  - The tank can drive, turn and fire its turret while charging. A playtest-only config switch makes it stand still
    instead.
- **New: a "Mortars" on/off setup option** for both modes, **on by default**. Off plays exactly as the game does
  today ("classic").
- **Who has mortars:**
  - In **Last One Standing**, every tank has one, including the AI.
  - In **Waves**, only humans have them. This gives the underdog a tool against superior numbers and keeps
    hide-and-hunt viable.
- **AI (Last One Standing only):** lobs its mortar when its target is within mortar range but out of turret line of
  sight. The AI makes no special effort to dodge mortars, because being slowed does not hurt directly.
- **Controls:**
  - Keyboard: either Shift key fires the mortar.
  - Gamepad: LB or RB fires the mortar. The gamepad spec reserved these buttons for mortars until now.
- **Visuals and HUD:**
  - a landing reticle while charging;
  - the shell drawn with a ground shadow;
  - a mud splat where it lands, and a "bogged down" look on slowed tanks;
  - the HUD shows whether the human's mortar is ready.
- **Waves bests are kept separately with mortars on and off.** Existing bests were set without mortars, so they
  carry over as the "classic" bests.
- **CLAUDE.md's vision is updated** to match: 1 mortar, slowing rather than damaging, humans-only in Waves, with a
  toggle. The original said 3 damaging mortars per round.

## Capabilities

### New Capabilities
- `mortars`: the mortar weapon in the simulation. This covers:
  - charging, range and launch;
  - arcing flight over obstacles;
  - landing and splash;
  - the slow effect, including on the firer;
  - one shot per round or wave, with refills;
  - the on/off option.

### Modified Capabilities
- `simulation`:
  - the tank input model gains a mortar button (held or not held);
  - tank movement speed can be reduced by a slow effect.
- `last-one-standing`:
  - game options gain the mortars on/off choice;
  - each round starts with every tank's mortar loaded (when mortars are on).
- `waves`:
  - options gain the mortars on/off choice;
  - each wave starts with each human's mortar loaded and the AI tanks without mortars;
  - the purpose line's promise of "mortar refills" is fulfilled.
- `ai-opponents`:
  - "same rules for everyone" gains the exception that AI tanks have no mortar in Waves;
  - AI tanks in Last One Standing use their mortar against targets hidden behind cover.
- `game-client`:
  - the setup screen gains the mortars option;
  - keyboard and gamepad controls gain the mortar button (LB/RB stop being reserved);
  - arena rendering gains mortar visuals;
  - the HUD shows mortar readiness;
  - Waves bests are kept per mortar setting.

## Impact

- **Simulation (`src/sim`):**
  - `types.ts`: `TankInput.mortar`; mortar and slow state on `TankState`; mortar shells in `MatchState`; new events;
    `mortars` in `MatchOptions`.
  - `config.ts`: new tuning values.
  - `world.ts`: charging, launch, flight, landing and the slow effect.
  - `options.ts` and `rules/*`: the option, loading mortars at round or wave start, and Waves' humans-only rule.
  - `ai/think.ts`: deciding when to lob.
- **Client (`src/client`):**
  - `input.ts`, `gamepad.ts`: the mortar button, and the existing fire latch extended to it.
  - `renderer.ts`, `effects.ts`: reticle, shell, shadow, splat and the slowed look.
  - `screens.ts`, `main.ts`: the setup option and HUD.
  - `best.ts`: a storage key per mortar setting.
- **Determinism:** mortar flight and AI decisions use fixed-step maths and the existing seeded RNG, so replays stay
  identical.
- **Multiplayer readiness:** the mortar is just another input bit, so the future authoritative server needs nothing
  extra.
- **Docs:** CLAUDE.md's "Combat" and "Waves" sections.
- No new dependencies.
