# last-one-standing Specification

## Purpose

The rules of the Last One Standing mode: how rounds start and end, who scores, and when the game is won, lost or
drawn. In single-player all AI tanks count together as one opponent; with two humans each human scores for themselves,
rounds the AI wins score for nobody, and a human who leaves forfeits the game.

## Requirements

### Requirement: Game options
Before a Last One Standing game, the host SHALL choose:
- the number of AI opponents: 1 to 4 inclusive in single-player, 1 to 3 inclusive with two humans (at most 5 tanks
  in total);
- the number of rounds (1, 3, 5 or 7);
- whether mortars are on (see the `mortars` spec);
- the map mode (see the `map-selection` spec).

Odd round counts guarantee a majority is possible in single-player. Friendly fire is not an option: in Last One
Standing everyone is fair game.

#### Scenario: Valid options accepted
- **WHEN** the player starts a game with 4 AI opponents, 5 rounds, mortars on and Random maps
- **THEN** each round is played by the human and 4 AI tanks, for up to 5 rounds, with mortars, on boards chosen at
  random

#### Scenario: Out-of-range options rejected
- **WHEN** a game is requested with 0 or 5 AI opponents, or with a round count other than 1, 3, 5 or 7
- **THEN** the game is not started

#### Scenario: Two humans, at most three AI
- **WHEN** a two-player game is requested with 3 AI opponents, and another with 4
- **THEN** the first is played by both humans and 3 AI tanks, and the second is not started

### Requirement: Round start
At the start of each round every tank SHALL be alive with full hit points at its assigned spawn point, all shells and
mortars in flight SHALL be cleared, and no tank SHALL be slowed. With mortars on, every tank, human and AI alike,
SHALL have one mortar loaded. A countdown SHALL run during which all tank inputs are ignored. Play begins when the
countdown ends.

#### Scenario: Countdown freezes tanks
- **WHEN** a player presses keys during the round-start countdown
- **THEN** no tank moves, fires or launches a mortar until the countdown has finished

#### Scenario: Everyone is armed
- **WHEN** a round begins with mortars on
- **THEN** the human and every AI tank each have one mortar loaded

### Requirement: Round end and scoring
In single-player, a round SHALL end as soon as one of the following happens, and be scored as stated:
- the human is the only live tank → the human scores 1 point;
- the human is eliminated while at least one AI tank is still alive → the AI side scores 1 point;
- the human and all remaining AI tanks are eliminated in the same tick → the round is drawn and nobody scores.

With two humans, each human SHALL have their own score. The rounds the AI wins SHALL be counted for display (so the
result can point out how many the AI took), but that count SHALL NOT affect the result. A round SHALL end as soon as
one of the following happens, and be scored as stated:
- one human is the only live tank → that human scores 1 point;
- one AI tank is the only live tank → the AI won the round and nobody scores;
- both humans have been eliminated while at least one AI tank is still alive → the AI won the round and nobody scores;
- no tank is left, and both humans were among those eliminated in that final tick → the humans **share the point**:
  each scores 1 point;
- no tank is left, and only one human was among those eliminated in that final tick (the other was already out) →
  the round is drawn and nobody scores.

In either case the round SHALL end immediately when every human has been eliminated, without waiting for the AI tanks
to finish each other off. Eliminating one of two humans SHALL NOT end the round. Every finished round, including a
drawn one or one the AI won, SHALL count towards the number of rounds played. Statistics for individual AI tanks
SHALL NOT be tracked.

#### Scenario: Human wins the round
- **WHEN** the last AI tank is eliminated and the human is still alive
- **THEN** the round ends and the human's score increases by 1

#### Scenario: Human eliminated
- **WHEN** the human is eliminated while two AI tanks remain
- **THEN** the round ends immediately and the AI side's score increases by 1

#### Scenario: Mutual destruction
- **WHEN** the human and the last AI tank are eliminated in the same tick
- **THEN** the round ends as a draw, neither score changes, and the round counts as played

#### Scenario: Shells after round end have no effect
- **WHEN** a round has ended and shells are still in flight
- **THEN** those shells cannot change the round's result

#### Scenario: One human down, play on
- **WHEN** in a two-player round one human is eliminated while the other human and an AI tank are alive
- **THEN** the round continues

#### Scenario: Last human standing
- **WHEN** in a two-player round the second human destroys the last AI tank after the first human was eliminated
- **THEN** the round ends and only the second human's score increases by 1

#### Scenario: The AI wins a two-player round
- **WHEN** in a two-player round both humans are eliminated while an AI tank is alive
- **THEN** the round ends immediately, neither human scores, and the round counts as played

#### Scenario: Sharing the point
- **WHEN** the last two tanks are the two humans and they destroy each other in the same tick
- **THEN** the round ends and each human's score increases by 1

#### Scenario: Going out with the last AI
- **WHEN** in a two-player round, with the first human already eliminated, the second human and the last AI tank are
  eliminated in the same tick
- **THEN** the round ends as a draw and neither human scores

### Requirement: Game end
In single-player, the game SHALL end as soon as one side's score lead is greater than the number of rounds remaining
(the result can no longer change), or when all selected rounds have been played. The side with more points wins;
equal points is a draw.

With two humans, the game SHALL end as soon as one human's lead over the other is greater than the number of rounds
remaining, or when all selected rounds have been played. The human with more points wins; equal points is a draw. The
result SHALL name the winning human, so that each player's screen can show it as a win or a loss.

#### Scenario: Majority clinches the game
- **WHEN** in a 5-round game the human reaches 3 points after 4 rounds
- **THEN** the game ends immediately as a human win without playing round 5

#### Scenario: AI clinches the game
- **WHEN** in a 5-round game the AI side reaches 3 points
- **THEN** the game ends immediately as a human loss

#### Scenario: Early end despite draws
- **WHEN** in a 5-round game the score is human 2, AI 0 after 4 rounds (two drawn)
- **THEN** the game ends as a human win, because the AI cannot catch up in the one remaining round

#### Scenario: Drawn game
- **WHEN** in a 3-round game the rounds finish human win, AI win, drawn round
- **THEN** the game ends as a draw at 1–1

#### Scenario: Out of reach
- **WHEN** in a two-player 5-round game the first human leads 3–0 after 3 rounds
- **THEN** the game ends with the first human as the winner, without playing rounds 4 and 5

#### Scenario: AI rounds still count
- **WHEN** in a two-player 3-round game the AI wins rounds 1 and 2 and the second human wins round 3
- **THEN** the game ends after round 3 with the second human as the winner, 1–0, and the AI's count shows 2 rounds
  won

#### Scenario: The AI's rounds are only for show
- **WHEN** in a two-player 3-round game the AI wins all three rounds
- **THEN** the game ends as a draw at 0–0, and the AI's count shows 3 rounds won

#### Scenario: Level after the last round
- **WHEN** in a two-player 3-round game the humans share the point in round 1 and the AI wins rounds 2 and 3
- **THEN** the game ends as a draw at 1–1

### Requirement: Rounds are independent
AI opponents SHALL NOT change difficulty between rounds. Nothing SHALL carry over from one round to the next except:
- the score;
- the round number;
- the position in the map rotation, which decides only which board the next round is played on.

#### Scenario: Fresh round
- **WHEN** a new round starts after the human finished the previous round on 1 hit point
- **THEN** the human starts the new round on full hit points and the AI tanks behave with the same difficulty as before

#### Scenario: New board, same difficulty
- **WHEN** round 2 is played on a different board from round 1
- **THEN** the AI tanks have the same hit points, damage and shell speed as in round 1

### Requirement: Forfeit
In a two-player Last One Standing game, when a human leaves (see the `simulation` spec), the game SHALL end straight
away and the remaining human SHALL win by forfeit, whatever the score. The round in progress SHALL NOT be scored or
counted as played. The result SHALL say that the game was won by forfeit.

#### Scenario: Winning by forfeit
- **WHEN** in a two-player game the second human leaves mid-round while leading 2–0
- **THEN** the game ends at once, the first human wins by forfeit, and the score stays 2–0

#### Scenario: Leaving between rounds
- **WHEN** a human leaves during the pause after a round
- **THEN** the game ends with the remaining human winning by forfeit, and no further round is played
