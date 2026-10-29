## Why

The later waves are hard work: four AI tanks, tougher armour, harder-hitting and then faster shells. The mortar is
meant to be the outnumbered human's tool, but today it only slows the AI down. A bogged-down AI can still turn and
shoot straight back, so landing a mortar on a pack buys the human very little. Letting the mud jam the AI's guns too
turns a good mortar into a real opening to go on the attack.

## What Changes

- In **Waves**, an AI tank caught in a mortar splash **cannot fire its turret** for as long as it is slowed. The
  silence and the slow are the same thing: they start together, end together, and a second splash restarts both.
- Shells already in flight are unaffected; only new shots are stopped.
- Humans are never silenced, in either mode. Last One Standing is unchanged: every tank there, AI included, keeps
  its turret while slowed, as now.
- The AI knows its gun is jammed: it keeps aiming but doesn't try to fire, and fires as soon as the mud clears if
  it's still lined up. It doesn't treat sitting still with a jammed gun as being stuck.
- The README and the menu hint mention the jam in Waves.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mortars`: the splash's "firing unaffected" rule gains an exception that a game mode can switch on.
- `waves`: AI tanks' turrets are jammed while they are slowed by a mortar.
- `ai-opponents`: a jammed AI holds its aim instead of trying to fire, and isn't counted as stuck for it.

## Non-goals

- No new visual cue: the mud already drawn on a slowed tank shows which AI tanks are jammed. Revisit after a
  playtest if it isn't obvious enough.
- No change to the slow's duration or factor, or to Waves escalation. Balancing waits for a playtest.
- The AI doesn't change tactics when jammed (e.g. retreating to cover).

## Impact

- Simulation: tank state, the firing step and the Waves rules (`src/sim/src/types.ts`, `tank.ts`, `world.ts`,
  `rules/waves.ts`), and the AI (`ai/think.ts`).
- Tests in `src/sim/test/` (`mortars.test.ts`, `waves.test.ts`, `ai.test.ts`). Golden/determinism tests may need
  their recordings refreshed if any recorded Waves game lands a mortar on an AI.
- Docs: `README.md` and the menu hint in `src/client/src/markup.ts`.
