<!--
Suggested sessions, each ending somewhere checkable:
  A. Groups 1-3: protocol, bot helper, server rooms and shell, server build. Ends with a server that passes its tests
     and answers /health.
  B. Groups 4-5: client online core and screens. Ends with task 7.2: two tabs (and the bot) playing locally.
  C. Group 6, tasks 7.1 and 7.3: docs, full checks and the real App Service deployment. Then /qa and /opsx:archive.
-->

## 1. Foundations

- [x] 1.1 Create the `src/protocol` workspace (`@tank/protocol`), with tsconfig, a vitest project and lint coverage,
  and move `FixedStepLoop` and its tests into it from the client. Verify: `npm run typecheck` and `npm test` pass, and
  the client still runs its loop from the new package.
- [x] 1.2 In `@tank/protocol`, define every message type from the design, a parser that validates each message from
  either side (wrong types become idle or refused, unknown messages are dropped), the snapshot cut from a `MatchState`,
  and the room-code alphabet. Verify: unit tests for parsing good and bad messages, and that a snapshot holds exactly
  the dynamic fields and every event in order.
- [x] 1.3 Add `botInput(state, id)` to the sim: it drives a human tank with `think()`, with the other human hidden.
  Verify: a test that the bot never targets the other human, and that a two-player soak with a bot ends waves.

## 2. Server rooms (pure, fake clock)

- [x] 2.1 `Room` creation with option validation, codes, the room cap and case-insensitive lookup. Verify: tests for
  *A room is created*, *Invalid options refused*, *Server busy* and *Codes ignore case*.
- [x] 2.2 Joining, seats and tokens. Verify: tests for *Joining a lobby*, *Unknown code*, *Room already full*,
  *Refresh mid-lobby* and *Wrong token*.
- [x] 2.3 Lobby behaviour. Verify: tests for *Host changes options*, *No start without a guest*, *Guest leaves the
  lobby*, *Idle lobby expires*, and the host's lobby grace closing the room.
- [x] 2.4 Ticking, inputs and snapshots: the per-room accumulator, the press latches, 30 Hz snapshots carrying every
  event, and the board on change. Verify: tests for *Controls only*, *Garbage in*, *A quick tap still fires*, *Holding
  keeps holding*, *Nothing missed between snapshots* and *New board, sent once*.
- [x] 2.5 Start, play again and back to the lobby. Verify: tests for *Play again keeps the room* and *Back to the
  lobby*, and that each game gets a fresh seed.
- [x] 2.6 Grace, freeze, resume and expiry, including both players dropping and drops after the game. Verify: tests
  for *Freeze and resume*, *Out of time in Last One Standing*, *Out of time in Waves* and *Frozen means frozen*.
- [x] 2.7 Leaving on purpose, and the test bot. Verify: tests for *Leaving Last One Standing*, *Playing the bot* and
  *Bot switched off*.

## 3. Server shell

- [x] 3.1 Configuration from environment variables, with start-up validation and the open-origins warning. Verify:
  tests for *Bad setting* and the defaults.
- [x] 3.2 HTTP server with `/health`, a `ws` server with the origin check, the payload cap and ping-based drop
  detection, and the global ticker wiring sockets to rooms. Verify: in-process integration tests with real `ws`
  clients for *Healthy*, *Unknown site refused*, a full host-join-start-play-finish game, and a drop-and-rejoin.
- [x] 3.3 `build:server` (one bundled `server.js` plus its `package.json`) and `dev:server` (watch and restart).
  Verify: *Nothing else to install*, by starting the built folder from a temporary directory with no `node_modules`
  and getting `/health`.
- [x] 3.4 Dockerfile and `.dockerignore`. Verify: *Running the container*, if Docker is available on the machine;
  otherwise mark it for the developer's manual check.

## 4. Client: online core

- [x] 4.1 Server address from `<meta name="tank-command-server">`, or the Vite dev default; no connection at all
  without one. Verify: tests for *Static as ever* and *Turning online play on* (address resolution and that no socket
  is opened).
- [x] 4.2 `net.ts`: the connection, the reconnect loop with backoff, the per-tab seat store, rejoin on load, and the
  input sender with heartbeat. Verify: unit tests with a fake socket for reconnect timing, rejoin-before-join and input
  change/heartbeat sending.
- [x] 4.3 `online.ts`: the mirror `MatchState`, the snapshot buffer and 100 ms interpolation, events played in order,
  holding on underrun and jumping when far behind. Verify: unit tests for each.
- [x] 4.4 Perspective colours and the viewer's own data: `colorOf`, the "YOU" ring, HP, mortar and score helpers take
  the viewer's seat. Add the `friendlyHit` ricochet effect. Verify: tests for *Green for me, blue for you*, *Shared AI
  colours*, *The other human is blue*, *A harmless clang* and *Your own numbers online*; single-player screen tests
  unchanged.

## 5. Client: online screens

- [x] 5.1 Setup screen "Host online game" and "Join a game" (shown only with a server), the join-code dialog, and
  join links. Verify: tests for *Online only with a server*, *Joining by code*, *A link to the same page*, and that the
  `join` parameter is removed after joining.
- [x] 5.2 Host and guest lobbies: code, link and copy; options editable for the host and read-only for the guest;
  two-player limits and the "lowered to 3" note; the friendly-fire row; Start only with a guest; the bot option when
  offered; leaving. All usable by mouse, keyboard and gamepad. Verify: tests for *Hosting*, *Four AI won't fit*,
  *Friendly fire offered for Waves*, *Practice against the bot*, *No bot unless the server offers one*, *Options change
  under the guest*, *Can't start alone* and *The host leaves*.
- [x] 5.3 Online play loop: rendering from the mirror, no pause, the online menu with "Leave game", and the freeze
  overlay with countdown and 3-2-1. Verify: tests for *Escape doesn't stop the game*, *Leaving deliberately*, *Online
  games don't pause*, *A blip* and *Reload to rejoin* (client logic, with a fake connection).
- [x] 5.4 Online round banners, HUD and result screens from each player's point of view, including forfeit and the
  AI ribbing; no bests online; host and guest result choices. Verify: tests for *One screen's win is the other's loss*,
  *The AI cleaned up*, *Forfeit spelled out*, *No online bests*, *Rematch*, *The guest heads off* and *Gone for good*.
- [x] 5.5 Server trouble: messages for unreachable servers and refused joins, back to setup with single-player
  intact. Verify: tests for *Server down* and *Wrong code*.

## 6. Docs

- [ ] 6.1 README: online play for players; hosting the server with Zip Deploy to App Service (settings and the
  copy-paste `az webapp deploy` block), Docker, and localhost/LAN; the server tag; a note that rooms don't survive a
  redeploy, and to avoid iframes for online play. Verify: each documented command was run once while writing it.
- [x] 6.2 CLAUDE.md: record the multiplayer split (`two-player-sim` done, `net-play`, then `net-feel`) in the
  suggested change sequence. Verify: the section reads correctly.

## 7. Verification

- [x] 7.1 Full checks: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` and `npm run build`
  all pass, and the existing single-player golden runs are unchanged.
- [x] 7.2 Local end-to-end: `npm run dev:server` plus `npm run dev`, then a full game in each mode between two browser
  tabs, and one against the test bot, including a refresh mid-game. Verify: the developer plays it and confirms.
- [ ] 7.3 Deploy to the developer's App Service (new Web App, settings as in the README), point a host page at it,
  and play one online game for real. Verify: the developer confirms a game was played through the deployed server.
