## Purpose

Two people on different machines playing one game: the host sets it up and shares a link or code, the guest joins,
and they play either mode together over a multiplayer server (see the `game-server` spec), with dropped connections
forgiven and a rematch a button away.

## ADDED Requirements

### Requirement: Hosting a game
When the host page names a multiplayer server (see the `hosting` spec), the setup screen SHALL offer "Host online
game" beside Start. Choosing it SHALL use the options on the setup screen as a two-player game:
- the AI limits SHALL be those for two humans (1 to 3);
- Waves SHALL also offer friendly fire, off by default;
- the screen SHALL say so where an option had to change to fit, for example 4 AI lowered to 3.

The host SHALL then see a lobby showing the room code, a link to the game that joins the room, a control that copies
the link, and that they are waiting for a player. When the server has its test bot switched on, the lobby SHALL also
offer "Play the test bot", which starts the game at once with the bot as the second player.

#### Scenario: Hosting
- **WHEN** the host chooses Waves with 2 AI and chooses "Host online game"
- **THEN** a lobby shows a room code, a join link containing it, a copy control, and "Waiting for a player"

#### Scenario: Four AI won't fit
- **WHEN** the setup screen has 4 AI opponents and the host chooses "Host online game"
- **THEN** the online game is set up with 3 AI opponents, and the screen says the number was lowered for two players

#### Scenario: Practice against the bot
- **WHEN** the server has its test bot on and the host chooses "Play the test bot" in the lobby
- **THEN** an online game starts with the host in green and the bot's tank in blue

#### Scenario: No bot unless the server offers one
- **WHEN** the server's test bot is off
- **THEN** the lobby doesn't offer it

#### Scenario: Friendly fire offered for Waves
- **WHEN** the host is setting up an online Waves game
- **THEN** a friendly-fire option is shown, set to off

### Requirement: Joining a game
A guest SHALL be able to join with the link or the code:
- opening the host's link SHALL take the guest straight to joining that room;
- the setup screen SHALL also offer "Join a game", where the code can be typed (for when it's read out over the
  phone).

While joining, the guest SHALL see the room's options, read-only, and that they are waiting for the host to start.
If the join is refused, the guest SHALL be told why (no such game, game is full, game already started, or server
busy) and returned to the setup screen, where single-player still works.

#### Scenario: Joining by link
- **WHEN** a guest opens the host's link
- **THEN** they see the game's mode and options and "Waiting for the host to start", and the host sees that a player
  has joined

#### Scenario: Joining by code
- **WHEN** a guest chooses "Join a game" and types the host's code in lower case
- **THEN** they join the host's room

#### Scenario: Wrong code
- **WHEN** a guest types a code that doesn't match an open game
- **THEN** they are told there is no such game and are back on the setup screen

### Requirement: Lobby
In the lobby:
- the host SHALL be able to change the options, and the guest SHALL see each change straight away;
- the host's Start SHALL be available only once a guest has joined;
- either player SHALL be able to leave, back to the setup screen;
- the guest SHALL be told if the host leaves, and the host SHALL be told if the guest leaves, going back to waiting
  for a player.

All of this SHALL be usable with the mouse, the keyboard and the gamepad, like the setup screen.

#### Scenario: Options change under the guest
- **WHEN** the host changes the rounds from 5 to 3 while the guest waits
- **THEN** the guest's lobby shows 3 rounds

#### Scenario: Can't start alone
- **WHEN** the host is waiting for a player
- **THEN** Start can't be chosen

#### Scenario: The host leaves
- **WHEN** the host leaves the lobby while the guest waits
- **THEN** the guest is told the host has left and is back on the setup screen

### Requirement: Playing online
When the host starts, both players SHALL see the same countdown and play the same game. Each player SHALL drive
their own tank with the usual controls. Their own tank SHALL be green with the "YOU" ring and label, the other human's
tank SHALL be blue, and each AI tank SHALL be the same colour on both screens. Other tanks' movement SHALL look
smooth, however irregularly updates arrive.

#### Scenario: Green for me, blue for you
- **WHEN** an online game is in play
- **THEN** on the host's screen the host's tank is green and the guest's is blue, and on the guest's screen the
  guest's tank is green and the host's is blue

#### Scenario: Shared AI colours
- **WHEN** an online game has 3 AI tanks
- **THEN** each AI tank has the same colour on both screens, and none is blue

### Requirement: No pausing online
An online game SHALL NOT pause. Escape or the gamepad's Start SHALL open a small menu that says the game keeps going
and offers "Leave game" (with a confirmation) and "Back to the game". Hiding the tab or losing focus SHALL NOT pause
the game or open the menu. The player's own tank simply gets no input while they're away.

#### Scenario: Escape doesn't stop the game
- **WHEN** a player presses Escape during an online round
- **THEN** the menu appears, and the tanks, shells and timers carry on moving behind it

#### Scenario: Leaving deliberately
- **WHEN** a player chooses "Leave game" and confirms
- **THEN** they leave at once, and the other player sees the consequence (a forfeit win in Last One Standing,
  carrying on alone in Waves)

### Requirement: Dropped connections
When either player's connection drops during a game, both screens SHALL show that the game is frozen and how many
seconds are left for the player to come back. The player who dropped SHALL be told they are reconnecting. Their
client SHALL try to reconnect by itself, and a page reload SHALL also rejoin the same seat. When the player is back,
both screens SHALL show a 3-2-1 before play resumes. If the time runs out, the player who stayed SHALL see the
outcome. The player who dropped SHALL see, when they next connect, that the game went on without them.

#### Scenario: A blip
- **WHEN** the guest's Wi-Fi drops for 3 seconds mid-round
- **THEN** both screens show the game frozen with a countdown, the guest's client reconnects by itself, and after a
  3-2-1 the round carries on where it stopped

#### Scenario: Reload to rejoin
- **WHEN** the host reloads the page mid-game
- **THEN** they are back in the same game, in the same tank, after a 3-2-1

#### Scenario: Gone for good
- **WHEN** the guest's connection drops in Last One Standing and doesn't come back in time
- **THEN** the host's screen shows they have won by forfeit

### Requirement: Online results
At the end of each round and game, each player SHALL see the result from their own point of view.
- **Last One Standing:**
  - round results say whether they won the round, the other human won it, the AI won it, the point was shared, or
    nobody scored;
  - the score SHALL read "You N – M Them";
  - the final result SHALL be a win, loss or draw for that player, saying so when it was won by forfeit;
  - when the AI won rounds, the result SHALL say how many, with a little light ribbing for the pair of them.
- **Waves:** the result SHALL show the waves the team cleared. Online games SHALL NOT record a best on this device.

The guest SHALL see that the host decides what's next.

#### Scenario: One screen's win is the other's loss
- **WHEN** an online Last One Standing game ends 3–1 to the host
- **THEN** the host's screen shows a win, "You 3 – 1 Them", and the guest's shows a loss, "You 1 – 3 Them"

#### Scenario: The AI cleaned up
- **WHEN** an online 3-round game ends 0–0 after the AI won all three rounds
- **THEN** both screens show a draw and mention that the AI took all 3 rounds

#### Scenario: Forfeit spelled out
- **WHEN** the guest leaves and the host wins by forfeit
- **THEN** the host's result says they won by forfeit

#### Scenario: No online bests
- **WHEN** an online Waves game ends with more waves cleared than the best on either player's device
- **THEN** neither device's best changes

### Requirement: Playing again online
On the result screen the host SHALL be offered "Play again" (same options) and "Settings" (back to the lobby, where
they can change the options). The guest SHALL see "Waiting for the host" and SHALL be taken along to whichever the
host chooses. Either player SHALL be able to leave the room instead. If the host leaves, the guest SHALL be told and
returned to the setup screen. If the guest leaves, the host SHALL be back in the lobby, waiting for a player, with the
same code.

If the guest left during the game (on purpose, or because their grace period ran out), the host's result screen
SHALL NOT offer "Play again". It SHALL say that the other player has left, and offer to go back to the lobby, where
the host waits for a player with the same code and link.

#### Scenario: Rematch
- **WHEN** the host chooses "Play again" after an online game
- **THEN** a new game's countdown starts on both screens with the same options

#### Scenario: The guest heads off
- **WHEN** the guest leaves after a game
- **THEN** the host is in the lobby, waiting for a player, with the same code and link

#### Scenario: Nobody to play again with
- **WHEN** the guest leaves mid-game and the host's result screen shows
- **THEN** "Play again" isn't offered, the screen says the other player has left, and choosing "Back to the lobby"
  puts the host in the lobby, waiting for a player, with the same code

### Requirement: Server trouble
If the server can't be reached when hosting or joining, or the connection can't be restored, the player SHALL be told
plainly, and SHALL be back on the setup screen with single-player play unaffected.

#### Scenario: Server down
- **WHEN** the host chooses "Host online game" and the server doesn't answer
- **THEN** a message says the online server isn't available, and Start still starts a single-player game
