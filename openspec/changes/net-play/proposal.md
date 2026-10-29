## Why

Two-player rules now live in the simulation (`two-player-sim`), but there's no way for two people on different
machines to play. This change adds the server and the client flows that make online two-player games real, and it
ends with the game running on a real server, because "works on localhost" isn't the same as "my friend can join".
Prediction of your own tank (`net-feel`) is left for a follow-up, so this change can concentrate on getting a correct,
fair game across the wire.

## What Changes

- **A multiplayer server** (new `src/server` workspace, Node): it runs the same `@tank/sim` code authoritatively,
  including the AI, at the simulation's fixed tick rate. Clients send inputs only, and the server broadcasts state
  snapshots and events. It handles rooms identified by short codes, a cap on concurrent rooms, idle lobby expiry, an
  origin allow-list, and a health endpoint. Configuration comes from environment variables only.
- **Rooms and the host-in-control flow:** on the setup screen the host chooses "Host online game" and gets a room
  code and a shareable link. The guest opens the link and sees the options, read-only. The host presses Start, and
  after the game "Play again" keeps the room together. There are no player names: you are green and they are blue.
- **Drops are forgiven:** if a player's connection drops mid-game, the game freezes on both screens for a grace period
  (15 seconds by default). A refresh or reconnect rejoins the same seat, and play resumes after a 3-2-1. If the grace
  period runs out, the player has left: a forfeit win in Last One Standing, or the other human carries on alone in
  Waves.
- **A test-bot opponent** behind a server setting (off by default): the host can play a real online game against a
  second "human" driven by the AI's own brain. It's useful for solo testing and as an end-to-end check of the server.
- **Client online mode:**
  - the "Host online game" button appears only when the host page names a server, so the static client still works
    anywhere on its own;
  - lobby screens for host and guest, and a join-by-link flow;
  - rendering from interpolated snapshots;
  - **perspective colours**: each player sees themselves green and the other human blue;
  - no pausing online;
  - a harmless "clang" for friendly-fire hits;
  - two-player result text, including how many rounds the AI took;
  - online games don't record a Waves best.
- **Deployment:**
  - `npm run build:server` bundles the server into a single file for Zip Deploy to an Azure App Service;
  - a Dockerfile for other self-hosters;
  - README sections for App Service, Docker and localhost/LAN play;
  - the deployment is done for real on the developer's App Service as the last step.
- **CLAUDE.md** records the multiplayer split (`two-player-sim` done, `net-play`, then `net-feel`).

## Capabilities

### New Capabilities

- `game-server`: the multiplayer server. Rooms and codes, the protocol contract (inputs in; snapshots and events
  out), authoritative simulation, the grace period and reconnection, configuration, the room cap and expiry, origin
  checks, health, and the test bot.
- `online-play`: the two-player online experience end to end. Hosting, joining by link, the lobby, starting, playing,
  drops and rejoining, leaving, and playing again.

### Modified Capabilities

- `game-client`:
  - the setup screen gains "Host online game";
  - online games draw perspective colours, don't pause, show friendly-fire clangs and two-player results, and don't
    record bests;
  - the HUD shows both humans' scores in two-player Last One Standing.
- `hosting`: a host page can name a multiplayer server with a `<meta>` tag. Without one, the game is single-player
  only, as now. The server has its own build and its own deployment.

## Impact

- **New workspace `src/server`:** Node, depends on `@tank/sim`, `@tank/protocol` and the `ws` WebSocket library
  (the one new runtime dependency). It's bundled with Vite, which is already a dev dependency, into `dist/server/server.js` with no
  `node_modules` to ship.
- **Client (`src/client`):**
  - new modules for the connection, the lobby screens and snapshot interpolation;
  - `main.ts` gains an online mode beside the local one;
  - the renderer takes a "who am I" for colours;
  - markup gains the lobby screens.
- **New workspace `src/protocol`:** the message types and validation shared by client and server, the snapshot cut,
  and the fixed-step accumulator (moved from the client).
- **Sim:** the rules are unchanged. One new export, `botInput`, drives a human seat with the AI's brain for the test
  bot.
- **Tests:**
  - server tests run a real server in-process with real WebSocket clients, covering rooms, the protocol, grace and
    rejoin, leave, the cap and expiry, and the bot;
  - client tests cover the lobby logic, interpolation and perspective colours.
- **Docs and ops:** README, a Dockerfile, a `.dockerignore` and CLAUDE.md. A new Web App on the developer's existing
  App Service plan (WebSockets on, Always On, one instance).
- **Not in this change:** client-side prediction (`net-feel`), public lobbies, more than two humans, accounts or
  names.
