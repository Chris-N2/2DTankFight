# achievements Specification

## Purpose

Rewards players for the funny, clever and difficult things that happen in a game (bank shots, mutual destruction,
long Waves runs) with a set of achievements. Each player earns them on their own device, they are kept between
visits, and there is a screen listing them all.

## Requirements

### Requirement: The achievement list
The game SHALL have exactly these 20 achievements, each with a name and a one-line description of what earns it.
**Where** says which games can earn it: *single-player*, *two-player* (an online game with two humans) or *any*.

| # | Name | Earned by | Where |
|---|---|---|---|
| 1 | Taunted | Being destroyed in Waves before a single wave is cleared | any |
| 2 | Last One Standing | Winning a game of Last One Standing | any |
| 3 | Surfer | Clearing a wave in Waves | any |
| 4 | MADness | Going down in the same instant as the last of your opponents | any |
| 5 | Mudslinger | Bogging down at least two other tanks with one mortar | any |
| 6 | Banked | Destroying an enemy with a bank shot | any |
| 7 | Perfection | Winning a round or clearing a wave without being hit by a shell | any |
| 8 | Pacifist | Winning a round of Last One Standing without firing a shell | any |
| 9 | Stop Hitting Yourself | Clearing a wave of Waves without firing a shell | single-player |
| 10 | With Friends Like This… | Playing a game of Last One Standing to the end | two-player |
| 11 | Friends with Benefits | Playing a game of Waves to the end | two-player |
| 12 | Ride the Wave | Clearing 5 waves in one game of Waves | single-player |
| 13 | Completionist | Winning a round or clearing a wave on every board, in both modes | any |
| 14 | Why Are You So Obsessed with Me? | Drawing a game of Last One Standing in which the AI won at least one round | two-player |
| 15 | You Can Take That to the Bank | Destroying all four AI tanks of a wave with bank shots | single-player |
| 16 | Inconceivable! | Clearing 8 waves in one game of Waves | single-player |
| 17 | Dream Team | Clearing 9 waves in one game of Waves | two-player |
| 18 | Gluttons for Punishment | Playing a game of Waves to the end with friendly fire on | two-player |
| 19 | Unfair Advantage | Destroying an AI tank in Waves while mud has jammed its turret | any |
| 20 | Close Shave | Winning a round or clearing a wave with 1 armour left | any |

The wording shown to players MAY differ from this table, but SHALL say what earns the achievement.

#### Scenario: Every achievement is listed
- **WHEN** the player opens the Achievements screen
- **THEN** it lists all 20 achievements in the order of the table, each with its name and description

### Requirement: Whose achievements, and in which games
Each player SHALL earn achievements for themselves, on their own device, from the game as they played it. "You"
below means the player whose device it is: the only human in a single-player game, or that player's own seat in an
online game. Achievements SHALL be earned in local single-player games and in online two-player games. A
*two-player game* is one that started with two humans, even if one of them has since left. Games against the
server's test bot SHALL NOT earn any achievements.

These terms SHALL be used throughout:
- **Winning a round** (Last One Standing): the round ends with you as its only scorer, still in play.
- **Clearing a wave** (Waves): the wave is cleared and you are still in play at the end of it.
- **Your opponents**: in Last One Standing every other tank; in Waves the AI tanks.

#### Scenario: Each player earns their own
- **WHEN** in an online Waves game one player destroys an AI tank with a bank shot
- **THEN** that player earns Banked and the other player does not

#### Scenario: Shared credit for shared goals
- **WHEN** two players finish an online Waves game together
- **THEN** both earn Friends with Benefits, each on their own device

#### Scenario: Partner left
- **WHEN** an online Waves game started with two humans, one leaves, and the other plays on alone to 5 cleared waves
- **THEN** the game still counts as two-player, so Ride the Wave is not earned

#### Scenario: Not against the test bot
- **WHEN** the host plays the server's test bot
- **THEN** nothing they do in that game earns an achievement

#### Scenario: Refreshing during a bot game
- **WHEN** the host refreshes the page during a game against the test bot and is let back in
- **THEN** that game still earns nothing, and neither does "Play again" with the bot

#### Scenario: A dead partner's wave
- **WHEN** in a two-player Waves game you are destroyed and your partner clears the wave
- **THEN** you have not cleared that wave for Perfection, Close Shave, Stop Hitting Yourself or Completionist, but
  the game's cleared-wave count still goes up for Surfer and Dream Team

### Requirement: Taunted
You SHALL earn Taunted when a Waves game ends with no waves cleared (the "Everybody starts somewhere" result),
however you were destroyed.

#### Scenario: Out on wave 1
- **WHEN** a Waves game ends during wave 1
- **THEN** you earn Taunted

#### Scenario: Hoisted on wave 1
- **WHEN** a Waves game ends during wave 1 because your own bounced shell destroyed you
- **THEN** you still earn Taunted

#### Scenario: Got going first
- **WHEN** a Waves game ends after at least one wave was cleared
- **THEN** you do not earn Taunted

### Requirement: Last One Standing
You SHALL earn Last One Standing when a game of Last One Standing ends with you as its winner. A win by forfeit
SHALL NOT count.

#### Scenario: Winning the game
- **WHEN** a single-player Last One Standing game ends as a win
- **THEN** you earn Last One Standing

#### Scenario: Two-player win
- **WHEN** a two-player Last One Standing game ends with you as the winner on points
- **THEN** you earn Last One Standing and the other player does not

#### Scenario: Forfeit
- **WHEN** the other player leaves and you win by forfeit
- **THEN** you do not earn Last One Standing

### Requirement: Surfer
You SHALL earn Surfer when a wave of a Waves game you are playing is cleared.

#### Scenario: First wave cleared
- **WHEN** wave 1 is cleared
- **THEN** you earn Surfer

### Requirement: MADness
You SHALL earn MADness when a round or wave ends with no tank left in play and you were destroyed in its final tick.
In Last One Standing that is a mutual destruction or a shared point; in Waves it is the last human going down in the
same tick as the last AI tank.

#### Scenario: Mutual destruction in single-player
- **WHEN** you and the last AI tank are destroyed in the same tick of a Last One Standing round
- **THEN** you earn MADness

#### Scenario: Shared point
- **WHEN** both humans are destroyed in the final tick of a Last One Standing round with no AI tank left
- **THEN** both players earn MADness

#### Scenario: Taking the last one with you in Waves
- **WHEN** you and the last AI tank of a wave are destroyed in the same tick, ending the game
- **THEN** you earn MADness

#### Scenario: Already gone
- **WHEN** you were destroyed earlier in the round, and later the other human and the last AI tank destroy each
  other
- **THEN** the other player earns MADness and you do not

#### Scenario: Someone survived
- **WHEN** you are destroyed in the same tick as an opponent but another tank is still in play
- **THEN** you do not earn MADness

### Requirement: Mudslinger
You SHALL earn Mudslinger when one of your mortars lands and slows at least two tanks other than your own.

#### Scenario: Two in the mud
- **WHEN** your mortar's splash slows two other tanks
- **THEN** you earn Mudslinger

#### Scenario: Yourself doesn't count
- **WHEN** your mortar's splash slows one other tank and your own
- **THEN** you do not earn Mudslinger

### Requirement: Banked
You SHALL earn Banked when a shell of yours that had bounced destroys one of your opponents, or in two-player Last
One Standing, the other human.

#### Scenario: Bank-shot kill
- **WHEN** your shell bounces off a wall and destroys an opponent
- **THEN** you earn Banked

#### Scenario: Straight shot
- **WHEN** your shell destroys an opponent without bouncing
- **THEN** you do not earn Banked

#### Scenario: Not your partner
- **WHEN** in two-player Waves with friendly fire on, your bounced shell destroys the other human
- **THEN** you do not earn Banked

#### Scenario: Not yourself
- **WHEN** your bounced shell destroys your own tank
- **THEN** you do not earn Banked

### Requirement: Perfection
You SHALL earn Perfection when you win a round or clear a wave without having been hit by any shell during it,
including your own, the other human's and a hit from friendly fire. A harmless "friendly hit" with friendly fire off
SHALL NOT count as being hit.

#### Scenario: Untouched
- **WHEN** you win a round without being hit
- **THEN** you earn Perfection

#### Scenario: One scratch
- **WHEN** you clear a wave after taking one hit during it
- **THEN** you do not earn Perfection

#### Scenario: Harmless clang
- **WHEN** with friendly fire off the other human's shell touches you, and you clear the wave without any other hit
- **THEN** you earn Perfection

### Requirement: Pacifist
You SHALL earn Pacifist when you win a round of Last One Standing without having fired a shell during it. Launching
a mortar SHALL NOT count as firing a shell.

#### Scenario: Let them sort it out
- **WHEN** you win a Last One Standing round having fired no shell
- **THEN** you earn Pacifist

#### Scenario: Mud is allowed
- **WHEN** you win a Last One Standing round having launched a mortar but fired no shell
- **THEN** you earn Pacifist

#### Scenario: One shot
- **WHEN** you win a Last One Standing round having fired one shell
- **THEN** you do not earn Pacifist

### Requirement: Stop Hitting Yourself
In a single-player Waves game, you SHALL earn Stop Hitting Yourself when you clear a wave without having fired a shell
during it, so every AI tank was destroyed by an AI shell (its own or another's). Launching a mortar SHALL NOT count
as firing a shell.

#### Scenario: They did it to themselves
- **WHEN** in single-player Waves you clear a wave having fired no shell
- **THEN** you earn Stop Hitting Yourself

#### Scenario: Not with a friend
- **WHEN** in two-player Waves you clear a wave having fired no shell
- **THEN** you do not earn Stop Hitting Yourself

### Requirement: Playing two-player games to the end
In a two-player game, you SHALL earn these when the game ends, win, lose, draw or forfeit, while you are still in it:
- With Friends Like This… for a game of Last One Standing;
- Friends with Benefits for a game of Waves;
- Gluttons for Punishment for a game of Waves with friendly fire on.

#### Scenario: Last One Standing together
- **WHEN** a two-player Last One Standing game ends, whoever won
- **THEN** both players earn With Friends Like This…

#### Scenario: Waves with friendly fire
- **WHEN** a two-player Waves game with friendly fire on ends
- **THEN** both players earn Friends with Benefits and Gluttons for Punishment

#### Scenario: Waves without friendly fire
- **WHEN** a two-player Waves game with friendly fire off ends
- **THEN** both players earn Friends with Benefits but not Gluttons for Punishment

#### Scenario: The one who stayed
- **WHEN** the other player leaves a two-player Last One Standing game and you win by forfeit
- **THEN** you earn With Friends Like This…

#### Scenario: The one who left
- **WHEN** you leave a two-player game before it ends
- **THEN** you earn none of these for that game

### Requirement: Waves milestones
You SHALL earn these when the number of waves cleared in one Waves game reaches the target:
- Ride the Wave: 5 waves, in a single-player game;
- Inconceivable!: 8 waves, in a single-player game;
- Dream Team: 9 waves, in a two-player game.

The count SHALL be the game's waves-cleared score, whatever the starting number of AI tanks.

#### Scenario: Five in one go
- **WHEN** a single-player Waves game reaches 5 cleared waves
- **THEN** you earn Ride the Wave, at the end of the fifth wave rather than at game over

#### Scenario: Inconceivable
- **WHEN** a single-player Waves game reaches 8 cleared waves
- **THEN** you earn Inconceivable!

#### Scenario: Dream Team
- **WHEN** a two-player Waves game reaches 9 cleared waves
- **THEN** both players earn Dream Team

#### Scenario: Not across games
- **WHEN** you clear 3 waves in one single-player game and 3 in the next
- **THEN** you do not earn Ride the Wave

### Requirement: Completionist
You SHALL earn Completionist once you have won a round of Last One Standing on every built-in board and cleared a
wave of Waves on every built-in board. These can be spread over any number of games and visits, and each one SHALL
be remembered as it happens. The Achievements screen SHALL show how far you have got (for example "9 of 14") until
it is earned.

#### Scenario: Progress is kept
- **WHEN** you win a Last One Standing round on Pac-Tank, then close the browser and come back
- **THEN** that board counts towards Completionist for Last One Standing

#### Scenario: Both modes needed
- **WHEN** you have won a round on every board in Last One Standing, but have not cleared a wave on Checkerboard
- **THEN** you have not earned Completionist

#### Scenario: Final board
- **WHEN** clearing a wave on the last missing board completes the set
- **THEN** you earn Completionist

### Requirement: Why Are You So Obsessed with Me?
You SHALL earn Why Are You So Obsessed with Me? when a two-player game of Last One Standing ends as a draw on points
(not by forfeit) and the AI won at least one of its rounds: the game where the result screen ribs you both about it.

#### Scenario: The AI took advantage
- **WHEN** a two-player Last One Standing game ends level on points, and the AI won one of its rounds
- **THEN** both players earn Why Are You So Obsessed with Me?

#### Scenario: Somebody won
- **WHEN** a two-player Last One Standing game ends with one human ahead, even though the AI won rounds
- **THEN** neither player earns it

### Requirement: You Can Take That to the Bank
In a single-player Waves game, you SHALL earn You Can Take That to the Bank when a wave with four AI tanks is cleared
and you destroyed all four with bank shots.

#### Scenario: Four for four
- **WHEN** in single-player Waves a four-AI wave is cleared and each AI tank was destroyed by a bounced shell of yours
- **THEN** you earn You Can Take That to the Bank

#### Scenario: Three out of four
- **WHEN** one of the four was destroyed by a direct shot, or by another AI tank
- **THEN** you do not earn it

### Requirement: Unfair Advantage
You SHALL earn Unfair Advantage when, in Waves, a shell of yours destroys an AI tank that is slowed by mortar mud,
whoever's mortar it was.

#### Scenario: Shooting fish in a barrel
- **WHEN** in Waves you destroy an AI tank while it is slowed by mud
- **THEN** you earn Unfair Advantage

#### Scenario: Mud has dried
- **WHEN** in Waves you destroy an AI tank after its slow has worn off
- **THEN** you do not earn Unfair Advantage

#### Scenario: Not in Last One Standing
- **WHEN** in Last One Standing you destroy a slowed tank
- **THEN** you do not earn Unfair Advantage

### Requirement: Close Shave
You SHALL earn Close Shave when you win a round or clear a wave with exactly 1 hit point (armour) left.

#### Scenario: Hanging on
- **WHEN** you clear a wave with 1 hit point left
- **THEN** you earn Close Shave

#### Scenario: Comfortable
- **WHEN** you win a round with 2 hit points left
- **THEN** you do not earn Close Shave

### Requirement: Earned once, kept between visits
An achievement SHALL be earned at most once and SHALL stay earned. Earned achievements and Completionist's progress
SHALL be saved in the browser's local storage as soon as they are earned, so leaving the game, a refresh or a dropped
connection straight afterwards doesn't lose them. Nothing that identifies the player SHALL be stored or sent anywhere.
If local storage is unavailable or its contents unreadable, the game SHALL play on as normal: achievements are still
recognised and shown for the current visit, and the Achievements screen SHALL say they can't be saved in this
browser.

#### Scenario: Remembered
- **WHEN** you earn Banked, close the browser and come back
- **THEN** the Achievements screen shows Banked as earned

#### Scenario: Earned only once
- **WHEN** you destroy another tank with a bank shot after already having Banked
- **THEN** nothing new is announced

#### Scenario: Storage blocked
- **WHEN** the browser blocks local storage and you earn Surfer
- **THEN** the game carries on, Surfer is announced, and the Achievements screen says achievements can't be saved
  here

#### Scenario: Damaged storage
- **WHEN** the saved achievements data is not valid
- **THEN** the game starts as if nothing had been earned, without an error

### Requirement: Unlocks announced between rounds
Newly earned achievements SHALL NOT be announced during play. Each SHALL be announced, with its name and
description, when the round or wave in which it was earned ends: during the pause after the round, or on the result
screen if that round ended the game. Achievements earned when the game ends SHALL be announced on the result screen.
When several are earned together, all of them SHALL be shown.

Achievements earned just before a dropped connection or a refresh are saved, but SHALL NOT have to be announced after
getting back in; they show on the Achievements screen as usual.

#### Scenario: Earned mid-round
- **WHEN** you earn Banked in the middle of a round that carries on
- **THEN** nothing appears until the round ends, and then Banked is announced in the pause after the round

#### Scenario: Earned in the last round
- **WHEN** you earn Close Shave in the round that wins you the game
- **THEN** Close Shave is announced on the result screen, with Last One Standing

#### Scenario: Several at once
- **WHEN** clearing wave 1 earns you Surfer, Perfection and Close Shave together
- **THEN** all three are announced

#### Scenario: Earned, then dropped
- **WHEN** you earn Banked and your connection drops before the round ends
- **THEN** Banked stays earned and shows on the Achievements screen, even if it is never announced

### Requirement: Achievements screen
The setup screen SHALL have an Achievements button showing how many have been earned (for example "Achievements
3 / 20"). It SHALL open a screen listing every achievement with its name and description. Earned achievements SHALL be
shown plainly; ones not yet earned SHALL be shown greyed out. When the site has no game server, the two-player
achievements SHALL be marked as needing online play. The screen SHALL note that achievements are stored in this
browser and are lost if its site data is cleared. The screen SHALL work with the mouse, the keyboard and a gamepad,
and SHALL close back to the setup screen.

#### Scenario: Locked ones greyed
- **WHEN** you have earned only Surfer and open the Achievements screen
- **THEN** Surfer is shown as earned, and the other 19 are greyed out with their descriptions

#### Scenario: No server
- **WHEN** the site has no game server configured
- **THEN** the five two-player achievements are greyed out and marked as needing online play

#### Scenario: Gamepad
- **WHEN** you open the Achievements screen with a gamepad
- **THEN** you can close it with the gamepad and return to the setup screen

### Requirement: Rejoining mid-round
After a dropped connection or a refresh brings you back into an online game, the round or wave in progress SHALL NOT
earn achievements that depend on what happened earlier in it (Perfection, Pacifist, Stop Hitting Yourself and You Can
Take That to the Bank), since some of it may have been missed. Everything else SHALL carry on as normal,
and the next round or wave SHALL count in full.

#### Scenario: Back from a drop
- **WHEN** you reconnect halfway through a Last One Standing round and go on to win it without firing
- **THEN** you do not earn Pacifist for that round, but you can in the next one

#### Scenario: A long stall
- **WHEN** an online game stalls (a hidden tab, say) past the pause after a round, so the end of the round only
  arrives once the next round has started
- **THEN** achievements that depend on how that round ended (winning it, its board for Completionist, armour left,
  MADness) may be missed, but none is awarded from the next round's state, such as the wrong board or a player who
  had been destroyed
