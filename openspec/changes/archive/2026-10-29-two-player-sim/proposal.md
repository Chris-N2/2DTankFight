## Why

Multiplayer is the last step on the roadmap, and it's two problems in one: the *rules* for two humans in one match, and
the *networking* that lets them play from different machines. This change does the rules first, entirely inside the
pure simulation, so every two-player rule can be pinned down by deterministic unit tests before a socket exists. The
networking change that follows can then treat the simulation as finished and concentrate on rooms, snapshots and
prediction.

## What Changes

- A match can be created with **one or two human tanks**. Single-player matches behave exactly as today (same tank
  ids, colours, spawns and results for the same seed), so existing tests and golden runs still hold.
- **Tank limits follow the number of humans:** at most 5 tanks in total, so two-player games have 1 to 3 AI opponents
  (Last One Standing) or start with 1 to 3 AI tanks and grow to 3 (Waves).
- **AI colours skip blue with two humans.** Blue is reserved for "the other human" on each player's screen, so in a
  two-player match the AI tanks are red, yellow and purple. Single-player keeps its current colours, blue included.
  (Drawing "me in green, the other human in blue" is a client concern and arrives with the networking change, which
  is the first time a second screen exists.)
- **Two-player Waves (co-operative):**
  - a host option for **friendly fire**, which decides whether one human's shells can damage the other;
  - the AI targets both humans;
  - a human destroyed mid-wave sits out the rest of it and **respawns at the start of the next wave**;
  - the game ends when **no human is alive**; the score is still waves cleared, shared by the team.
- **Two-player Last One Standing:**
  - each human scores their own points; **rounds won by the AI score for nobody** but still count as played;
  - a round ends when one tank is left, or immediately when both humans have been eliminated;
  - if the last two humans are destroyed in the same tick, they **share the point**;
  - the game ends when all rounds are played, or when one human leads by more than the rounds remaining; level on
    points is a draw. The result names the winning human (or a draw) rather than "win/loss", so each screen can say it
    from its own point of view.
- **A human can leave mid-game** (the simulation's half of disconnect handling): in Waves their tank is removed and
  the game carries on for the remaining human; in Last One Standing the remaining human **wins by forfeit**. The
  networking change decides *when* someone has left; this change decides what that does to the match.

## Capabilities

### New Capabilities

None. Two-player play extends the existing mode and simulation capabilities rather than standing on its own.

### Modified Capabilities

- `simulation`: matches with one or two humans; leaving a match; shell hits respect the friendly-fire option.
- `last-one-standing`: two-player options and limits, per-human scoring, round end, shared points, game end and
  forfeit.
- `waves`: two-player options and limits (including friendly fire), AI targeting both humans, respawn at the next
  wave, game over when no human remains, a human leaving mid-game.
- `game-client`: AI colours in a two-player match never use blue. (The single-player client is otherwise unchanged.)

## Impact

- **Sim (`src/sim`)**: `MatchOptions` gains the number of humans and the friendly-fire option; option validation and
  tank limits; `createMatch` builds one or two human tanks; both mode rules (`rules/lastOneStanding.ts`,
  `rules/waves.ts`) handle two humans; `Scores`, `RoundOutcome`, `GameResult` and the round/game events gain per-human
  forms; shell hits check friendly fire; a new "human leaves" entry point. `HUMAN_ID` stays as the single-player id.
- **Client (`src/client`)**: compiles against the widened types and keeps playing single-player only. No new screens
  or options are exposed yet; the host's two-player options arrive with the networking change.
- **Tests**: new two-player rule tests in the sim; existing single-player tests, golden and soak runs must pass
  unchanged.
- **No new dependencies.** No networking, server or deployment work: that is the next change.
