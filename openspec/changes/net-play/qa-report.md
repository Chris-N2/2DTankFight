# QA Report: net-play

**Verdict:** PASS (re-run). Before `/opsx:archive`, the developer should approve the spec addition proposed under
*Spec gaps*.
**Date:** 2026-10-30

This is the second run. The first run failed on two blocking findings. Both now have client-side fixes, with tests
that reproduce the original problems (the coordinator checked they fail on the old code), and my own probe tests
agree. The rest of the change was already in very good shape. The non-blocking notes from the first run are
unchanged (see *Minor*).

## Build & tests

All run from the repository root on Windows 11, Node 22, against the uncommitted working tree with the fixes.

| Command | Result |
|---|---|
| `npm run typecheck` (sim, protocol, client, client/test, server) | Pass |
| `npm run lint` | Pass |
| `npm run format:check` | Pass |
| `npm test` | Pass: 41 files, 677 tests (4 more than the first run), 87.3 s |
| `npm run build` | Pass |
| `npm run build:server` | Pass |
| First run (the server hasn't changed since): built server started from an empty folder with no `node_modules`, `npm start` | `GET /health` gave 200 and `{"status":"ok","rooms":0}` |
| First run: `MAX_ROOMS=lots node server.js` | Exits with code 1 and names `MAX_ROOMS` |
| First run: `docker build`, then `docker run -p 18094:8080` | `/health` gave 200 (QA's image removed afterwards) |
| QA probe tests (scratch folder, not in the repo) | The lobby-rejoin probe now ends the session (`phase: ended`, `reconnecting: false`). The server probes behave as before, as expected: the server still ignores `playAgain` with an empty second seat, and the client no longer offers or sends it. |

**Tasks:** all ticked. 6.1 and 7.3 were ticked in the uncommitted working copy, each with a note on how it was done.

**Architecture (CLAUDE.md):** respected.
- The fixes are client-only (`session.ts`, `main.ts`). The sim, protocol and server are untouched.
- `src/sim` and `src/protocol` have no timers, DOM, sockets or randomness.
- The server runs the same `step()` through the shared `FixedStepLoop`.
- Clients send controls only. The *Controls only* test shows that injected positions, hits and scores change nothing.

## Scenario coverage

### game-server

| Requirement | Scenario | Status | Code | Test |
|---|---|---|---|---|
| Authoritative simulation | Controls only | Verified | protocol/src/messages.ts:62-87, server/src/room.ts:220-227 | server/test/game.test.ts:44 |
| Authoritative simulation | Garbage in | Verified (see Minor 1) | protocol/src/messages.ts:146-154 | server/test/game.test.ts:56, protocol/test/messages.test.ts:43,54 |
| No press is lost | A quick tap still fires | Verified | server/src/room.ts:224-225, 307-313 | server/test/game.test.ts:69, :80 |
| No press is lost | Holding keeps holding | Verified | server/src/room.ts:223 | server/test/game.test.ts:90 |
| Snapshots and events | Nothing missed between snapshots | Verified | server/src/room.ts:316-322, protocol/src/snapshot.ts | server/test/game.test.ts:119, :151 |
| Snapshots and events | New board, sent once | Verified | server/src/room.ts:317-321 | server/test/game.test.ts:170, :196 |
| Rooms and codes | A room is created | Verified | server/src/rooms.ts:48-59, protocol/src/codes.ts | server/test/rooms.test.ts:6, protocol/test/messages.test.ts:144 |
| Rooms and codes | Invalid options refused | Verified | server/src/rooms.ts:50 | server/test/rooms.test.ts:31 |
| Rooms and codes | Server busy | Verified | server/src/rooms.ts:52 | server/test/rooms.test.ts:39 |
| Rooms and codes | Codes ignore case | Verified | server/src/rooms.ts:43-46 | server/test/rooms.test.ts:53 |
| Joining | Joining a lobby | Verified | server/src/room.ts:141-146, 375-379 | server/test/rooms.test.ts:63 |
| Joining | Unknown code | Verified | server/src/rooms.ts:61-66 | server/test/rooms.test.ts:78 |
| Joining | Room already full | Verified | server/src/room.ts:143 | server/test/rooms.test.ts:86 |
| Seats and rejoining | Refresh mid-lobby | Verified | server/src/room.ts:152-172, 179-184 | server/test/rooms.test.ts:103, :118 |
| Seats and rejoining | Wrong token | Verified | server/src/room.ts:171 | server/test/rooms.test.ts:129 |
| Lobby | Host changes options | Verified | server/src/room.ts:348-356 | server/test/lobby.test.ts:5 |
| Lobby | No start without a guest | Verified | server/src/room.ts:215 | server/test/lobby.test.ts:50 |
| Lobby | Guest leaves the lobby | Verified | server/src/room.ts:179-184 | server/test/lobby.test.ts:60 |
| Lobby | Idle lobby expires | Verified | server/src/room.ts:249 | server/test/lobby.test.ts:80 |
| Starting and playing again | Play again keeps the room | Verified | server/src/room.ts:228-229, 326-346 | server/test/game.test.ts:228, :243 |
| Starting and playing again | Back to the lobby | Verified | server/src/room.ts:490-495 | server/test/game.test.ts:265 |
| Grace period for drops | Freeze and resume | Verified | server/src/room.ts:190-195, 381-424 | server/test/grace.test.ts:32, server/test/server.test.ts:189 |
| Grace period for drops | Out of time in Last One Standing | Verified | server/src/room.ts:270-283, 451-467 | server/test/grace.test.ts:100 |
| Grace period for drops | Out of time in Waves | Verified | server/src/room.ts:451-467 | server/test/grace.test.ts:124, :138 |
| Grace period for drops | Frozen means frozen | Verified | server/src/room.ts:285-295, 419-424 | server/test/grace.test.ts:54, :77 |
| Leaving on purpose | Leaving Last One Standing | Verified | server/src/room.ts:426-445 | server/test/leave-bot.test.ts:5 |
| Test bot | Playing the bot | Verified | server/src/room.ts:358-373, sim/src/ai/bot.ts | server/test/leave-bot.test.ts:92, server/test/server.test.ts:245 |
| Test bot | The bot fights the host in Last One Standing | Verified | sim/src/ai/bot.ts:14 | sim/test/bot.test.ts:36 |
| Test bot | Bot switched off | Verified | server/src/room.ts:359-365 | server/test/leave-bot.test.ts:140 |
| Configuration | Unknown site refused | Verified | server/src/server.ts:88-95 | server/test/server.test.ts:123 |
| Configuration | Bad setting | Verified | server/src/config.ts | server/test/config.test.ts:45, server/test/build.test.ts:86, server/test/server.test.ts:268 (QA also ran it on the build) |
| Health check | Healthy | Verified | server/src/server.ts:76-85 | server/test/server.test.ts:100 (QA also ran it on the build) |

### hosting

| Requirement | Scenario | Status | Code | Test |
|---|---|---|---|---|
| Naming a multiplayer server | Turning online play on | Verified | client/src/main.ts (`wireOnline`), server tag reading | client/test/net.test.ts:23, client/test/online-screens.test.ts:25 |
| Naming a multiplayer server | Static as ever | Verified | client/src/lobby.ts:89-94, main.ts (`hostOnline`, `openJoin`) | client/test/net.test.ts:30, client/test/online-screens.test.ts:34 |
| Join links come back to the host page | A link to the same page | Verified | client/src/lobby.ts:62-66 | client/test/lobby.test.ts:25 |
| Server build | Nothing else to install | Verified | src/server build config | server/test/build.test.ts:68 (QA also ran it from an empty folder) |
| Container image | Running the container | Verified by QA run (no automated test, which is reasonable for Docker) | Dockerfile | QA: `docker build` and `docker run`, then `/health` gave 200 |

### online-play

| Requirement | Scenario | Status | Code | Test |
|---|---|---|---|---|
| Hosting a game | Hosting | Verified | client/src/main.ts (`hostOnline`, `showLobby`), session.ts (`room`) | client/test/session.test.ts:111, client/test/online-screens.test.ts:65 |
| Hosting a game | Four AI won't fit | Verified | client/src/lobby.ts:23-36 | client/test/lobby.test.ts:55, client/test/online-screens.test.ts:51 |
| Hosting a game | Practice against the bot | Verified | client/src/session.ts (`playBot`), renderer `colorOf` | client/test/session.test.ts:197, client/test/e2e.test.ts:205, client/test/perspective.test.ts:27 |
| Hosting a game | No bot unless the server offers one | Verified | client/src/main.ts (`showLobby`) | client/test/session.test.ts:204, client/test/online-screens.test.ts:76 |
| Hosting a game | Friendly fire offered for Waves | Verified | client/src/lobby.ts:39-44, main.ts (`showModeOptions`) | client/test/lobby.test.ts:68, client/test/online-screens.test.ts:58 |
| Joining a game | Joining by link | Verified | client/src/lobby.ts:69-94, main.ts (`resumeOnline`) | client/test/net.test.ts:52, client/test/lobby.test.ts:103 |
| Joining a game | Joining by code | Verified | client/src/main.ts (`submitJoin`) | client/test/session.test.ts:122, client/test/e2e.test.ts:89 |
| Joining a game | Wrong code | Verified | client/src/session.ts:193-200 | client/test/session.test.ts:130 |
| Lobby | Options change under the guest | Verified | client/src/session.ts (`options`), main.ts (`showLobby`) | client/test/session.test.ts:169, client/test/e2e.test.ts:89 |
| Lobby | Can't start alone | Verified | client/src/session.ts (`start`), main.ts (`showLobby`) | client/test/session.test.ts:187 |
| Lobby | The host leaves | Verified | client/src/session.ts (`closed`) | client/test/session.test.ts:241, client/test/e2e.test.ts:89 |
| Playing online | Green for me, blue for you | Verified | client/src/renderer.ts:124-127, 338-341 | client/test/perspective.test.ts:27 |
| Playing online | Shared AI colours | Verified | client/src/renderer.ts:124-127 | client/test/perspective.test.ts:35 |
| No pausing online | Escape doesn't stop the game | Verified (source wiring test) + manual | client/src/main.ts (`onKeyDown`) | client/test/online-screens.test.ts:111 |
| No pausing online | Leaving deliberately | Verified | client/src/main.ts (`wireOnline`), session.ts (`leave`) | client/test/session.test.ts:283, client/test/online-screens.test.ts:135 |
| Dropped connections | A blip | Verified for a socket that closes (see Minor 2 and the manual checks) | client/src/net.ts:145-170, session.ts (`onOpen`) | client/test/session.test.ts:306, client/test/e2e.test.ts:139 |
| Dropped connections | Reload to rejoin | Verified | client/src/lobby.ts:89-94, session.ts (`rejoin`) | client/test/session.test.ts:330, client/test/e2e.test.ts:166 |
| Dropped connections | Gone for good | Verified | server/src/room.ts:270-283, client/src/lobby.ts:192-203 | server/test/grace.test.ts:100, client/test/session.test.ts:344 |
| Online results | One screen's win is the other's loss | Verified | client/src/lobby.ts:181-204 | client/test/lobby.test.ts:143 |
| Online results | The AI cleaned up | Verified | client/src/lobby.ts:207-217 | client/test/lobby.test.ts:154 |
| Online results | Forfeit spelled out | Verified | client/src/lobby.ts:192-202 | client/test/lobby.test.ts:172 |
| Online results | No online bests | Verified | client/src/main.ts (`onlineFrame`; only `onEvent` calls `recordBest`) | client/test/lobby.test.ts:183, client/test/online-screens.test.ts:152 |
| Playing again online | Rematch | Verified | client/src/session.ts (`playAgain`, :221-222), main.ts:494-513 | client/test/session.test.ts:369, :399, client/test/e2e.test.ts:89, :187 |
| Playing again online | The guest heads off | Verified | server/src/room.ts:481-488 | client/test/session.test.ts:392, server/test/game.test.ts:278 |
| Server trouble | Server down | Verified | client/src/net.ts:155-158, session.ts:193-200 (`onFailed`) | client/test/session.test.ts:152, :161, :220, :230, client/test/online-screens.test.ts:169 |

### game-client (modified)

| Requirement | Scenario | Status | Code | Test |
|---|---|---|---|---|
| Setup screen | Online only with a server | Verified | client/src/main.ts (`wireOnline`), markup | client/test/online-screens.test.ts:25 |
| Arena rendering | The other human is blue | Verified | client/src/renderer.ts:124-127, 339 | client/test/perspective.test.ts:47 |
| Arena rendering | A harmless clang | Verified | client/src/effects.ts (`friendlyHit`) | client/test/perspective.test.ts:67, :86 |
| Heads-up display | Your own numbers online | Verified | client/src/screens.ts (`hpPips`, `hudScore` and `mortarHud` take the viewer) | client/test/perspective.test.ts:107, :118 |
| Pause | Online games don't pause | Verified (source wiring test) + manual | client/src/main.ts (`autoPause`, `onlineFrame`) | client/test/online-screens.test.ts:123 |
| Setup, Arena, HUD, flow, Pause | The 30 unchanged single-player scenarios (Starting a game … Gamepad disconnect pauses) | Verified (regression) | unchanged local path in main.ts | Existing suites (screens, waves-screens, maps-screens, theme, input, gamepad, loop, sim goldens) all pass |

**Totals (97 scenarios, plus 1 proposed):** 97 Verified, including:
- 30 unchanged single-player regressions;
- 1 checked by a QA run rather than an automated test;
- 2 whose main.ts wiring is tested by matching source text, with manual checks below.

0 Implemented, untested. 0 Missing / wrong. The proposed scenario *Nobody to play again with* (see *Spec gaps*) is
already implemented and tested (session.test.ts:399, e2e.test.ts:187).

## Findings

### Implementation bugs (spec was right, code wasn't)

None outstanding.

**Fixed since the first run: a refused rejoin in the lobby left the player in a lobby that no longer exists.**
- `OnlineSession` now sets `awaitingSeat` when it sends create, join or rejoin (client/src/session.ts:164), and clears
  it on `room` (:182).
- A `refused` only counts as a lobby note when the session is in the lobby *and* isn't waiting for a seat (:196).
- Otherwise the session ends: "The game you were in has ended." for a rejoin refused as `noSuchGame` or `invalid`,
  and the usual refusal text for anything else.

Tests: client/test/session.test.ts:220 (room gone) and :230 (seat taken). My probe from the first run now ends with
`phase: ended`. Options refused in a live lobby still show as a note (the existing "a refused option is shown in the
lobby" test still passes).

### Spec gaps (spec wrong or incomplete)

**Now handled in code, but the spec still needs the addition: what the host gets after the guest leaves mid-game.**

What the implementation does:
- the host's session watches each snapshot for a `left` event for the other seat, and sets `guest` to false when it
  sees one (client/src/session.ts:221-222);
- `playAgain()` already needs `guest`, so nothing dead is sent;
- the result screen hides Play again, labels Settings "Back to the lobby", and says "The other player has left. Wait
  in the lobby for someone else to join, with the same code." (client/src/main.ts:494-513);
- with Play again hidden, the first visible result button ("Back to the lobby") gets focus, so the gamepad still
  works.

I also checked the case where the host is away when the guest leaves, so the snapshot with the `left` event never
reaches them. It's covered too: the `room` message on the host's rejoin carries `guest: false`
(server/src/room.ts:510-518).

Tests:
- client/test/session.test.ts:399;
- client/test/e2e.test.ts:187, against the real server: forfeit, then `guest` false, back to the lobby, and a new
  guest joins with the same code;
- the updated wiring test in client/test/online-screens.test.ts.

Neither spec says any of this. As agreed, the spec hasn't been changed without the developer's approval. This is the
addition I'd suggest.

In `specs/online-play/spec.md`, **Requirement: Playing again online**, add to the requirement text:

> If the guest left during the game (on purpose, or because their grace period ran out), the host's result screen
> SHALL NOT offer "Play again". It SHALL say that the other player has left, and offer to go back to the lobby, where
> the host waits for a player with the same code and link.

and add the scenario:

> #### Scenario: Nobody to play again with
> - **WHEN** the guest leaves mid-game and the host's result screen shows
> - **THEN** "Play again" isn't offered, the screen says the other player has left, and choosing "Back to the lobby"
>   puts the host in the lobby, waiting for a player, with the same code

To match, in `specs/game-server/spec.md`, **Requirement: Starting and playing again**, change "When a game ends, the
room SHALL stay open with both seats" to:

> When a game ends, the room SHALL stay open with the seats of the players still in it. A player who left during the
> game has given up their seat, so the host can only go back to the lobby until another player joins.

I haven't counted this as blocking, because the behaviour is now right and tested. It's a documentation gap that
should be closed, with the developer's approval, before `/opsx:archive`.

### Minor / suggestions (do not block)

These are unchanged from the first run.

1. **Garbage in: "as if it had no input" holds field by field, not for the whole message.** A message that won't
   parse is dropped, so whatever the player sent before keeps applying (latest wins). A badly typed field becomes
   idle while the others still count. That's what design.md describes, but the scenario wording ("behaves as if it
   had no input that tick") reads more strictly. Consider rewording the scenario.
2. **A real Wi-Fi blip may never be seen as a drop.** Detection relies on the socket closing or a missed ping (5 to
   10 s). A 3-second stall usually leaves TCP open, so there's no freeze, and the player's last controls keep
   applying, so a tank that was driving forward keeps driving. Consider treating a seat's controls as idle once
   they're older than 2 to 3 heartbeats (about 750 ms), here or in `net-feel`.
3. **The client's reconnect window is fixed at 20 s** (`RECONNECT_FOR_MS`), but `GRACE_SECONDS` can be set. A host
   who raises the grace will see clients give up early. The server could send its grace in `welcome`.
4. **The lobby doesn't show "Reconnecting…"** while a drop is being recovered.
5. **A rejoin briefly turns the session back into the lobby.** The `room` message calls `showLobby` before the
   `board` and `snap` messages arrive, so a reload mid-game may flash the setup panel for a frame.
6. **A host who refreshes on the result screen closes the room for both players.** This is what the spec says ("a
   drop after the game … needs no grace"), but it's harsh for an accident.
7. **Task 6.1:** the README's `az webapp create`, `config set` and `appsettings set` lines haven't been run (the task
   says so). They look right (`NODE:22-lts`, `--startup-file "npm start"`).
8. **The main.ts tests check source text** (`online-screens.test.ts`), so they break on any reformatting and don't
   run anything. The decisions themselves are well tested through `session.ts`, `lobby.ts` and `online.ts`.
9. **The client never checks `welcome.version`** against `PROTOCOL_VERSION`. A friendly "please refresh" for a
   cached old client would be cheap.

## Manual checks for the human

1. **Escape and the gamepad's Start online:** the menu opens, tanks, shells and the round timer keep moving behind
   it, and "Leave game" asks first.
2. **Hide the tab or switch windows mid-round online:** the game carries on, your tank gets no input, and no pause
   overlay appears.
3. **A real blip:** turn Wi-Fi off for about 3 s, then for about 12 s. Note whether the short one freezes at all
   (Minor 2). The long one should freeze both screens, count down, reconnect by itself and give a 3-2-1.
4. **Reload mid-game (host and guest):** back in the same tank after a 3-2-1. Look for a flash of the lobby (Minor 5).
5. **The fix for the mid-game leave:** in Last One Standing, the guest leaves mid-round. The host sees victory by
   forfeit, no Play again, the "other player has left" line, and "Back to the lobby" with focus on it (gamepad A
   works). In the lobby, the same code lets a new guest in. Repeat in Waves with the guest's grace running out.
6. **The fix for the dead lobby:** the host turns Wi-Fi off in the lobby for about 17 s, then back on. They should be
   back on the setup screen with "The game you were in has ended.", with single-player working.
7. **Lobby with keyboard and gamepad only:** reach the code, Copy link, options (host), Start, Play the test bot and
   Leave. The guest's options are read-only.
8. **The clang:** with friendly fire off in Waves, shoot your team-mate. You should see a small spark, no hit flash,
   and their HP unchanged on both screens.
