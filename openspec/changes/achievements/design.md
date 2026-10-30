## Context

See proposal.md for why. What exists today that shapes the approach:

- The simulation returns a list of `SimEvent`s from every `step`. Local games feed them through
  `Game.onEvent` → `playEvent(match, event, viewer)` in `client/src/main.ts`. Online games get the same events,
  in order, inside snapshots: `OnlineMirror.frame()` returns them with a `MatchState` rebuilt from the snapshot, and
  `onlineFrame` passes them to the same `playEvent` with the player's seat as `viewer`. So **one per-event hook in
  `playEvent` sees every game, local or online**, from the right player's point of view.
- Events already cover most of the list: `shotFired`, `hit` (`targetId`), `friendlyHit`, `bounce`,
  `mortarLanded` (`ownerId`, `slowedIds`), `eliminated` (`tankId`, `byId`), `roundStarted`/`roundEnded`
  (`outcome`, `scorers`), `waveStarted` (`aiCount`)/`waveCleared` (`cleared`) and `gameEnded` (`result`,
  `winnerId`, `forfeit`, `wavesCleared`).
- Online playback merges several ticks' events into one frame, and the state passed with them is the *next*
  snapshot, not the tick each event happened on. Anything that depends on the exact tick, or on a tank's state at the
  moment it died, can't be read reliably from the mirror state.
- `best.ts` already has `StorageLike` and `browserStorage()` with the "storage may be blocked" handling.
- `createMatch` sets up round 1 without returning a `roundStarted` event, so the first round's start is never seen
  as an event. Every round, including round 1, opens with a countdown.

## Goals / Non-Goals

**Goals:**
- One pure, framework-free module (`client/src/achievements.ts`) holding the list, the tracker and the store, unit
  tested with plain event sequences and with real simulated matches.
- Detection that gives the same answer in local and online games.
- Adding an achievement means one new entry in one list, plus its tests.

**Non-Goals:**
- Server-side or account-based achievements, syncing between devices, anti-cheat. Achievements live in the player's
  browser, and someone who edits local storage has only fooled themselves.
- Achievement sounds or art. Audio is the next change; it can add an unlock sound then.
- A rules language or user-defined achievements.

## Decisions

### 1. Detect on the client from the event stream, not on the server
Each client already sees every event for its own game. Doing it there means no protocol messages, no server state,
and local and online games share one path. **Alternative:** the server works out achievements and sends "unlocked"
messages. That was rejected: it adds protocol, server-side per-player state and still needs client storage. It would
also leave single-player depending on code that lives on the server.

### 2. Three new fields on `eliminated`: `bankShot`, `slowed`, `tick`
- `bankShot`: whether the shell credited with the kill had bounced. `world.ts` already records `lastHitBy` per
  tank; it also records whether that shell had bounced (`shell.bounces > 0` at the moment of the hit).
- `slowed`: `tank.slowTicks > 0` when it's eliminated. The mirror state can't give this: by the time the event is
  played back the tank is dead and its timer may have moved on.
- `tick`: `state.tick` for the step. MADness needs "you went down in the round's final tick", and merged online
  frames lose tick boundaries.

**Alternatives:** have the tracker follow `bounce` events by shell id (possible, but it relies on shell ids and
event order across snapshots, and doesn't help with `slowed` or `tick`); track mud timers in the client from
`mortarLanded` (it would duplicate simulation rules and break if they're tuned). Adding fields doesn't change what
happens in the game; the golden fingerprint includes events, so it is re-recorded, as was done in two-player-sim.
In the type, the fields are required, not optional, so the compiler finds every place that builds the event. The
client still reads them defensively (`=== true`), since a snapshot from an older server won't have them (see Migration
Plan).

### 3. Tracker: facts per round and per game, then one check per achievement
`AchievementTracker` is built per game with `viewer`, whether the game counts (`eligible`: false against the test
bot) and the earned set. It is fed `(state, event)` and returns the ids newly earned.

It keeps a small set of **facts**, reset at `roundStarted`/`waveStarted`:
- `shotsFired` (yours), `hitsTaken` (`hit` events targeting you), `bankKills` (`eliminated` by you with
  `bankShot`, of opponents), and `aiCount` from `waveStarted` (for You Can Take That to the Bank);
- `humanEliminations`: `{ id, tick }` in order, plus the latest elimination tick of any tank;
- `complete`: whether this round's facts started at its beginning (see 5).

Each achievement is a plain object:

```ts
interface Achievement {
  id: string;            // stable, kebab-case; the storage key. Never renamed.
  name: string;
  description: string;
  where: 'any' | 'single' | 'two';
  needsCompleteRound?: boolean;
  /** True when this moment earns it. */
  earned(m: Moment): boolean;
}
```

A **moment** is the event plus everything a check might need: `state`, `viewer`, the facts, and the derived flags
`twoPlayer`, `wonRound` (Last One Standing: `roundEnded` whose only scorer is you, still alive) and `clearedWave`
(`waveCleared` with you alive). Most checks are one line, for example Pacifist:
`m.event.type === 'roundEnded' && m.wonRound && m.facts.shotsFired === 0`. The tracker applies `where`,
`needsCompleteRound` and "already earned" before calling `earned`, so the checks don't repeat those.
**Alternative:** a data-driven condition language. Rejected, as agreed: it is harder to test, and TypeScript already
is a condition language.

Notes on specific checks:
- **MADness** on `roundEnded`/`waveCleared`-then-`gameEnded`: no tank alive in `state`, and your elimination tick
  equals the latest elimination tick. In Waves the wave counts as cleared and the game ends together; checking at
  `gameEnded` (with `wavesCleared` raised) covers that.
- **Completionist**: on a won round or cleared wave, add `"<mode>:<board id>"` to stored progress. It is earned when
  the progress holds every id in `BUILT_IN_BOARDS` for both modes. Progress is kept even after it's earned, and a
  board added later doesn't take the achievement away (earned is forever).
- **Close Shave** reads `hp` from `state` at the round's end. Hit points don't change between the end of a round and
  the next round's start, so the mirror's slightly later state is still right.
- **"Opponent"** for Banked: in Waves, any AI tank; in Last One Standing, any tank but you.

### 4. Store: one JSON value in local storage
Key `tank-command.achievements`, value `{ "v": 1, "earned": { "<id>": "<ISO date>" }, "completionist": ["..."] }`.
It is written immediately on every unlock or progress change. Unknown ids are kept (an older copy of the game won't
wipe what a newer one recorded); invalid JSON is treated as empty. Every read and write is in `try`, and storage
being `null` just means "not saved", in the same style as `best.ts`. The date isn't shown yet; it costs nothing and
might be nice later.

### 5. Rejoins: a round counts in full only if it was seen from its countdown
A tracker is created at every new local game and every new online `gameId` (which also changes when a dropped
player is let back in). The current round's facts are `complete` only if the first state the tracker sees is in
`countdown`, when nothing can have happened yet. Otherwise they become complete at the next `roundStarted` /
`waveStarted`. This covers round 1, whose start event is never seen, without special cases, and refresh-rejoins,
which create a fresh tracker. Achievements whose check doesn't depend on the earlier part of the round keep working
straight away.

### 6. Showing unlocks
The tracker's returns are queued in `Game`. During `playing` nothing shows. When the match reaches `roundOver` or
`gameOver`, the queue is moved to the display:
- `roundOver`: a small **unlock panel** (`#unlocks`) below the centre banner, one line per achievement (name in
  bold, then the description), shown for the length of the pause and cleared when the next round starts.
- `gameOver`: an **unlock list** on the result screen (`#go-unlocks`), under the quip.
The panel is `aria-live="polite"`, so the assertive banner isn't interrupted.

### 7. Achievements screen
An `#achievements` overlay, like `#join`. It holds a heading, the earned count, the list (each row has a ✓ or a lock
mark, the name and the description; locked rows are greyed with a `locked` class, not only by colour, so it reads in
any theme), the storage note, and a **Back** button. The setup screen gets an `Achievements n / 20` button. With no
server configured, the two-player rows also say "Needs online play". It uses the existing menu navigation (a row of
one button) and Escape / gamepad B to close, the same as the join overlay. Colours come from the theme's `--tank-*`
variables, so hosts' themes apply.

### 8. Test bot
`OnlineSession` records `vsBot` when the host's `bot` request starts the game (only the host can call `playBot`).
The tracker is built with `eligible: !vsBot`.

## Risks / Trade-offs

- [A dropped connection loses events, so some round achievements can't be earned that round] → by design (spec:
  Rejoining mid-round). The next round counts in full.
- [Changing the `eliminated` event changes the golden fingerprint, which could hide a real regression in the same
  commit] → change the event first, re-record the golden in its own commit with gameplay unchanged (spawns
  identical), then build the client work on top.
- [Achievement names are a bit cheeky ("Friends with Benefits")] → they are the developer's choice and fit the
  game's tone; easy to rename later, since storage uses ids rather than names.
- [Some achievements are very hard (You Can Take That to the Bank, Stop Hitting Yourself)] → intended. The tests use
  hand-built event sequences, so they can be checked without playing them.
- [Local storage is per browser and per origin: a host embedding the game on their own site gets a separate set] →
  noted in the README; that's the price of no accounts.

## Migration Plan

Nothing to migrate: there is no earlier achievement data. Deploying is the usual client build. The server only needs
redeploying so its sim emits the new event fields; an old server just leaves them out. The client treats a missing
`bankShot`/`slowed`/`tick` as false/unknown, so it can't crash, and it simply never awards Banked and the others
against that server.
