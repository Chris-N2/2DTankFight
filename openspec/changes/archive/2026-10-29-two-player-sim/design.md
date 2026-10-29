## Context

The simulation (`src/sim`) already takes inputs keyed by tank id, and its phase machine (`match.ts`) delegates
everything mode-specific to `ModeRules` (`rules/lastOneStanding.ts`, `rules/waves.ts`). The single-human assumption
lives in a handful of places:

- `createMatch` builds one human with `HUMAN_ID = 'p1'`;
- `options.ts` caps AI at a flat `AI_COUNT_MAX = 4` and `maxTanks` assumes one human;
- `rules/lastOneStanding.ts` finds *the* human and scores `{ human, ai }`;
- `rules/waves.ts` sizes waves against `AI_COUNT_MAX`;
- `world.ts` lets every shell damage every tank (apart from the no-self-hit-before-a-bounce rule);
- AI colours come from `colorIndex = i` for `ai{i}`, so `ai2` is blue.

`startRound` already revives every tank in `state.tanks`, so "respawn at the next wave" costs nothing. Golden and
soak tests pin single-player behaviour down to the event, which is the safety net for "single-player is unchanged".

## Goals / Non-Goals

**Goals:**
- Two-human rules that are fully exercised by deterministic sim tests, with no client or network involvement.
- Types that the networking change can send and each client can read from its own point of view (results name a
  winner, not "win/loss").
- Single-player byte-for-byte unchanged in behaviour for the same seed and inputs.

**Non-Goals:**
- Any client UI for two players: no option rows, no perspective colours, no two-player HUD or result text. The client
  only adapts to the widened types.
- Deciding *when* a player has left (timeouts, reconnect grace). That is the networking change's job; this change
  provides the `leave` entry point it will call.
- Rebalancing Waves for two humans. The curve is reused with a lower AI cap; tuning waits for real playtests.

## Decisions

### Options: `humans` and `friendlyFire`, both optional with single-player defaults

`MatchOptions` gains `humans?: 1 | 2` (default 1) on both modes, and Waves gains `friendlyFire?: boolean` (default
false). Optional fields mean every existing caller and test keeps compiling and meaning what it meant. Validation
checks them (`humans` must be 1 or 2, `friendlyFire` a boolean when present) because options will arrive from a
network client in the next change, as the existing comments in `options.ts` anticipate.

- *Alternative:* a separate `TwoPlayerOptions` type. Rejected: every rule would need to branch on the type rather than
  on a number, and the host's setup screen is the same screen with one more row.

### Tank limits derived from humans

`AI_COUNT_MAX` stays (it is the single-player maximum the client's setup screen uses), and a new
`aiCountMax(humans)` returns `MAX_TANKS - humans` with `MAX_TANKS = 5`. `validateOptions`, `maxTanks` and
`waveSetup` use it. `waveSetup` takes the AI cap as a parameter rather than reading the constant, so a two-player
curve is "the same curve with a lower ceiling": first full wave = `cap - startAiCount + 1`, and the full-size armour
is `wavesAiMaxHpByCount[cap - 1]` (1 hit point by default for both 3 and 4 AI, so escalation starts from the same
place).

### Human ids `p1` and `p2`; tank order `[p1, p2, ai…]`

`HUMAN_ID` stays as `'p1'` (the host) and `SECOND_HUMAN_ID = 'p2'` is added. Humans come first in `state.tanks`.
Spawn assignment indexes the shuffled spawn list by tank order, so with one human the order — and therefore every
spawn — is exactly as before. With two humans, `p2` takes the second shuffled spawn and the AI shift along by one; no
board starts a tank aimed at another spawn, so any order is fair.

### Colours: a per-humans AI colour table in the sim

`colorIndex` stays the sim's way to give a tank a stable, shared colour. `p1` is 0 (green), `p2` is 2 (blue), and AI
colour indices come from a table chosen by the number of humans: `[1, 2, 3, 4]` (red, blue, yellow, purple) for one
human, `[1, 3, 4]` (red, yellow, purple) for two. `ai{i}` always takes the table's `i`-th entry, so a tank keeps its
colour from wave to wave and both screens agree.

The sim's indices describe the host's view. Perspective ("I'm green, you're blue") is a pure client mapping in the
networking change: on `p2`'s screen, 0 and 2 swap. The palette itself doesn't change, so no fifth colour is needed.

- *Alternative:* store no human colours in the sim at all. Rejected: the renderer and effects already look colours up
  by `colorIndex`, and single-player would need a special case.

### Friendly fire: one check at the hit, with its own event

In `moveShell`, when the shell's owner and the tank it touches are both humans, are different tanks, and the match is
Waves with `friendlyFire` off, the shell is destroyed with no damage and a
`{ type: 'friendlyHit'; shooterId; targetId; shellId; x; y }` event is emitted instead of `hit`. Last One Standing
never has friendly fire off, so the check is "Waves with friendly fire off" in one helper.

- *Why a new event, not `hit` with `damage: 0`:* the client's effects treat `hit` as "something got hurt" (flash, HP
  pips). A distinct event lets the next change play a harmless *clang* without every `hit` consumer learning about
  zero damage.
- *Why destroy rather than pass through:* decided with the user. It's visible, and a partner's tank works as cover.

### Scores and outcomes per human

`Scores` becomes `{ humans: Record<string, number>; ai: number }`. In single-player `humans` has the one entry `p1`
and `ai` counts AI rounds, as now. In two-player `ai` still counts the rounds the AI won, but the game-end rules
ignore it: AI rounds score for nobody, and the count exists only so the result screen can rib the humans about it
(the networking change writes that text). Three-way scoring, with the AI as a competitor that can beat both humans,
was considered and rejected: it makes "both lose" a result and turns every-tank-for-itself into half co-op. `RoundOutcome` keeps
`'human' | 'ai' | 'draw'` (some human scored / the AI won / nobody scored), and the `roundEnded` event and
`MatchState` gain `scorers: string[]`, the humans who scored that round (both, for a shared point).

The game result for two-player Last One Standing is `'win'` with `winnerId`, or `'draw'`; `loss` never arises between
two humans. `MatchState` gains `winnerId: string | null` and `forfeit: boolean`, and the `gameEnded` event carries
both. Single-player keeps `win | loss | draw` with `winnerId` set to `p1` on a win.

- *Alternative:* keep `{ human, ai }` and add `human2`. Rejected: it bakes "two" into a type that every screen reads,
  and makes "whose point was it?" a naming puzzle.
- *Cost:* this is the one breaking type change. The client reads `scores.humans[HUMAN_ID]` in its few score helpers;
  tests that assert `{ human: 1, ai: 0 }` are updated mechanically.

### Shared point needs to know who fell in the final tick

The two-player round rules distinguish "both humans fell in the last tick" (shared point) from "one fell earlier"
(draw). `ModeRules.evaluate` gains the tick's events, and Last One Standing reads the `eliminated` events from them.
This keeps the rule a pure function of the tick and adds nothing to `TankState`, so single-player state snapshots
don't change shape.

- *Alternative:* an `eliminatedAt` tick on each tank. Rejected: it changes every tank's state for one rule, and
  golden tests compare state.

### `leave(state, humanId)`: called between ticks

A new exported `leave(state, id): SimEvent[]`, called by whoever runs the match (the server, next change) between
`step` calls. It removes the tank from `state.tanks` and its shells and mortars in flight, but keeps its entry in
`scores.humans`, so a forfeit result still shows the final score. Then it asks the mode's rules, through a new
`ModeRules.left(state, id, events)`:

- **Last One Standing:** game over at once; `result = 'win'`, `winnerId` = the remaining human, `forfeit = true`. The
  current round is neither scored nor counted.
- **Waves:** if no human remains alive, the game is over (`result = 'over'`); otherwise play carries on. Wave sizes
  keep using the two-player cap: `aiCountMax` is computed from `options.humans`, not from the tanks still present.

It returns `[]` and changes nothing if the game is over, the id isn't a human in the match, or the match has only one
human (single-player has no "leave"; closing the tab simply ends it).

- *Why remove the tank rather than mark it dead:* a dead tank is revived by `startRound`. Removal also means AI
  targeting, collisions and rendering need no new "gone" state.
- *Why remove its shells:* otherwise a player who has left could still score or slow someone, and every consumer of
  `hit`/`eliminated` would need to cope with an id that no longer has a tank.

### Respawn falls out of the existing round start

Waves' `setUp` keeps every human in `state.tanks`, and `startRound` revives all of them. The only rule change is
`evaluate`: game over when no human is alive (already written as `some(human && alive)`), so one fallen human no longer
ends the game.

## Risks / Trade-offs

- [The `Scores` reshape ripples into the client and many tests] → It's mechanical; do it as one early task with the
  client compiling against the new shape before any two-player rule is added, and keep the golden expectations
  unchanged as the proof.
- [Two-player Waves is unbalanced (two humans, one fewer AI)] → Accepted for now; the cap and curve are config-driven
  and the next change brings real playtests. Recorded as a balancing follow-up rather than guessed at.
- [Spawn order shifts AI spawns in two-player] → Only in two-player matches, which have no golden runs yet; add a
  two-player golden run so later changes notice drift.
- [`leave` called mid-tick by a careless caller] → It's documented and tested as a between-ticks call; the server loop
  in the next change applies leaves before stepping.
- [AI in Waves now has two targets] → Targeting already picks among `kind === 'human'` tanks; add a test that an AI
  switches to the second human when the first is destroyed, so a stale `targetId` can't freeze it.

## Migration Plan

None beyond the code: there's no persisted data, and the client's saved bests are keyed by single-player options,
which don't change.
