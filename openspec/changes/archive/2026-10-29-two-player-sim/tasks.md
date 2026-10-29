## 1. Groundwork (no behaviour change)

- [x] 1.1 Reshape `Scores` to `{ humans: Record<string, number>; ai: number }`, add `scorers` to `roundEnded` and
  `MatchState`, and `winnerId` / `forfeit` to `MatchState` and `gameEnded`; update the client's score helpers and the
  existing tests mechanically. Verify: `npm run typecheck`, `npm test` and the golden runs pass with unchanged
  expectations apart from the score shape.
- [x] 1.2 Pass the tick's events to `ModeRules.evaluate` and add an empty `ModeRules.left` to both rules. Verify: all
  existing tests still pass.

## 2. Options and setup

- [x] 2.1 Add `humans?: 1 | 2` to both modes and `friendlyFire?: boolean` to Waves; add `MAX_TANKS`, `aiCountMax(humans)`
  and `SECOND_HUMAN_ID`; validate both new fields and the per-humans AI limits; update `maxTanks`. Verify: tests for
  *Too many tanks rejected*, *Two humans, at most three AI*, *Invalid starting count is rejected* (two-player case)
  and *Friendly fire is off unless chosen*.
- [x] 2.2 Make `createMatch` build `p1` (and `p2` when `humans` is 2) ahead of the AI tanks, and assign AI colour
  indices from the per-humans table. Verify: tests for *Two humans, two sets of controls*, *No blue AI in a two-player
  match*, *Single-player colours unchanged* and *Colours stay put across waves*.

## 3. Friendly fire

- [x] 3.1 Add the friendly-fire check to the shell hit in `world.ts` with the new `friendlyHit` event. Verify: tests
  for *Friendly fire off* (unbounced and bounced), *Friendly fire on*, *Still hoisted by your own shell*, and that AI
  shells still damage humans with friendly fire off.

## 4. Two-player Waves

- [x] 4.1 Give `waveSetup` the AI cap as a parameter and use `aiCountMax(options.humans)` from the Waves rules. Verify:
  tests for *Two humans, three AI at most* and *Two-player escalation starts at three*; single-player escalation tests
  unchanged.
- [x] 4.2 Both humans are set up every wave and game over needs no human alive. Verify: tests for *Both humans armed*,
  *One down is not game over*, *Both down is game over*, *Back for the next wave* and *Sitting it out*.
- [x] 4.3 Check AI targeting with two humans. Verify: a test that an AI whose target is destroyed moves on to the other
  human.

## 5. Two-player Last One Standing

- [x] 5.1 Implement the two-player round end and scoring, including the shared point read from the tick's
  `eliminated` events. Verify: tests for *One human down, play on*, *Last human standing*, *The AI wins a two-player
  round*, *Sharing the point* and *Going out with the last AI*; single-player round tests unchanged.
- [x] 5.2 Implement the two-player game end with `winnerId`, counting AI round wins in `scores.ai` without letting them
  affect the result. Verify: tests for *Out of reach*, *AI rounds still count*, *Level after the last round* and *The
  AI's rounds are only for show*.

## 6. Leaving

- [x] 6.1 Add and export `leave(state, id)`: remove the tank, its shells and mortars, emit `left`, then call the rules'
  `left`; do nothing when the game is over, the id isn't a human, or there's only one human. Verify: tests for *A clean
  exit* and *Too late to leave*.
- [x] 6.2 Implement `left` for Last One Standing (forfeit) and Waves (carry on, or game over if nobody is alive).
  Verify: tests for *Winning by forfeit*, *Leaving between rounds*, *Carrying on alone*, *Nobody left to carry on* and
  *No reinforcements for the AI*.

## 7. Wrap-up

- [x] 7.1 Add a two-player golden run (both modes, scripted inputs for both humans) and extend the soak test with
  two-player games on every board. Verify: both pass and are deterministic across two runs.
- [x] 7.2 Confirm single-player is unchanged: the existing golden and determinism tests pass with their original
  expectations (*Single-player is unchanged*). Run `npm run typecheck`, `npm run lint`, `npm run format:check` and
  `npm test`.
- [x] 7.3 Note for archive: the `waves` and `last-one-standing` main-spec Purpose paragraphs still say "single-player
  only"; update them when syncing. Update the README's mode descriptions if they say the same. Verify: no
  "single-player only" claims remain in those Purposes or the README.
