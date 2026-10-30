# QA Report: achievements

**Verdict:** PASS
**Date:** 2026-10-30

This is a re-run after the fixes for the first report's findings 1–3. The fixes are uncommitted changes in the working
tree on top of HEAD `d70e48e`: `net.ts`, `session.ts`, `achievements.ts`, three test files and the achievements delta
spec.

## Build & tests

All commands were run from the repository root.

| Command | Result |
|---|---|
| `npm run typecheck` (sim, protocol, client, client/test, server) | Pass |
| `npm run lint` | Pass, no findings |
| `npm test` (vitest run) | Pass: 43 files, 789 tests (up from 782) |
| `npm run build` (client) | Pass |
| `npm run build:server` | Pass |
| `npm run format:check` | Pass |
| `openspec validate achievements --strict` (PowerShell) | "Change 'achievements' is valid" |

**Tasks:** all tasks in `tasks.md` are ticked, including 4.3. The developer has confirmed the playtest passed.

**Architecture (CLAUDE.md):** no change from the first run. The simulation is still pure, and its only change is three
facts added to the `eliminated` event, with gameplay unchanged and the golden fingerprints re-recorded with an
explanatory comment. The fixes are all client-side. The rejoin intent sent to the server is still
`{t:'rejoin', code, token}`, so the protocol and the server don't change.

## Re-check of the earlier findings

1. **Bot flag lost on refresh: fixed.** `StoredSeat.vsBot` is optional, and `sessionSeatStore.load` keeps it only when
   it is exactly `true` (`net.ts`). `OnlineSession.rejoin` restores it after building the session.
   - `setVsBot()` re-saves the seat whenever the flag changes. `playBot()` sets it; a lobby refusal and the `lobby`
     message clear it.
   - The `room` handler now saves through `saveSeat()`. On a rejoin, the server's `reconnect` sends `room` again,
     which re-saves the seat with the flag kept.
   - I checked the server's messages. `addBot` starts the game without sending `lobby`, so the flag isn't cleared
     early. `backToLobby` / `guestGoneAfterGame` send `lobby`, which clears it, as intended.
   - Tests: `net.test.ts:253`, `session.test.ts:214` (covers refresh, Play again and the lobby clearing it) and
     `session.test.ts:236`.
2. **Stale state after a long stall: fixed.** `onEvent` (`achievements.ts:443`) marks a moment stale when a
   `roundEnded.round` or `waveCleared.wave` differs from `state.round`. The sim sets both from `state.round` when the
   round ends (`lastOneStanding.ts` `finish`, `waves.ts` `finish`), so in normal play they always match.
   - When the moment is stale, `wonRound` and `clearedWave` are false, which also stops the Completionist progress
     write. `mutuallyDestroyed` returns false.
   - Achievements that use only the event still work: Surfer, the milestones, and You Can Take That to the Bank.
   - Tests: `achievements.test.ts:807`, `:820` and `:836`.
3. **Unannounced unlocks after a drop: settled in the spec.** A new paragraph and the "Earned, then dropped" scenario
   say these unlocks are saved but don't have to be announced. The code already behaved that way. Test:
   `achievements.test.ts:789`.
4. **Screen tests that match source text:** left as they are on purpose. This is the project's existing style
   (`markup.test.ts`, `online-screens.test.ts`), and the developer has agreed to keep it. Not a finding.

## Scenario coverage

Test files: `ach` = `src/client/test/achievements.test.ts`, `scr` = `src/client/test/achievements-screens.test.ts`,
`cmb` = `src/sim/test/combat.test.ts`, `ses` = `src/client/test/session.test.ts`, `net` = `src/client/test/net.test.ts`.
Code file: `a.ts` = `src/client/src/achievements.ts`.

| Requirement | Scenario | Status | Code | Test |
|---|---|---|---|---|
| Achievement list | Every achievement is listed | Verified | a.ts:121-289, `achievementRows` a.ts:525 | ach:196, ach:230 |
| Whose / which games | Each player earns their own | Verified | a.ts:167 (Banked: byId === viewer) | ach:252 |
| Whose / which games | Shared credit for shared goals | Verified | a.ts:210 | ach:260 |
| Whose / which games | Partner left | Verified | `twoPlayer` from `options.humans` in `onEvent` | ach:268 |
| Whose / which games | Not against the test bot | Verified | `onEvent` returns early when not eligible; main.ts `onlineFrame` (`!session.vsBot`) | ach:277, ses (vsBot tests), scr:32 |
| Whose / which games | Refreshing during a bot game *(new)* | Verified | session.ts `rejoin`, `setVsBot`, `saveSeat`; net.ts `load` | ses:214, ses:236, net:253 |
| Whose / which games | A dead partner's wave | Verified | `clearedWave` needs you alive | ach:285 |
| Taunted | Out on wave 1 / Hoisted on wave 1 / Got going first | Verified | a.ts:123 | ach:297, ach:302, ach:307 |
| Last One Standing | Winning the game / Two-player win / Forfeit | Verified | a.ts:130 | ach:314, ach:318, ach:324 |
| Surfer | First wave cleared | Verified | a.ts:141 | ach:330 |
| MADness | Mutual destruction in single-player | Verified | a.ts:106, a.ts:148 | ach:337 |
| MADness | Shared point | Verified | same | ach:347 |
| MADness | Taking the last one with you in Waves | Verified | same | ach:360 |
| MADness | Already gone | Verified | same | ach:371 |
| MADness | Someone survived | Verified | same | ach:384 |
| Mudslinger | Two in the mud / Yourself doesn't count | Verified | a.ts:157 | ach:396, ach:400 |
| Banked | Bank-shot kill | Verified | a.ts:167 | ach:410, ach:973 (real sim) |
| Banked | Straight shot / Not your partner / Not yourself | Verified | a.ts:100, a.ts:167 | ach:414, ach:418, ach:423 |
| Perfection | Untouched / One scratch / Harmless clang | Verified | a.ts:178; `note` counts `hit` events only | ach:433, ach:438, ach:445 |
| Pacifist | Let them sort it out / Mud is allowed / One shot | Verified | a.ts:186 | ach:461, ach:467, ach:482 |
| Stop Hitting Yourself | They did it to themselves | Verified | a.ts:194 | ach:489, ach:1000 (real sim) |
| Stop Hitting Yourself | Not with a friend | Verified | `where: 'single'` | ach:501 |
| Two-player to the end | Last One Standing together | Verified | a.ts:203 | ach:509 |
| Two-player to the end | Waves with friendly fire / without friendly fire | Verified | a.ts:210, a.ts:261 | ach:515, ach:523 |
| Two-player to the end | The one who stayed | Verified | a.ts:203 | ach:531 |
| Two-player to the end | The one who left | Verified | main.ts `showSetup` drops the tracker | ach:537, scr:51 |
| Waves milestones | Five in one go / Inconceivable / Dream Team / Not across games | Verified | a.ts:217, a.ts:247, a.ts:254 | ach:549, ach:555, ach:559, ach:566 |
| Completionist | Progress is kept / Both modes needed / Final board | Verified | a.ts:82, a.ts:224; `book.complete` in `onEvent` | ach:574, ach:584, ach:593 |
| Obsessed | The AI took advantage / Somebody won | Verified | a.ts:231 | ach:610, ach:616 |
| Take That to the Bank | Four for four / Three out of four | Verified | a.ts:239; `note` counts bank-shot kills | ach:629, ach:638, ach:665 |
| Unfair Advantage | Shooting fish in a barrel | Verified | a.ts:271 | ach:675, ach:987 (real sim) |
| Unfair Advantage | Mud has dried / Not in Last One Standing | Verified | a.ts:271 | ach:679, ach:683 |
| Close Shave | Hanging on / Comfortable | Verified | a.ts:283 | ach:693, ach:699 |
| Earned once, kept | Remembered / Earned only once / Storage blocked / Damaged storage | Verified | `AchievementBook` a.ts:312, `parse` a.ts:385 | ach:707, ach:715, ach:723, ach:732, ach:746, ach:757 |
| Unlocks between rounds | Earned mid-round | Verified (logic); the on-screen part is a manual check | `UnlockQueue` a.ts:562, main.ts `showUnlocks` | ach:851, scr:60 |
| Unlocks between rounds | Earned in the last round | Verified (logic); the on-screen part is a manual check | same | ach:860, scr:60, scr:77 |
| Unlocks between rounds | Several at once | Verified | same | ach:867 |
| Unlocks between rounds | Earned, then dropped *(new)* | Verified | the book saves when an achievement is earned; main.ts `enterPlay` clears the queue | ach:789 |
| Achievements screen | Locked ones greyed | Verified (rows); the look is a manual check | `achievementRows`, main.ts `achievementItem` | ach:884, scr:106 |
| Achievements screen | No server | Verified | `achievementRows` | ach:894, scr:99 |
| Achievements screen | Gamepad | Wiring verified by source checks; the developer's playtest (4.3) covered it | main.ts `onAchievementsAction` | scr:115, scr:135 |
| Rejoining mid-round | Back from a drop | Verified | tracker `complete` flag; main.ts makes a new tracker for each `gameId` | ach:772, ach:798, scr:32 |
| Rejoining mid-round | A long stall *(new)* | Verified | `stale` in `onEvent` (a.ts:443), `mutuallyDestroyed` | ach:807, ach:820, ach:836 |
| Elimination (sim) | Tank destroyed / Shells outlive their tank / Simultaneous elimination / Point-blank trade / Destroyed tank still stops shells that tick | Verified | world.ts `stepWorld` | cmb:173, cmb:190, cmb:205, cmb:221, cmb:239 |
| Elimination (sim) | Bank-shot kill reported / Direct kill reported / The finishing shell decides | Verified | world.ts `lastHitBy` keeps `{byId, bankShot}` | cmb:256, cmb:272, cmb:284 |
| Elimination (sim) | Destroyed while bogged down / Elimination tick reported | Verified | `slowed: tank.slowTicks > 0`, `tick: state.tick` | cmb:311, cmb:323 |

Rows that list several scenarios cover each of them separately.

**Counts:** 76 scenarios (73 before, plus 3 new). All 76 are Verified; 3 of them also need a look on screen. 0 are
Implemented, untested. 0 are Missing / wrong.

## Findings

### Implementation bugs (spec was right, code wasn't)

None outstanding. The first report's findings 1 and 2 are fixed and tested (see above).

### Spec gaps (spec wrong or incomplete)

None outstanding. Finding 3 is settled by the new paragraph and the "Earned, then dropped" scenario.

### Minor / suggestions (do not block)

- Any `refused` message while in the lobby clears `vsBot`, not just the refusal of the bot request. If the host asks
  for the bot and the server refuses some other lobby change in the same moment, the flag is cleared just before the
  bot game starts. The bot request is the only lobby action that can start a game, so this is a very narrow window.
  It's mentioned only for completeness.
- The stale check compares round numbers. If a stall spans a whole round *and* the batch also contains that round's
  start, the event is still correctly marked stale, because `state.round` is later. Nothing to change. This just
  confirms the fix covers the multi-round case too.
- Screen wiring is still tested by matching source text, as agreed (see finding 4 above).

## Manual checks for the human

The developer's playtest (task 4.3) covered the main ones: the unlock panel between waves and on the result screen,
and opening the Achievements screen with the mouse, the keyboard and a gamepad. These are still worth a look when
convenient:

1. **Host theme:** in a host theme (`--tank-*` variables), locked rows are greyed and show the `·` mark, and the list
   scrolls when it's taller than the window.
2. **No server:** on a build without a game server, the five two-player rows say "Needs online play".
3. **Blocked storage:** with site data blocked, the screen's note says achievements will be forgotten, and the game
   still plays.
4. **Online, on the redeployed server:** Banked appears only on the shooter's screen. At game end, both players see
   Friends with Benefits / With Friends Like This….
5. **Bot fix, on the dev server:** play the test bot, refresh mid-game, and play to the end. No achievements should be
   earned. Then go back to the lobby and play a real guest, and achievements should be earned again.
