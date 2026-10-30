# game-server Specification

## Purpose

The optional multiplayer server: it hosts two-player rooms, runs the shared simulation authoritatively (AI included),
takes only inputs from players, and sends them what to draw. It also forgives dropped connections, and is configured
and deployed simply enough for anyone running their own copy.

## Requirements

### Requirement: Authoritative simulation
For every game in progress, the server SHALL run the same simulation code as the single-player client, at the
simulation's fixed tick rate, including the AI tanks. Players SHALL send only their controls. The server SHALL NOT
accept positions, hits, scores or any other game state from a player. Controls that are malformed or out of range
SHALL be ignored or clamped as the simulation already does, and SHALL never stop the game.

#### Scenario: Controls only
- **WHEN** a player's client sends a message claiming its tank is at a different position, or that it scored a hit
- **THEN** the server ignores it and the game state is unchanged

#### Scenario: Garbage in
- **WHEN** a player sends a malformed message or a turn value that is not a number
- **THEN** the game carries on, and that player's tank behaves as if it had no input that tick

### Requirement: No press is lost
A fire or mortar press SHALL count, even if the button is pressed and released again between two server ticks. The
server SHALL treat a press seen at any time since the previous tick as held for the next tick. Otherwise the latest
controls a player sent SHALL apply until they send new ones.

#### Scenario: A quick tap still fires
- **WHEN** a player presses and releases fire within a single tick's interval
- **THEN** their tank fires on the next tick, if its cooldown allows

#### Scenario: Holding keeps holding
- **WHEN** a player sends forward throttle once and nothing more for a second
- **THEN** their tank drives forward for that second

### Requirement: Snapshots and events
While a game is in progress, the server SHALL send each player, at a fixed rate (30 per second by default), a
snapshot of everything needed to draw the arena and HUD:
- every tank, shell and mortar in flight;
- the phase and its countdown;
- the round or wave number, the scores and the waves cleared.

Every simulation event (shots, bounces, hits, friendly hits, mortars, eliminations, round, wave and game results)
SHALL reach each player exactly once and in order, even though several ticks pass between snapshots. The board SHALL
be sent when a game starts and whenever the board changes, not in every snapshot.

#### Scenario: Nothing missed between snapshots
- **WHEN** a shell bounces and hits a tank in the ticks between two snapshots
- **THEN** the next message carries both the bounce and the hit events, in that order

#### Scenario: New board, sent once
- **WHEN** a round ends and the next round is on a different board
- **THEN** each player is sent the new board once, before the snapshots of that round's countdown

### Requirement: Rooms and codes
A host SHALL be able to create a room by sending valid two-player match options. The server SHALL check them with
the simulation's own option rules and refuse invalid options with the reason. Each room SHALL get a code of 4
characters, drawn from letters and digits that can't be confused with each other (no 0/O or 1/I/L), unique among
the rooms open at the time. Codes SHALL be accepted in any letter case. The server SHALL refuse to create a room when
the configured maximum number of rooms (10 by default) is open, saying the server is busy.

#### Scenario: A room is created
- **WHEN** a host asks for a room with valid two-player Waves options
- **THEN** the server creates it and replies with a 4-character code that contains none of 0, O, 1, I or L

#### Scenario: Invalid options refused
- **WHEN** a host asks for a room with 4 AI opponents
- **THEN** no room is created and the reply gives the reason

#### Scenario: Server busy
- **WHEN** the maximum number of rooms is open and another host asks for one
- **THEN** no room is created and the reply says the server is busy

#### Scenario: Codes ignore case
- **WHEN** a guest joins room `KTXW` using the code `ktxw`
- **THEN** they join that room

### Requirement: Joining
A guest SHALL be able to join an open room by its code while the room is in its lobby. The server SHALL refuse a
join, with a reason the client can show, when the code doesn't match an open room, when the room already has a
guest, or when its game has started.

#### Scenario: Joining a lobby
- **WHEN** a guest joins a room whose host is waiting
- **THEN** both are told the room is full and ready, and the guest is sent the room's options

#### Scenario: Unknown code
- **WHEN** a guest tries a code no open room has
- **THEN** the join is refused with "no such game"

#### Scenario: Room already full
- **WHEN** a third player tries to join a room that has a host and a guest
- **THEN** the join is refused with "game is full"

### Requirement: Seats and rejoining
On creating or joining a room, a player SHALL be given a seat and a secret seat token. The host is always the first
human (`p1`) and the guest the second (`p2`). A connection presenting a valid token for a room SHALL take over that
seat, whether or not the old connection has been closed, so a refresh or a new connection gets the player back in.
A token SHALL only ever work for its own room and seat.

#### Scenario: Refresh mid-lobby
- **WHEN** the guest reloads the page while waiting in the lobby and their client presents its token
- **THEN** they are back in the same room as the guest, without the host doing anything

#### Scenario: Wrong token
- **WHEN** a connection presents a token that doesn't belong to the room it names
- **THEN** it is refused and no seat changes hands

### Requirement: Lobby
While a room is in its lobby:
- the host SHALL be able to change the options, and the guest SHALL be sent each change;
- only the host SHALL be able to start, and only once a guest is present;
- a guest who disconnects SHALL free the seat at once, and the host SHALL be told they are waiting again;
- a host who disconnects and doesn't return within the grace period SHALL close the room, and the guest SHALL be told
  the host has left;
- a lobby that has had no game start for the configured idle time (30 minutes by default) SHALL be closed, and its
  players told why.

#### Scenario: Host changes options
- **WHEN** the host switches mortars off while the guest is in the lobby
- **THEN** the guest is sent the new options

#### Scenario: No start without a guest
- **WHEN** the host asks to start a room with no guest
- **THEN** nothing starts

#### Scenario: Guest leaves the lobby
- **WHEN** the guest closes their tab in the lobby
- **THEN** the seat is free again, the host is told, and another guest can join with the same code

#### Scenario: Idle lobby expires
- **WHEN** a room has waited in its lobby for longer than the idle time
- **THEN** it is closed and its code no longer works

### Requirement: Starting and playing again
When the host starts, the server SHALL create a two-player match from the room's options with a fresh random seed,
and both players SHALL see the same first countdown. When a game ends, the room SHALL stay open with the seats of the
players still in it. A player who left during the game has given up their seat, so the host can only go back to the
lobby until another player joins. The host SHALL be able to play again with the same options, or go back to the lobby
to change them, and the guest SHALL be taken along either way.

#### Scenario: Play again keeps the room
- **WHEN** a game ends and the host chooses to play again
- **THEN** a new game starts for the same two players, without anyone rejoining

#### Scenario: Back to the lobby
- **WHEN** a game ends and the host chooses to change the settings
- **THEN** both players are back in the room's lobby, and the host can change the options and start again

### Requirement: Grace period for drops
When a player's connection drops during a game, from the first countdown until the game is over, the server SHALL
freeze that game: no ticks run, so nothing moves and no timers count down. The other player SHALL be told who dropped
and how long the grace period has left (15 seconds by default). If the player reconnects within the grace period, the
server SHALL send them the current board and state, run a 3-second resume countdown visible to both players, and then
carry on from exactly where the game froze. If the grace period runs out, that player SHALL leave the match, with the
consequences the game mode sets (see the `waves` and `last-one-standing` specs). If both players drop, the game SHALL
stay frozen until one returns, and the room SHALL close when both grace periods have run out.

A drop after the game is over SHALL need no grace: if the host has gone the room SHALL close once the guest has been
told, and if the guest has gone the host SHALL be back in the lobby, waiting for a player.

#### Scenario: Freeze and resume
- **WHEN** the guest's connection drops mid-round and they reconnect 5 seconds later
- **THEN** the game freezes for both, both see a 3-second countdown after the guest is back, and play resumes with
  every tank and shell where it was when it froze

#### Scenario: Out of time in Last One Standing
- **WHEN** the guest's connection drops mid-round and doesn't return within the grace period
- **THEN** the host wins by forfeit

#### Scenario: Out of time in Waves
- **WHEN** the host's connection drops mid-wave and doesn't return within the grace period
- **THEN** the game carries on for the guest alone

#### Scenario: Frozen means frozen
- **WHEN** a game is frozen for a drop
- **THEN** the round countdown, mortar slows and shells in flight are all exactly as they were until it resumes

### Requirement: Leaving on purpose
A player SHALL be able to leave a game in progress straight away, without a grace period. Their leaving SHALL have
the same consequences as a grace period running out.

#### Scenario: Leaving Last One Standing
- **WHEN** the guest chooses to leave mid-round
- **THEN** the host wins by forfeit at once

### Requirement: Test bot
When the server's test-bot setting is on, a host waiting in the lobby SHALL be able to fill the second seat with a
bot, which starts the game at once. The bot is driven by the same brain as the AI tanks and uses no network
connection, so it never drops. In Waves it is the host's team-mate and treats only AI tanks as its enemies. In Last One
Standing, where it's every tank for itself, it fights every tank, the host included. The room SHALL otherwise behave as any other, including
playing again, and going back to the lobby frees the bot's seat. The server SHALL tell clients whether the bot is
available. When the setting is off (the default), the server SHALL refuse a bot.

#### Scenario: Playing the bot
- **WHEN** the test bot is enabled and a host in the lobby asks for the bot
- **THEN** a two-player game starts with the host as the first human and the bot as the second, driving and shooting
  at the AI tanks

#### Scenario: The bot fights the host in Last One Standing
- **WHEN** a Last One Standing round against the bot is down to the host and the bot
- **THEN** the bot goes after the host, as an AI tank would

#### Scenario: Bot switched off
- **WHEN** the test bot is not enabled and a host asks for the bot
- **THEN** the request is refused

### Requirement: Configuration
The server SHALL take all its settings from environment variables:

| Variable | Default |
|---|---|
| `PORT` | 8080 |
| `ALLOWED_ORIGINS` | unset |
| `MAX_ROOMS` | 10 |
| `GRACE_SECONDS` | 15 |
| `LOBBY_IDLE_MINUTES` | 30 |
| `TEST_BOT` | off |

An invalid value SHALL stop the server at start-up with a message naming the variable. `ALLOWED_ORIGINS` is a
comma-separated list of the page origins whose players may connect. When it is set, connections from any other
origin SHALL be refused. When it is unset, every origin SHALL be allowed, and the server SHALL warn at start-up that
it should be set on a public server.

#### Scenario: Unknown site refused
- **WHEN** `ALLOWED_ORIGINS` is `https://example.com` and a page on `https://other.example` tries to connect
- **THEN** the connection is refused

#### Scenario: Bad setting
- **WHEN** the server starts with `MAX_ROOMS=lots`
- **THEN** it exits at once with a message saying `MAX_ROOMS` is invalid

### Requirement: Health check
The server SHALL answer an HTTP `GET /health` with status 200 and the number of rooms open, so a hosting platform can
check it's alive.

#### Scenario: Healthy
- **WHEN** a monitor requests `/health`
- **THEN** it gets status 200 and a body that includes the number of open rooms
