## 1. Simulation

- [x] 1.1 Add `mudJamsTurret: boolean` to `TankState` in `src/sim/src/types.ts` (doc comment: set by the mode's rules;
      while true, the turret can't fire while the tank is slowed), defaulting to `false` in `createTank`
      (`src/sim/src/tank.ts`)
- [x] 1.2 Add a `turretJammed(tank)` helper in `src/sim/src/tank.ts` (`mudJamsTurret && slowTicks > 0`)
- [x] 1.3 In `stepWorld`'s firing loop (`src/sim/src/world.ts`), don't fire a jammed tank; keep updating `fireHeld`
      from the input so firing stays edge-triggered
- [x] 1.4 In the Waves rules' `setUp` (`src/sim/src/rules/waves.ts`), set `mudJamsTurret = true` on each AI tank,
      and update the comment beside it

## 2. AI

- [x] 2.1 In `decide` (`src/sim/src/ai/think.ts`), a jammed AI is not ready to fire: it keeps aiming but doesn't
      press fire, spend its post-shot pause or re-roll its aim error
- [x] 2.2 In `makingProgress`, a jammed turret resets the progress window, as a committed lob does; update the doc
      comment

## 3. Tests

- [x] 3.1 `mortars.test.ts`: make "Turning and firing unaffected" use a tank whose turret isn't jammed, and add
      "Last One Standing keeps every turret" (a slowed AI and a slowed human both fire)
- [x] 3.2 `waves.test.ts`: "Jammed for as long as it's slowed" (no shell, no cooldown and no `shotFired` while
      slowed; fires on the first press once the slow ends, checked against `slowTicks` rather than a hard-coded tick
      count)
- [x] 3.3 `waves.test.ts`: "A second splash restarts the jam", "Shells already fired still fly" and "Humans are never
      jammed"
- [x] 3.4 `ai.test.ts` (or `aiSteadiness.test.ts`): "Holds its aim through the jam": a lined-up AI that is jammed
      keeps facing the target, presses no fire, takes no recovery action, and fires once the jam ends
- [x] 3.5 Run the full test suite; if the golden/determinism recordings change (new tank field, or the Waves
      recording lands a mortar on an AI), check the change is only that and refresh them

## 4. Docs

- [x] 4.1 `README.md`: in the Mortars bullet, say that in Waves the mud also jams the AI's guns while they're slowed
- [x] 4.2 Menu hint in `src/client/src/markup.ts`: mention the jam in Waves, keeping the hint short (and fun)

## 5. Check

- [x] 5.1 `npm run build` and the tests pass; `openspec validate mortar-silences-ai --strict` passes
- [x] 5.2 Playtest a later Waves game (`npm run dev`) to feel whether the jam is noticeable and not overpowered
      (2026-10-29, by the developer: works fine and isn't overpowered. It's a modest edge single-player, since moving
      AI tanks are hard to mortar, but that's part of the skill. The developer expects it to matter more in two-player
      co-op Waves.)
