## Why

The game plays well and feels finished, but nothing rewards the odd, funny or difficult things players already do:
the bank-shot kill, the mutual destruction, getting the AI to shoot itself. Achievements give players a reason to try
those on purpose and to come back. Nearly everything they need is already in the simulation's event stream, so this
is cheap to add now that multiplayer is done.

## What Changes

- Add **20 achievements** (the list in `MoreFeatures.md`). Each has a name and a one-line description of what earns it.
  Some can only be earned in single-player, some only in a two-player online game, and the rest in either.
- Each player **earns their own achievements on their own device**. The client works them out from the events and
  state it already has, in both local and online games. The server and the protocol don't change, apart from three
  extra fields that come with the events the server already sends.
- Achievements are **saved in the browser's local storage** and kept between visits. No account and no personal
  data. Clearing the site's data loses them, and the achievements screen says so. Completionist's progress across
  games is saved the same way.
- **Unlocks are never shown mid-fight.** Anything earned during a round is shown when the round or wave ends, or on
  the result screen if the game ended.
- A new **Achievements screen**, opened from the setup screen, lists all 20: earned ones in full, locked ones greyed
  out (still with their description, so players know what to try). Two-player achievements are marked as unavailable
  when the site has no game server.
- Games against the server's **test bot don't earn achievements**: it's a testing tool, not a second player.
- The simulation's `eliminated` event gains three facts the client can't reliably work out from snapshots: whether
  the shell that finished the tank had bounced (a **bank shot**), whether the tank was **slowed by mud** when
  destroyed, and the **tick** it happened on. Gameplay doesn't change, but the golden-run fingerprint will, since it
  includes the events.
- Each achievement is a **small TypeScript check** over the events. There's no rules language: adding an achievement
  means adding one entry and its tests.

## Capabilities

### New Capabilities
- `achievements`: the achievement list and what earns each one, per-player detection in local and online games,
  saving progress, showing unlocks at round, wave and game end, and the Achievements screen.

### Modified Capabilities
- `simulation`: the Elimination requirement's "eliminated" event also reports whether the finishing shell had
  bounced, whether the tank was slowed, and the tick.

## Impact

- **sim**: the `eliminated` event (`types.ts`, `world.ts`), the golden test's recorded fingerprint, and a few tests.
- **client**: a new pure `achievements.ts` (the list, the tracker and the store; it reuses `StorageLike` /
  `browserStorage` from `best.ts`), wiring in `main.ts` for local and online games, new markup and styles for the
  unlock panel and the Achievements screen (both reachable with a gamepad), and tests.
- **protocol / server**: no code changes. Snapshots already carry every event, and the new fields go with them.
- **README**: a short note on achievements, and that they are stored per browser.
