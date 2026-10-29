## Context

- **The simulation is ready.** `two-player-sim` made the simulation two-player:
  - `createMatch` takes `humans: 2`;
  - `step()` takes inputs keyed by `p1`/`p2`;
  - `leave(state, id)` decides what a departure means.

  Match state is plain JSON, and `cloneState` already relies on that.
- **The client is built around a local match.** `main.ts` owns a `MatchState`, steps it with `FixedStepLoop`, and
  draws with `Renderer.draw(match, prev, alpha, effects, now)`. The HUD, banner and result text are pure functions
  of `MatchState` in `screens.ts`. Effects are driven by `SimEvent`s. Colours come from `colorIndex`, with index 0
  meaning "you".
- **Hosting is static.** The hosting spec promises a static, embeddable build. The theme already uses a
  `<meta name="tank-command-theme">` tag, so a second tag fits the established pattern.
- **Deployment target.** The developer's Azure Linux App Service plan, by Zip Deploy. Node 22 runtime. One instance
  (rooms live in memory).

## Goals / Non-Goals

**Goals:**
- An honest server-authoritative game over the internet, playable at UK household latencies without prediction.
- Room logic testable without sockets or real time, and the full server testable in-process with real WebSockets.
- No change to single-player behaviour or to what a static host page needs.
- A server that deploys as one zip with no install step.

**Non-Goals:**
- Prediction and reconciliation of your own tank (`net-feel`). Your own tank is drawn from snapshots like the others,
  so it lags by about one round trip plus the interpolation delay.
- Horizontal scaling, persistence across server restarts, metrics beyond `/health`.
- Defending against a hostile *player*, beyond validating inputs. Rooms are between friends, so a player pulling
  their cable to buy a freeze is accepted.

## Decisions

### Three packages: `@tank/protocol` between `@tank/sim`, `@tank/server` and `@tank/client`

```
            +--------------+
            |  @tank/sim   |   unchanged rules (+ one bot helper)
            +--------------+
              ^          ^
              |          |
     +-----------------------+
     |    @tank/protocol     |   message types, parse/validate, snapshot cut, room-code alphabet
     +-----------------------+
        ^                 ^
        |                 |
 +--------------+   +--------------+
 | @tank/client |   | @tank/server |   ws + http, rooms, ticking
 +--------------+   +--------------+
```

The protocol (message shapes, runtime validation, the function that cuts a `MatchState` down to a snapshot) is
needed by both ends, and belongs in neither the rules nor the server.

A small `src/protocol` workspace keeps the client from importing server code and keeps networking vocabulary out of
the sim. It has no dependencies beyond `@tank/sim` types.

- *Alternative:* put the protocol in the server and have the client import its types. Rejected: the client would
  depend on the server package, and runtime validation (which the client needs too, for messages from the server)
  would pull server code into the browser bundle.

### Room logic is a pure state machine; sockets are a thin shell

`Room` (in `src/server/src/room.ts`) holds:
- the options;
- the seats, each with a token, a connected/disconnected flag and grace deadlines;
- the lobby, game and result phases;
- the `MatchState`, and the per-seat input latches.

It's driven by method calls (`join`, `input`, `disconnect`, `start`, `leave`, `tick(now)`, …). It returns the
messages to send, as `{ seat, message }` records. Time is passed in, never read.

`server.ts` owns the HTTP server, the `ws` server, the global ticker and the map from connections to seats. It just
moves messages between sockets and rooms.

This mirrors the sim's own separation. Room behaviour (grace, freeze, lobby rules, expiry) is tested with a fake
clock in milliseconds, without sockets. A few integration tests start the real server on port 0 and drive it with
real `ws` clients.

### Ticking: one global timer, a fixed-step accumulator per room

- A single `setInterval` (about 4 ms) calls `room.tick(performance.now())` on every room.
- Each room accumulates time and runs `step()` at the sim's tick rate, capped at a few steps per call so a stall
  can't spiral.
- After every second step (30 Hz at 60 ticks per second), it emits a snapshot. A frozen room doesn't accumulate, so
  a freeze genuinely stops time.

The accumulator is the same arithmetic as the client's `FixedStepLoop`. That class moves to `@tank/protocol` (it
has no DOM in it), so both ends share it, and its tests move with it.

### Inputs: latest-wins, with press latches

- The client sends `{ t: 'input', throttle, turn, fire, mortar }` whenever its sampled input changes, and at least
  every 250 ms as a heartbeat.
- The room keeps each seat's latest input.
- For `fire` and `mortar` it also keeps a *pressed since last tick* latch. The tick sees the button held if either
  the latest input or the latch says so, then clears the latch.

That's what makes *No press is lost* hold: a tap of under 16 ms between ticks still reaches the sim as one held
tick. The sim's edge detection turns it into one shot. Validation is per field: wrong types become idle values, and
`turn` is left for the sim to clamp.

### Snapshots: dynamic state only; the board on change; events attached

A snapshot holds the fields that change during a game:
- `tick`, `phase`, `phaseTicks`, `round`, `roundsPlayed`;
- `scores`, `lastRoundOutcome`, `lastRoundScorers`;
- `result`, `winnerId`, `forfeit`, `waves`;
- `tanks`, `shells`, `mortarShells`;
- `events`: every `SimEvent` since the previous snapshot, in order.

It leaves out `boards`, `board`, `nav`, the RNG states and AI memory. `board` is sent in its own message when a game
starts, whenever `state.board.id` changes, and on rejoin. A typical snapshot is under 2 KB of JSON, so 30 Hz is
about 60 KB/s per player at peak. That's fine, and not worth a binary format yet.

On the client, an **online mirror** turns snapshots back into a `MatchState`-shaped object:
- `config`, `options` and `board` come from the room and board messages;
- the dynamic fields come from each snapshot.

The renderer, HUD and result helpers keep taking `MatchState`, and need only a "who am I" added.

- *Alternative:* a separate view-model type for rendering. Rejected for now: every screen helper would need
  rewriting, for no behaviour gain.

### Interpolation: draw about 100 ms in the past

The client keeps a short buffer of snapshots stamped with their arrival time. Each frame it renders at
`now - 100 ms`: it finds the two snapshots either side of that moment, passes them to the existing
`draw(curr, prev, alpha)` path, and plays each snapshot's events as it becomes current.

If the buffer runs dry (a late packet), it holds on the newest snapshot rather than extrapolating. If it falls far
behind (a hidden tab coming back), it jumps to the newest. The 100 ms is a constant, to be tuned by playtesting.

### Perspective colours are a client mapping

- The client knows its seat (`p1` or `p2`).
- `colorOf` maps `colorIndex` through a swap of 0 and 2 when the viewer is `p2`, so the sim's indices stay the
  host's view.
- "YOU" ring and label: drawn on the viewer's own tank (`HUMAN_ID` today becomes `you`).
- Your own data: the HUD's hit-point and mortar helpers and the result text take the viewer's id.

Single-player passes `p1` and is unchanged.

### Grace and reconnection

- **Detecting a drop:** the server pings each socket every 5 s and treats a missed pong, or a close, as a drop. App
  Service and other proxies also close idle sockets, and the 250 ms input heartbeat keeps a live one busy.
- **During the grace period:** the room freezes and tells the other seat `{ t: 'frozen', seat, until }`. It keeps
  the seat for `GRACE_SECONDS`.
- **Rejoining:** a connection that sends `{ t: 'rejoin', code, token }` gets the seat back, along with the board and
  the latest snapshot. The room then runs a 3-second `resuming` countdown, sent as `{ t: 'resume', at }`, before it
  unfreezes.
- **Grace runs out:** `leave(state, seat)`, then the normal result flow.
- **Client side:**
  - it stores `{ server, code, seat, token }` in `sessionStorage`, which is per tab, so two tabs on one machine can
    be host and guest when testing;
  - it reconnects with backoff (0.5 s, 1 s, 2 s, …) until the grace period has passed;
  - on page load, a stored seat for this server is tried before any `?join=`.

### The bot is a seat with no socket

`Room.addBot()` fills `p2` with a seat marked as a bot. Each tick, the bot's input comes from a new sim export,
`botInput(state, id)`: it runs `think()` for that tank, with the other human hidden from it (as the soak test does),
so the bot fights only the AI.

The bot seat never disconnects. Going back to the lobby frees it.

The server says whether bots are allowed in its `welcome` message, so the client only offers one when the server
can provide it.

- *Why in the sim:* `think` and its memory are sim internals. A one-function export keeps the server from reaching
  into `src/ai`.

### Messages

```
client -> server                        server -> client
----------------                        ----------------
hello                                   welcome  { bot: boolean, version }
create   { options }                    room     { code, seat, token, options, guest: boolean }
join     { code }                       refused  { reason: 'noSuchGame'|'full'|'started'|'busy'|'invalid', detail? }
rejoin   { code, token }                options  { options }                    (lobby, to the guest)
options  { options }       (host)       board    { board }
start                      (host)       snap     { ...snapshot, events }
bot                        (host)       frozen   { seat, until }
input    { throttle, turn, fire, mortar }
                                        resume   { at }
playAgain | toLobby        (host)       lobby    { guest: boolean }         (back to the lobby)
leave                                   closed   { reason: 'hostLeft'|'expired'|'gone' }
```

- Every message is JSON with a `t` field.
- Unknown or malformed messages are ignored.
- A message over 4 KB closes the socket, using `ws`'s `maxPayload`.
- Times in `frozen` and `resume` are milliseconds remaining, so client and server clocks never need to agree.

### Client structure

- `net.ts`: the connection, its reconnect loop and the seat store.
- `online.ts`: the mirror, the snapshot buffer and interpolation (pure, tested).
- `lobby.ts`: lobby and online-result text helpers (pure, tested).
- `markup.ts` gains the lobby, the join-code dialog, the online menu and the freeze overlay.
- `main.ts`'s `Game` gains a mode, `local` or `online`, so the loop either steps a local match or renders the mirror.

The local path is untouched.

The server address comes from:
- `<meta name="tank-command-server">`;
- or, in Vite dev with no tag, `ws://<page host>:8080`, which also makes LAN play work from `npm run dev`.

The join link is `new URL(location.href)` with `join=<code>` set. After joining, the client removes `join` with
`history.replaceState`, so a refresh rejoins by token instead.

### Build and deploy

- `build:server` runs Vite in SSR mode on `src/server/src/main.ts`, with `ssr.noExternal: true`, a Node 22 target
  and output `dist/server/server.js`. It writes a minimal `package.json` there:
  `{ "type": "module", "scripts": { "start": "node server.js" } }`.
- `ws`'s optional native add-ons (`bufferutil`, `utf-8-validate`) are marked external. `ws` falls back to plain
  JavaScript without them.
- `dev:server` uses Vite's build API in watch mode and restarts Node on each rebuild. A small script in the server
  package does this, so no new dev dependency is needed.
- The Dockerfile has two stages: `npm ci` plus `build:server` in a Node 22 image, then just `dist/server` in a slim
  Node 22 image, running `npm start`.
- App Service settings:
  - runtime stack Node 22 LTS;
  - startup command `npm start`;
  - `SCM_DO_BUILD_DURING_DEPLOYMENT=false`, WebSockets On, Always On, one instance;
  - `ALLOWED_ORIGINS` set to the page origin(s);
  - `PORT` is provided by the platform.

  Zip Deploy goes through `az webapp deploy --type zip`, and the README has it as a copy-paste block.

## Risks / Trade-offs

- [Your own tank lags without prediction] → UK-to-UK-South round trips are typically 20–40 ms, plus 100 ms of
  interpolation. That's noticeable but playable, and it's exactly what `net-feel` exists for. Keep the delay a
  constant, so playtests can tune it first.
- [`main.ts` grows a second mode and becomes hard to follow] → Push online state into `online.ts` and `lobby.ts`,
  keep the `Game` class as the conductor, and keep every decision in pure, tested helpers, as `screens.ts` already
  does.
- [Proxies or App Service drop idle WebSockets] → The input heartbeat and the server ping keep traffic flowing. The
  grace period absorbs any reconnect that happens anyway.
- [Clock-based tests are flaky] → Room tests use a fake clock. Integration tests assert on message sequences with
  generous timeouts, and never on wall-clock durations.
- [Single instance, in-memory rooms: a redeploy drops every game] → Accepted at this scale. The README says so.
- [A shared App Service plan with other sites] → Room cap, message size cap, and very modest CPU per room (measured
  in the soak tests).

## Migration Plan

- The client is backwards compatible: with no server tag, nothing changes for existing host pages.
- Deploying the server is additive: a new Web App on the existing plan. Rolling back means stopping that Web App and
  removing the tag.

## Open Questions

- An iframe-embedded game's join link points at the iframe's own address, not the outer page. The README advises
  against an iframe for online play for now. A `tank-command-join-url` tag could fix it later, without changing
  anything here.
- The interpolation delay and snapshot rate are starting values for playtesting, not decisions.
